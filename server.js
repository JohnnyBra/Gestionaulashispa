const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const USERS_CACHE_FILE = path.join(__dirname, 'users_cache.json');
const STUDENTS_CACHE_FILE = path.join(__dirname, 'students_cache.json');
const CLASSES_CACHE_FILE = path.join(__dirname, 'classes_cache.json');

// --- CONFIGURACIÓN EXTERNA ---
const EXTERNAL_API_BASE = 'https://prisma.bibliohispa.es';
const EXTERNAL_SOCKET_URL = 'https://prisma.bibliohispa.es';
// Forzamos el valor por defecto si no viene en el env
const API_SECRET = process.env.API_SECRET || 'ojosyculos'; 

// User Agent personalizado para evitar bloqueos anti-bot genéricos
const SERVER_USER_AGENT = 'Hispanidad-Reservas-Server/1.0';

// Helper para headers comunes
const getCommonHeaders = () => ({
  'User-Agent': SERVER_USER_AGENT,
  'Accept': 'application/json',
  'Cache-Control': 'no-cache',
  'api_secret': API_SECRET,
  'x-api-secret': API_SECRET,
  'Authorization': `Bearer ${API_SECRET}`
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE"] }
});

app.use(cors());
app.use(express.json());

// --- MEMORY CACHE ---
let usersMemoryCache = [];
let studentsMemoryCache = [];
let classesMemoryCache = [];

const ROLE_MAP = {
  'ADMIN': 'ADMIN', 'ADMINISTRADOR': 'ADMIN', 'DIRECCION': 'ADMIN', 'DIRECTOR': 'ADMIN', 'JEFATURA': 'ADMIN',
  'TUTOR': 'TEACHER', 'PROFESOR': 'TEACHER', 'DOCENTE': 'TEACHER', 'MAESTRO': 'TEACHER', 'USER': 'TEACHER', 'ORIENTADOR': 'TEACHER',
  'ALUMNO': 'STUDENT', 'ESTUDIANTE': 'STUDENT', 'STUDENT': 'STUDENT'
};

const loadCache = async () => {
    try {
        const usersData = await fsp.readFile(USERS_CACHE_FILE, 'utf8');
        usersMemoryCache = JSON.parse(usersData || '[]');
        console.log(`✅ [CACHE] Usuarios cargados: ${usersMemoryCache.length}`);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            console.error("Error lectura caché usuarios:", e);
        }
    }
    try {
        const studentsData = await fsp.readFile(STUDENTS_CACHE_FILE, 'utf8');
        studentsMemoryCache = JSON.parse(studentsData || '[]');
        console.log(`✅ [CACHE] Alumnos cargados: ${studentsMemoryCache.length}`);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            console.error("Error lectura caché alumnos:", e);
        }
    }
    try {
        const classesData = await fsp.readFile(CLASSES_CACHE_FILE, 'utf8');
        classesMemoryCache = JSON.parse(classesData || '[]');
        console.log(`✅ [CACHE] Clases cargadas: ${classesMemoryCache.length}`);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            console.error("Error lectura caché clases:", e);
        }
    }
};
const startServer = async () => {
    await loadCache();

    // --- EXTERNAL DATA SYNC (VIA SOCKET) ---
    let prismaSocket = null;

const processExternalUsers = (externalUsers) => {
    if (!Array.isArray(externalUsers)) return;

    console.log(`🔄 [SYNC] Procesando ${externalUsers.length} usuarios recibidos...`);

    const allowedTeachers = [];
    const allowedStudents = [];

    for (const u of externalUsers) {
      const rawRole = (u.role || u.rol || '').toString().toUpperCase().trim();
      
      // Strict Whitelist Logic: Only explicitly mapped roles are allowed.
      let appRole = ROLE_MAP[rawRole];

      // Fallback inference
      if (!appRole) {
          if (rawRole.includes('ADMIN') || rawRole.includes('DIRECTOR')) appRole = 'ADMIN';
          else if (rawRole === 'TUTOR') appRole = 'TEACHER';
          else if (rawRole.includes('ALUMNO')) appRole = 'STUDENT';
      }

      // If still no role, SKIP THIS USER.
      if (!appRole) continue;

      let finalEmail = u.email || u.correo || u.mail || u.id;
      // Si el email no parece email y tenemos ID, construimos uno falso para que funcione el sistema
      if (finalEmail && !finalEmail.toString().includes('@') && u.id) {
          finalEmail = `${u.id}@colegiolahispanidad.es`;
      }

      if (finalEmail) {
          const userObj = {
            id: u.id || finalEmail,
            name: u.name || u.nombre || u.full_name || u.nombre_completo || 'Usuario',
            email: finalEmail.toLowerCase().trim(),
            role: appRole,
            classId: u.classId || u.id_clase || null
          };

          if (appRole === 'STUDENT') {
              allowedStudents.push(userObj);
          } else {
              allowedTeachers.push(userObj);
          }
      }
    }

    if (allowedTeachers.length > 0) {
        allowedTeachers.sort((a, b) => a.name.localeCompare(b.name));
        usersMemoryCache = allowedTeachers;
        fsp.writeFile(USERS_CACHE_FILE, JSON.stringify(allowedTeachers, null, 2)).catch(err => {
            console.error('Error writing users cache file:', err);
        });
        console.log(`✅ [SYNC] ÉXITO: ${allowedTeachers.length} usuarios (profesores/admin) sincronizados.`);
    }

    if (allowedStudents.length > 0) {
        allowedStudents.sort((a, b) => a.name.localeCompare(b.name));
        studentsMemoryCache = allowedStudents;
        fsp.writeFile(STUDENTS_CACHE_FILE, JSON.stringify(allowedStudents, null, 2)).catch(err => {
            console.error('Error writing students cache file:', err);
        });
        console.log(`✅ [SYNC] ÉXITO: ${allowedStudents.length} alumnos sincronizados.`);
    }
};

const processExternalClasses = (externalClasses) => {
    if (!Array.isArray(externalClasses)) return;
    
    console.log(`🔄 [SYNC] Procesando ${externalClasses.length} clases recibidas...`);

    const cleanClasses = externalClasses.map(c => ({
        id: c.id,
        name: c.name || c.nombre || 'Sin nombre'
    })).filter(c => c.name);

    if (cleanClasses.length > 0) {
        classesMemoryCache = cleanClasses;
        fsp.writeFile(CLASSES_CACHE_FILE, JSON.stringify(cleanClasses, null, 2)).catch(err => {
            console.error('Error writing classes cache file:', err);
        });
        console.log(`✅ [SYNC] Clases actualizadas: ${cleanClasses.length}`);
    }
};

const startPrismaSocket = () => {
    console.log(`🔄 [SOCKET] Iniciando conexión a ${EXTERNAL_SOCKET_URL}`);
    prismaSocket = ClientIO(EXTERNAL_SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 5000
    });

    prismaSocket.on('connect', () => {
         console.log('✅ [SOCKET] Conectado a Prisma Edu');
    });

    prismaSocket.on('init_state', (data) => {
         console.log('📦 [SOCKET] Recibido estado inicial');
         if (data.users) processExternalUsers(data.users);
         if (data.classes) processExternalClasses(data.classes);
    });

    prismaSocket.on('sync_users', (users) => {
         console.log('🔄 [SOCKET] Actualización de usuarios recibida (Evento sync_users)');
         processExternalUsers(users);
    });

    prismaSocket.on('sync_classes', (classes) => {
         console.log('🔄 [SOCKET] Actualización de clases recibida (Evento sync_classes)');
         processExternalClasses(classes);
    });

    prismaSocket.on('disconnect', () => {
         console.log('⚠️ [SOCKET] Desconectado de Prisma Edu');
    });

    prismaSocket.on('connect_error', (err) => {
         console.error(`❌ [SOCKET] Error de conexión: ${err.message}`);
    });
};

// Iniciar sincronización por Socket
startPrismaSocket();

// --- API ENDPOINTS ---

app.get('/api/admin/force-sync', (req, res) => {
    if (prismaSocket) {
        console.log('🔄 [ADMIN] Forzando reconexión de socket...');
        prismaSocket.disconnect();
        prismaSocket.connect();
        res.json({ success: true, message: 'Reconexión de socket iniciada.' });
    } else {
        startPrismaSocket();
        res.json({ success: true, message: 'Socket iniciado.' });
    }
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false });
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!googleRes.ok) return res.status(401).json({ success: false });
    const payload = await googleRes.json();
    const user = usersMemoryCache.find(u => u.email === payload.email.toLowerCase());
    if (user) return res.json({ success: true, ...user });
    return res.status(403).json({ success: false, message: 'Usuario no registrado.' });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  
  try {
    const response = await fetch(`${EXTERNAL_API_BASE}/api/auth/external-check`, {
      method: 'POST',
      headers: { ...getCommonHeaders(), 'Content-Type': 'application/json' },
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
      res.status(503).json({ success: false, message: 'Error de conexión' }); 
  }
});

app.get('/api/teachers', (req, res) => {
    const sorted = [...usersMemoryCache].sort((a,b) => a.name.localeCompare(b.name));
    res.json(sorted);
});
app.get('/api/students', (req, res) => {
    const sorted = [...studentsMemoryCache].sort((a,b) => a.name.localeCompare(b.name));
    res.json(sorted);
});
app.get('/api/classes', (req, res) => res.json(classesMemoryCache));
app.get('/api/bookings', async (req, res) => {
    try {
        const data = await fsp.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data || '[]'));
    } catch (e) {
        if (e.code === 'ENOENT') {
            return res.json([]);
        }
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const incoming = Array.isArray(req.body) ? req.body : [req.body];
        let bookings = [];
        try {
            const data = await fsp.readFile(DATA_FILE, 'utf8');
            bookings = JSON.parse(data || '[]');
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        for (const item of incoming) {
            const incomingResource = item.resource || 'ROOM';
            if (bookings.some(b => b.date === item.date && b.slotId === item.slotId && b.stage === item.stage && (b.resource || 'ROOM') === incomingResource)) {
                return res.status(409).json({ error: 'Conflict' });
            }
        }
        bookings.push(...incoming);
        await fsp.writeFile(DATA_FILE, JSON.stringify(bookings, null, 2));

        if (incoming[0]?.logs?.[0]) {
            let history = [];
            try {
                const historyData = await fsp.readFile(HISTORY_FILE, 'utf8');
                history = JSON.parse(historyData || '[]');
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
            }
            history.push(incoming[0].logs[0]);
            if (history.length > 1000) history = history.slice(-1000);
            await fsp.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
        }

        io.emit('server:bookings_updated', bookings);
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('Error processing booking:', e);
        res.status(500).json({ error: 'Error' });
    }
});

app.put('/api/bookings/:id', async (req, res) => {
    try {
        let bookings = [];
        try {
            const data = await fsp.readFile(DATA_FILE, 'utf8');
            bookings = JSON.parse(data || '[]');
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        const index = bookings.findIndex(b => b.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Not found' });

        // Update fields (preserving ID and potentially other immutable fields if needed)
        bookings[index] = { ...bookings[index], ...req.body, id: req.params.id };

        await fsp.writeFile(DATA_FILE, JSON.stringify(bookings, null, 2));
        io.emit('server:bookings_updated', bookings);
        res.json({ success: true });
    } catch (e) {
        console.error('Error updating booking:', e);
        res.status(500).json({ error: 'Error' });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        let bookings = [];
        try {
            const data = await fsp.readFile(DATA_FILE, 'utf8');
            bookings = JSON.parse(data || '[]');
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        const target = bookings.find(b => b.id === req.params.id);
        if (!target) return res.status(404).json({ error: 'Not found' });

        bookings = bookings.filter(b => b.id !== req.params.id);
        await fsp.writeFile(DATA_FILE, JSON.stringify(bookings, null, 2));

        if (req.body.user) {
            let history = [];
            try {
                const historyData = await fsp.readFile(HISTORY_FILE, 'utf8');
                history = JSON.parse(historyData || '[]');
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
            }
            history.push({ action: 'DELETED', user: req.body.user.email, userName: req.body.user.name, timestamp: Date.now(), details: `Eliminada reserva de ${target.teacherName}` });
            await fsp.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
        }

        io.emit('server:bookings_updated', bookings);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting booking:', e);
        res.status(500).json({ error: 'Error' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const data = await fsp.readFile(HISTORY_FILE, 'utf8');
        res.json(JSON.parse(data || '[]').sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
        if (e.code === 'ENOENT') {
            return res.json([]);
        }
        res.status(500).json({ error: 'Error' });
    }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

    server.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
};

startServer();
