const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const USERS_CACHE_FILE = path.join(__dirname, 'users_cache.json');
const CLASSES_CACHE_FILE = path.join(__dirname, 'classes_cache.json');

// --- CONFIGURACIÓN EXTERNA ---
const EXTERNAL_API_BASE = 'https://prisma.bibliohispa.es';
const API_SECRET = process.env.API_SECRET || 'ojosyculos'; 

// User Agent estándar para evitar bloqueos
const STANDARD_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const getHeaders = (method = 'GET') => {
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': STANDARD_USER_AGENT,
    'api_secret': API_SECRET,
    'x-api-secret': API_SECRET
  };
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE"] }
});

app.use(cors());
app.use(express.json());

// --- MEMORY CACHE ---
let usersMemoryCache = [];
let classesMemoryCache = [];

const ROLE_MAP = {
  'ADMIN': 'ADMIN', 'ADMINISTRADOR': 'ADMIN', 'DIRECCION': 'ADMIN', 'DIRECTOR': 'ADMIN', 'JEFATURA': 'ADMIN',
  'TUTOR': 'TEACHER', 'PROFESOR': 'TEACHER', 'DOCENTE': 'TEACHER', 'MAESTRO': 'TEACHER', 'USER': 'TEACHER', 'ORIENTADOR': 'TEACHER'
};

const loadCache = () => {
  if (fs.existsSync(USERS_CACHE_FILE)) {
    try {
      usersMemoryCache = JSON.parse(fs.readFileSync(USERS_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Usuarios cargados: ${usersMemoryCache.length}`);
    } catch (e) { console.error("Error caché usuarios:", e); }
  }
  if (fs.existsSync(CLASSES_CACHE_FILE)) {
    try {
      classesMemoryCache = JSON.parse(fs.readFileSync(CLASSES_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Clases cargadas: ${classesMemoryCache.length}`);
    } catch (e) { console.error("Error caché clases:", e); }
  }
};
loadCache();

// --- EXTERNAL DATA SYNC ---
const syncUsers = async () => {
  const targetUrl = `${EXTERNAL_API_BASE}/api/export/users?secret=${API_SECRET}`;
  console.log(`🔄 [SYNC] Sincronizando usuarios (Tutores) desde Prisma...`);

  try {
    const response = await fetch(targetUrl, { method: 'GET', headers: getHeaders('GET') });
    if (!response.ok) {
        console.error(`❌ [SYNC] Error HTTP ${response.status}`);
        return;
    }

    let data = await response.json();
    let externalUsers = Array.isArray(data) ? data : (data.data || []);

    if (externalUsers.length > 0) {
      const allowedUsers = [];
      
      for (const u of externalUsers) {
        // NORMALIZACIÓN DE ROL: 
        // Si el endpoint es de "export/users" (tutores), asignamos TEACHER por defecto si no viene el campo.
        const rawRole = (u.role || u.rol || 'TUTOR').toString().toUpperCase().trim();
        let appRole = ROLE_MAP[rawRole];
        
        if (!appRole) {
            if (rawRole.includes('ADMIN') || rawRole.includes('DIRECTOR')) appRole = 'ADMIN';
            else appRole = 'TEACHER'; // Por defecto tratamos como profesor si viene de esta ruta
        }

        let finalEmail = u.email || u.correo || u.mail || u.id;
        if (finalEmail && !finalEmail.toString().includes('@') && u.id) {
            finalEmail = `${u.id}@colegiolahispanidad.es`;
        }

        if (finalEmail) {
            allowedUsers.push({
              id: u.id || finalEmail, 
              name: u.name || u.nombre || u.full_name || u.nombre_completo || 'Docente',
              email: finalEmail.toLowerCase().trim(),
              role: appRole,
              classId: u.classId || u.id_clase || null 
            });
        }
      }
      
      if (allowedUsers.length > 0) {
          allowedUsers.sort((a, b) => a.name.localeCompare(b.name));
          usersMemoryCache = allowedUsers;
          fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(allowedUsers, null, 2));
          console.log(`✅ [SYNC] ${allowedUsers.length} tutores listos en caché.`);
      }
    }
  } catch (err) { console.error(`❌ [SYNC] Error usuarios: ${err.message}`); }
};

const syncClasses = async () => {
    const targetUrl = `${EXTERNAL_API_BASE}/api/export/classes?secret=${API_SECRET}`;
    try {
      const response = await fetch(targetUrl, { method: 'GET', headers: getHeaders('GET') });
      if (!response.ok) return;
      let data = await response.json();
      let externalClasses = Array.isArray(data) ? data : (data.data || []);
      if (externalClasses.length > 0) {
        classesMemoryCache = externalClasses.map(c => ({ id: c.id, name: c.name || c.nombre || 'Clase' }));
        fs.writeFileSync(CLASSES_CACHE_FILE, JSON.stringify(classesMemoryCache, null, 2));
      }
    } catch (err) { console.error(`❌ [SYNC] Error clases: ${err.message}`); }
};

const runSync = () => { syncUsers(); syncClasses(); };
setTimeout(runSync, 2000);
setInterval(runSync, 60 * 60 * 1000);

// --- API ENDPOINTS ---
app.get('/api/admin/force-sync', (req, res) => { runSync(); res.json({ success: true }); });

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const payload = await googleRes.json();
    const user = usersMemoryCache.find(u => u.email === payload.email.toLowerCase());
    if (user) return res.json({ success: true, ...user });
    res.status(403).json({ success: false, message: 'Usuario no autorizado' });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email.trim().toLowerCase();
  try {
    const response = await fetch(`${EXTERNAL_API_BASE}/api/auth/external-check`, {
      method: 'POST', headers: getHeaders('POST'),
      body: JSON.stringify({ username: cleanEmail, email: cleanEmail, password })
    });
    if (!response.ok) return res.status(401).json({ success: false });
    const extUser = await response.json();
    const rawRole = (extUser.role || extUser.rol || 'TUTOR').toUpperCase();
    let appRole = ROLE_MAP[rawRole] || (rawRole.includes('ADMIN') ? 'ADMIN' : 'TEACHER');
    
    return res.json({
        success: true, role: appRole,
        name: extUser.name || extUser.nombre || extUser.full_name || 'Usuario',
        email: (extUser.email || extUser.correo || cleanEmail).toLowerCase()
    });
  } catch (err) { res.status(503).json({ success: false }); }
});

app.get('/api/teachers', (req, res) => res.json(usersMemoryCache));
app.get('/api/classes', (req, res) => res.json(classesMemoryCache));
app.get('/api/bookings', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'));
});

app.post('/api/bookings', (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    let bookings = [];
    if (fs.existsSync(DATA_FILE)) bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
    bookings.push(...incoming);
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    incoming.forEach(b => { 
        if(b.logs?.[0]) {
            let history = [];
            if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
            history.push(b.logs[0]);
            if (history.length > 1000) history = history.slice(-1000);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        }
    });
    io.emit('server:bookings_updated', bookings);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/bookings/:id', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({error: 'Not found'});
  let bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  bookings = bookings.filter(b => b.id !== req.params.id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
  io.emit('server:bookings_updated', bookings);
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
    if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]').sort((a,b) => b.timestamp - a.timestamp));
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
