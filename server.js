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
const API_SECRET = process.env.API_SECRET || 'YOUR_API_SECRET'; 

// User Agent de Chrome estándar para evitar bloqueos de WAF/Firewall
const STANDARD_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper para cabeceras dinámicas
const getHeaders = (method = 'GET') => {
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': STANDARD_USER_AGENT,
    'api_secret': API_SECRET,
    'x-api-secret': API_SECRET // Enviar en ambos formatos por compatibilidad
  };
  
  // Solo añadir Content-Type si hay cuerpo (POST/PUT)
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

/**
 * CONFIGURACIÓN DE ROLES
 */
const ROLE_MAP = {
  'ADMIN': 'ADMIN',
  'ADMINISTRADOR': 'ADMIN',
  'DIRECCION': 'ADMIN',
  'DIRECTOR': 'ADMIN',
  'JEFATURA': 'ADMIN',
  'COORDINADOR': 'ADMIN',
  'TUTOR': 'TEACHER',
  'PROFESOR': 'TEACHER',
  'DOCENTE': 'TEACHER',
  'TEACHER': 'TEACHER',
  'MAESTRO': 'TEACHER',
  'USER': 'TEACHER'
};

// Carga inicial de Caché
const loadCache = () => {
  if (fs.existsSync(USERS_CACHE_FILE)) {
    try {
      usersMemoryCache = JSON.parse(fs.readFileSync(USERS_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Usuarios cargados en memoria: ${usersMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché usuarios:", e); }
  }
  if (fs.existsSync(CLASSES_CACHE_FILE)) {
    try {
      classesMemoryCache = JSON.parse(fs.readFileSync(CLASSES_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Clases cargadas en memoria: ${classesMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché clases:", e); }
  }
};
loadCache();

// --- EXTERNAL DATA SYNC ---
const syncUsers = async () => {
  // URL con secreto como query param (fallback)
  const targetUrl = `${EXTERNAL_API_BASE}/api/export/users?secret=${API_SECRET}`;
  console.log(`🔄 [SYNC] Sincronizando usuarios desde: ${EXTERNAL_API_BASE}`);

  try {
    // IMPORTANTE: GET request sin Content-Type header
    const response = await fetch(targetUrl, { 
        method: 'GET', 
        headers: getHeaders('GET') 
    });
    
    if (!response.ok) {
        const text = await response.text();
        console.error(`❌ [SYNC] Fallo HTTP ${response.status}: ${text.substring(0, 200)}`);
        return;
    }

    let externalUsers = await response.json();

    // Normalizar respuesta { data: [] } vs []
    if (!Array.isArray(externalUsers) && externalUsers.data && Array.isArray(externalUsers.data)) {
        externalUsers = externalUsers.data;
    }

    if (Array.isArray(externalUsers)) {
      const allowedUsers = [];
      
      for (const u of externalUsers) {
        const rawRole = (u.role || u.rol || '').toString().toUpperCase().trim();
        const appRole = ROLE_MAP[rawRole];

        if (appRole) {
            let finalEmail = u.email || u.correo || u.mail;
            
            if (!finalEmail && u.id) {
                if (u.id.toString().includes('@')) finalEmail = u.id;
                else finalEmail = `${u.id}@colegiolahispanidad.es`;
            }

            if (finalEmail) {
                allowedUsers.push({
                  id: u.id || finalEmail, 
                  name: u.name || u.nombre || 'Docente',
                  email: finalEmail.toLowerCase().trim(),
                  role: appRole,
                  classId: u.classId || null 
                });
            }
        }
      }
      
      if (allowedUsers.length > 0) {
          usersMemoryCache = allowedUsers;
          fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(allowedUsers, null, 2));
          console.log(`✅ [SYNC] Usuarios actualizados: ${allowedUsers.length}`);
      } else {
          console.warn(`⚠️ [SYNC] Se recibieron 0 usuarios válidos (Raw: ${externalUsers.length})`);
      }
    }
  } catch (err) { 
      console.error(`❌ [SYNC] Error de red Usuarios: ${err.message}`); 
  }
};

const syncClasses = async () => {
    const targetUrl = `${EXTERNAL_API_BASE}/api/export/classes?secret=${API_SECRET}`;
    
    try {
      const response = await fetch(targetUrl, { 
          method: 'GET', 
          headers: getHeaders('GET') 
      });

      if (!response.ok) {
          console.error(`❌ [SYNC] Fallo HTTP Clases ${response.status}`);
          return;
      }
  
      let externalClasses = await response.json();
      
      if (!Array.isArray(externalClasses) && externalClasses.data && Array.isArray(externalClasses.data)) {
        externalClasses = externalClasses.data;
      }

      if (Array.isArray(externalClasses)) {
        const cleanClasses = externalClasses.map(c => ({
            id: c.id,
            name: c.name || c.nombre || 'Sin nombre'
        })).filter(c => c.name);

        classesMemoryCache = cleanClasses;
        fs.writeFileSync(CLASSES_CACHE_FILE, JSON.stringify(cleanClasses, null, 2));
        console.log(`✅ [SYNC] Clases actualizadas: ${cleanClasses.length}`);
      }
    } catch (err) { console.error(`❌ [SYNC] Error de red Clases: ${err.message}`); }
};

// Sincronizar al iniciar y cada hora
const runSync = () => { 
    syncUsers(); 
    syncClasses(); 
};

setTimeout(runSync, 2000);
setInterval(runSync, 60 * 60 * 1000);

// --- HELPERS ---
const readBookings = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch(e) { return []; }
};

const appendToHistory = (actionLog) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
    } catch(e) {}
  }
  history.push(actionLog);
  if (history.length > 1000) history = history.slice(-1000);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
};

// --- API ENDPOINTS ---

// Endpoint de prueba para forzar sincronización manualmente
app.get('/api/admin/force-sync', (req, res) => {
    runSync();
    res.json({ success: true, message: 'Sincronización iniciada en segundo plano. Revisa logs.' });
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'Falta token' });
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!googleRes.ok) return res.status(401).json({ success: false, message: 'Token Google inválido' });
    const payload = await googleRes.json();
    const googleEmail = payload.email.toLowerCase();
    
    const user = usersMemoryCache.find(u => u.email === googleEmail);
    if (user) {
        return res.json({ success: true, role: user.role, name: user.name, id: user.id, email: user.email });
    } else {
        console.warn(`⚠️ Login Google rechazado: ${googleEmail} no encontrado en lista.`);
        return res.status(403).json({ success: false, message: `Usuario ${googleEmail} no autorizado.` });
    }
  } catch (e) { res.status(500).json({ success: false, message: 'Error interno' }); }
});

app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  
  try {
    console.log(`🔑 Intentando login externo para: ${cleanEmail}`);
    
    const response = await fetch(`${EXTERNAL_API_BASE}/api/auth/external-check`, {
      method: 'POST',
      headers: getHeaders('POST'), // Usa headers correctos para POST
      body: JSON.stringify({ username: cleanEmail, email: cleanEmail, password })
    });
    
    const text = await response.text();
    
    if (!response.ok) {
        console.warn(`⚠️ Login fallido Prisma [${response.status}]: ${text.substring(0, 100)}`);
        return res.status(401).json({ success: false, message: 'Credenciales inválidas o error en servidor central.' });
    }
    
    let extUser;
    try { extUser = JSON.parse(text); } catch(e) { return res.status(500).json({success:false, message: "Error parsing servidor externo"}); }
    
    const rawRole = (extUser.role || extUser.rol || '').toUpperCase();
    const appRole = ROLE_MAP[rawRole];
    
    if (!appRole) return res.status(403).json({ success: false, message: 'Sin acceso (Rol no autorizado).' });
    
    let finalEmail = extUser.email || extUser.correo || extUser.mail;
    if (!finalEmail && extUser.id) {
        if (extUser.id.toString().includes('@')) finalEmail = extUser.id;
        else finalEmail = `${extUser.id}@colegiolahispanidad.es`;
    }
    if (!finalEmail) finalEmail = cleanEmail;
    finalEmail = finalEmail.toLowerCase().trim();
    
    return res.json({
        success: true,
        role: appRole,
        name: extUser.name || extUser.nombre || 'Usuario',
        id: extUser.id || finalEmail,
        email: finalEmail 
    });
  } catch (err) { 
      console.error("❌ Excepción Login:", err);
      res.status(503).json({ success: false, message: 'Error de conexión con servidor de autenticación' }); 
  }
});

app.get('/api/teachers', (req, res) => res.json(usersMemoryCache));
app.get('/api/classes', (req, res) => res.json(classesMemoryCache));
app.get('/api/bookings', (req, res) => res.json(readBookings()));
app.get('/api/history', (req, res) => {
  if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
  try {
    const h = JSON.parse(fs.readFileSync(HISTORY_FILE));
    res.json(h.sort((a,b) => b.timestamp - a.timestamp));
  } catch(e) { res.json([]); }
});

app.post('/api/bookings', (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    let bookings = readBookings();
    
    for (const item of incoming) {
       const incomingResource = item.resource || 'ROOM';

       if (bookings.some(b => {
           const bookingResource = b.resource || 'ROOM';
           return b.date === item.date && 
                  b.slotId === item.slotId && 
                  b.stage === item.stage &&
                  bookingResource === incomingResource;
       })) {
         return res.status(409).json({ error: 'Conflict' });
       }
    }
    bookings.push(...incoming);
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    incoming.forEach(b => { if(b.logs?.length) appendToHistory(b.logs[0]); });
    io.emit('server:bookings_updated', bookings);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/bookings/:id', (req, res) => {
  let bookings = readBookings();
  const target = bookings.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({error: 'Not found'});
  
  bookings = bookings.filter(b => b.id !== req.params.id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
  
  if (req.body.user) {
      appendToHistory({
        action: 'DELETED', user: req.body.user.email, userName: req.body.user.name,
        timestamp: Date.now(), details: `Eliminada reserva de ${target.teacherName}: ${target.date}`
      });
  }
  
  io.emit('server:bookings_updated', bookings);
  res.json({ success: true });
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
