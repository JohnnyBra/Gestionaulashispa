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

// User Agent de navegador real (Chrome Windows)
const STANDARD_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// Cabeceras para Login (POST) - Aquí SI enviamos secretos en header por seguridad si el body falla
const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': STANDARD_USER_AGENT,
    'api_secret': API_SECRET,
    'x-api-secret': API_SECRET,
    'Referer': `${EXTERNAL_API_BASE}/`
  };
};

// Cabeceras para Sincronización (GET) - SIN cabeceras custom para evitar WAF/Bloqueos 403
// La autenticación va SOLO por Query Param (?secret=...)
const getSyncHeaders = () => {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'User-Agent': STANDARD_USER_AGENT,
    'Referer': `${EXTERNAL_API_BASE}/`,
    'Upgrade-Insecure-Requests': '1',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Connection': 'keep-alive'
  };
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
    } catch (e) { console.error("Error lectura caché usuarios:", e); }
  }
  if (fs.existsSync(CLASSES_CACHE_FILE)) {
    try {
      classesMemoryCache = JSON.parse(fs.readFileSync(CLASSES_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Clases cargadas: ${classesMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché clases:", e); }
  }
};
loadCache();

// --- EXTERNAL DATA SYNC ---
const syncUsers = async () => {
  // Solo query param para autenticación en GET
  const targetUrl = `${EXTERNAL_API_BASE}/api/export/users?secret=${API_SECRET}`;
  console.log(`🔄 [SYNC] Conectando con: ${EXTERNAL_API_BASE} (users)...`);

  try {
    const response = await fetch(targetUrl, { 
        method: 'GET', 
        headers: getSyncHeaders() 
    });

    if (!response.ok) {
        // Leemos el texto para debug
        const errText = await response.text();
        console.error(`❌ [SYNC] Error HTTP ${response.status} en Usuarios. Respuesta: ${errText.substring(0, 150)}...`);
        return;
    }

    let data = await response.json();
    let externalUsers = Array.isArray(data) ? data : (data.data || []);

    if (externalUsers.length > 0) {
      const allowedUsers = [];
      
      for (const u of externalUsers) {
        const rawRole = (u.role || u.rol || 'TUTOR').toString().toUpperCase().trim();
        let appRole = ROLE_MAP[rawRole];
        
        if (!appRole) {
            if (rawRole.includes('ADMIN') || rawRole.includes('DIRECTOR')) appRole = 'ADMIN';
            else appRole = 'TEACHER'; 
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
          console.log(`✅ [SYNC] Sincronización ÉXITO: ${allowedUsers.length} usuarios.`);
      } else {
          console.warn(`⚠️ [SYNC] JSON recibido pero sin usuarios válidos.`);
      }
    }
  } catch (err) { 
      console.error(`❌ [SYNC] Excepción Usuarios: ${err.message}`); 
  }
};

const syncClasses = async () => {
    const targetUrl = `${EXTERNAL_API_BASE}/api/export/classes?secret=${API_SECRET}`;
    
    try {
      const response = await fetch(targetUrl, { 
          method: 'GET', 
          headers: getSyncHeaders() 
      });

      if (!response.ok) {
          console.error(`❌ [SYNC] Error HTTP ${response.status} en Clases.`);
          return;
      }
  
      let data = await response.json();
      let externalClasses = Array.isArray(data) ? data : (data.data || []);

      if (externalClasses.length > 0) {
        const cleanClasses = externalClasses.map(c => ({
            id: c.id,
            name: c.name || c.nombre || 'Sin nombre'
        })).filter(c => c.name);

        classesMemoryCache = cleanClasses;
        fs.writeFileSync(CLASSES_CACHE_FILE, JSON.stringify(cleanClasses, null, 2));
        console.log(`✅ [SYNC] Clases actualizadas: ${cleanClasses.length}`);
      }
    } catch (err) { console.error(`❌ [SYNC] Excepción Clases: ${err.message}`); }
};

const runSync = () => { 
    syncUsers(); 
    syncClasses(); 
};

// Arrancar sync tras 2 segundos para dar tiempo al server a iniciar
setTimeout(runSync, 2000);
// Repetir cada hora
setInterval(runSync, 60 * 60 * 1000);

// --- API ENDPOINTS ---

app.get('/api/admin/force-sync', (req, res) => {
    runSync();
    res.json({ success: true, message: 'Sync forzada ejecutándose...' });
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false });
  
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!googleRes.ok) return res.status(401).json({ success: false });
    
    const payload = await googleRes.json();
    const googleEmail = payload.email.toLowerCase();
    
    const user = usersMemoryCache.find(u => u.email === googleEmail);
    if (user) {
        return res.json({ success: true, ...user });
    } else {
        return res.status(403).json({ success: false, message: 'Usuario no encontrado en la lista oficial.' });
    }
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  
  try {
    const response = await fetch(`${EXTERNAL_API_BASE}/api/auth/external-check`, {
      method: 'POST',
      headers: getAuthHeaders(), // Headers específicos para POST/Login
      body: JSON.stringify({ username: cleanEmail, email: cleanEmail, password })
    });
    
    if (!response.ok) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    
    const extUser = await response.json();
    const rawRole = (extUser.role || extUser.rol || 'TUTOR').toUpperCase();
    let appRole = ROLE_MAP[rawRole];
    
    if (!appRole) {
         if (rawRole.includes('ADMIN') || rawRole.includes('DIRECTOR')) appRole = 'ADMIN';
         else appRole = 'TEACHER';
    }
    
    return res.json({
        success: true,
        role: appRole,
        name: extUser.name || extUser.nombre || extUser.full_name || 'Usuario',
        id: extUser.id || cleanEmail,
        email: (extUser.email || extUser.correo || cleanEmail).toLowerCase() 
    });
  } catch (err) { 
      console.error("❌ Login error:", err);
      res.status(503).json({ success: false, message: 'Error de conexión' }); 
  }
});

app.get('/api/teachers', (req, res) => {
    // Ordenar siempre antes de enviar
    const sorted = [...usersMemoryCache].sort((a,b) => a.name.localeCompare(b.name));
    res.json(sorted);
});
app.get('/api/classes', (req, res) => res.json(classesMemoryCache));
app.get('/api/bookings', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json([]);
  try {
      res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'));
  } catch(e) { res.json([]); }
});

app.post('/api/bookings', (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    let bookings = [];
    if (fs.existsSync(DATA_FILE)) {
        try { bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); } catch(e) {}
    }
    
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
    
    incoming.forEach(b => { 
        if(b.logs && b.logs.length > 0) {
            let history = [];
            if (fs.existsSync(HISTORY_FILE)) {
                try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]'); } catch(e) {}
            }
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
  let bookings = [];
  if (fs.existsSync(DATA_FILE)) {
      try { bookings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); } catch(e) {}
  }
  
  const target = bookings.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({error: 'Not found'});
  
  bookings = bookings.filter(b => b.id !== req.params.id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
  
  if (req.body.user) {
      let history = [];
      if (fs.existsSync(HISTORY_FILE)) {
          try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]'); } catch(e) {}
      }
      history.push({
        action: 'DELETED', 
        user: req.body.user.email, 
        userName: req.body.user.name,
        timestamp: Date.now(), 
        details: `Eliminada reserva de ${target.teacherName}: ${target.date}`
      });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }
  
  io.emit('server:bookings_updated', bookings);
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
  try {
    const h = JSON.parse(fs.readFileSync(HISTORY_FILE));
    res.json(h.sort((a,b) => b.timestamp - a.timestamp));
  } catch(e) { res.json([]); }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
