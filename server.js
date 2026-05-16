require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const reportService = require('./services/reportService');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { format } = require('date-fns');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const USERS_CACHE_FILE = path.join(__dirname, 'users_cache.json');
const STUDENTS_CACHE_FILE = path.join(__dirname, 'students_cache.json');
const CLASSES_CACHE_FILE = path.join(__dirname, 'classes_cache.json');
const INCIDENTS_FILE = path.join(__dirname, 'incidents.json');
const ACCESS_LOGS_FILE = path.join(__dirname, 'access_logs.json');

// --- CONFIGURACIÓN EXTERNA ---
const EXTERNAL_API_BASE = 'https://prisma.bibliohispa.es';
const EXTERNAL_SOCKET_URL = 'https://prisma.bibliohispa.es';
// Forzamos el valor por defecto si no viene en el env
const API_SECRET = process.env.API_SECRET || '';

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
app.use(cookieParser());

const JWT_SSO_SECRET = process.env.JWT_SSO_SECRET || 'fallback-secret';

const globalAuthMiddleware = async (req, res, next) => {
  const isPublicRoute =
    !req.path.startsWith('/api/') ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/proxy') ||
    req.path.startsWith('/api/bookings/swap/confirm');

  if (isPublicRoute) return next();
  if (process.env.ENABLE_GLOBAL_SSO !== 'true') return next();

  const token = req.cookies.BIBLIO_SSO_TOKEN;
  if (!token) return res.status(401).json({ success: false, message: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, JWT_SSO_SECRET);
    if (decoded.role === 'FAMILY' || decoded.role === 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Acceso denegado a satélites para este rol.' });
    }
    req.ssoUser = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesión inválida' });
  }
};

const requireAdmin = (req, res, next) => {
  if (process.env.ENABLE_GLOBAL_SSO !== 'true') return next();
  if (!req.ssoUser || req.ssoUser.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Se requiere rol de administrador' });
  }
  next();
};

app.use(globalAuthMiddleware);

// --- MEMORY CACHE ---
let usersMemoryCache = [];
let usersEmailMap = new Map(); // O(1) Lookup Cache
let studentsMemoryCache = [];
let classesMemoryCache = [];
let bookingsMemoryCache = [];
let historyMemoryCache = [];
let incidentsMemoryCache = [];
let syncTarget = 'ALL'; // 'ALL', 'TEACHERS', 'STUDENTS'

// Helper to rebuild the map
const updateUsersMap = () => {
  usersEmailMap.clear();
  usersMemoryCache.forEach(u => {
    if (u.email) usersEmailMap.set(u.email.toLowerCase(), u);
  });
};

const ROLE_MAP = {
  'ADMIN': 'ADMIN', 'ADMINISTRADOR': 'ADMIN', 'DIRECCION': 'ADMIN', 'DIRECTOR': 'ADMIN', 'JEFATURA': 'ADMIN',
  'TUTOR': 'TEACHER', 'PROFESOR': 'TEACHER', 'DOCENTE': 'TEACHER', 'MAESTRO': 'TEACHER', 'USER': 'TEACHER', 'ORIENTADOR': 'TEACHER',
  'ALUMNO': 'STUDENT', 'ESTUDIANTE': 'STUDENT', 'STUDENT': 'STUDENT'
};

const SLOTS_PRIMARY = [
  { id: 'p1', label: '9:00 - 10:00', start: '09:00', end: '10:00' },
  { id: 'p2', label: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { id: 'p3', label: '11:30 - 12:30', start: '11:30', end: '12:30' },
  { id: 'p4', label: '12:30 - 14:00', start: '12:30', end: '14:00' },
];

const SLOTS_SECONDARY = [
  { id: 's1', label: '8:00 - 9:00', start: '08:00', end: '09:00' },
  { id: 's2', label: '9:00 - 10:00', start: '09:00', end: '10:00' },
  { id: 's3', label: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { id: 's4', label: '11:30 - 12:30', start: '11:30', end: '12:30' },
  { id: 's5', label: '12:30 - 13:30', start: '12:30', end: '13:30' },
  { id: 's6', label: '13:30 - 14:30', start: '13:30', end: '14:30' },
];

const loadCache = () => {
  if (fs.existsSync(USERS_CACHE_FILE)) {
    try {
      usersMemoryCache = JSON.parse(fs.readFileSync(USERS_CACHE_FILE, 'utf8') || '[]');
      updateUsersMap();
      console.log(`✅ [CACHE] Usuarios cargados: ${usersMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché usuarios:", e); }
  }
  if (fs.existsSync(STUDENTS_CACHE_FILE)) {
    try {
      studentsMemoryCache = JSON.parse(fs.readFileSync(STUDENTS_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Alumnos cargados: ${studentsMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché alumnos:", e); }
  }
  if (fs.existsSync(CLASSES_CACHE_FILE)) {
    try {
      classesMemoryCache = JSON.parse(fs.readFileSync(CLASSES_CACHE_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Clases cargadas: ${classesMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché clases:", e); }
  }
  if (fs.existsSync(DATA_FILE)) {
    try {
      bookingsMemoryCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Reservas cargadas: ${bookingsMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché reservas:", e); }
  }
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      historyMemoryCache = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Historial cargado: ${historyMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché historial:", e); }
  }
  if (fs.existsSync(INCIDENTS_FILE)) {
    try {
      incidentsMemoryCache = JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf8') || '[]');
      console.log(`✅ [CACHE] Incidencias cargadas: ${incidentsMemoryCache.length}`);
    } catch (e) { console.error("Error lectura caché incidencias:", e); }
  }
};
loadCache();

// --- PERSISTENCE HELPER ---
let isSavingBookings = false;
let hasPendingSave = false;

let isSavingIncidents = false;
let hasPendingSaveIncidents = false;

const saveIncidents = async () => {
  if (isSavingIncidents) {
    hasPendingSaveIncidents = true;
    return;
  }
  isSavingIncidents = true;

  try {
    await fs.promises.writeFile(INCIDENTS_FILE, JSON.stringify(incidentsMemoryCache, null, 2));
  } catch (e) {
    console.error("❌ Error guardando incidencias:", e);
  } finally {
    isSavingIncidents = false;
    if (hasPendingSaveIncidents) {
      hasPendingSaveIncidents = false;
      saveIncidents();
    }
  }
};

const saveBookings = async () => {
  if (isSavingBookings) {
    hasPendingSave = true;
    return;
  }
  isSavingBookings = true;

  try {
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(bookingsMemoryCache, null, 2));
  } catch (e) {
    console.error("❌ Error guardando reservas:", e);
  } finally {
    isSavingBookings = false;
    if (hasPendingSave) {
      hasPendingSave = false;
      saveBookings();
    }
  }
};

const logAccess = async (user, action, details = '') => {
  try {
    const now = new Date();
    const entry = {
      timestamp: now.getTime(),
      date: format(now, 'dd/MM/yyyy'),
      time: format(now, 'HH:mm:ss'),
      userId: user.id || user.email,
      userName: user.name,
      email: user.email,
      role: user.role,
      action: action,
      details: details
    };

    // Append to file (NDJSON format)
    await fs.promises.appendFile(ACCESS_LOGS_FILE, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error("Error logging access:", e);
  }
};

let isSavingHistory = false;
let hasPendingSaveHistory = false;

const saveHistory = async () => {
  if (isSavingHistory) {
    hasPendingSaveHistory = true;
    return;
  }
  isSavingHistory = true;

  try {
    await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(historyMemoryCache, null, 2));
  } catch (e) {
    console.error("❌ Error guardando historial:", e);
  } finally {
    isSavingHistory = false;
    if (hasPendingSaveHistory) {
      hasPendingSaveHistory = false;
      saveHistory();
    }
  }
};

// --- EXTERNAL DATA SYNC (VIA SOCKET) ---
let prismaSocket = null;

const processExternalUsers = (externalUsers) => {
  if (!Array.isArray(externalUsers)) return;

  console.log(`🔄 [SYNC] Procesando ${externalUsers.length} usuarios recibidos. Modo: ${syncTarget}`);

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

  // Update Teachers if target is ALL or TEACHERS
  if ((syncTarget === 'ALL' || syncTarget === 'TEACHERS') && allowedTeachers.length > 0) {
    allowedTeachers.sort((a, b) => a.name.localeCompare(b.name));
    usersMemoryCache = allowedTeachers;
    updateUsersMap();
    fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(allowedTeachers, null, 2));
    console.log(`✅ [SYNC] ÉXITO: ${allowedTeachers.length} usuarios (profesores/admin) sincronizados.`);
  }

  // Update Students if target is ALL or STUDENTS
  if ((syncTarget === 'ALL' || syncTarget === 'STUDENTS') && allowedStudents.length > 0) {
    allowedStudents.sort((a, b) => a.name.localeCompare(b.name));
    studentsMemoryCache = allowedStudents;
    fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(allowedStudents, null, 2));
    console.log(`✅ [SYNC] ÉXITO: ${allowedStudents.length} alumnos sincronizados.`);
  }

  // Reset sync target to default for future automatic updates
  syncTarget = 'ALL';
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
    fs.writeFileSync(CLASSES_CACHE_FILE, JSON.stringify(cleanClasses, null, 2));
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

app.get('/api/admin/force-sync', requireAdmin, (req, res) => {
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

app.post('/api/admin/sync', requireAdmin, (req, res) => {
  const { target } = req.body;
  if (target === 'TEACHERS' || target === 'STUDENTS') {
    syncTarget = target;
  } else {
    syncTarget = 'ALL';
  }

  console.log(`🔄 [ADMIN] Iniciando sincronización manual. Objetivo: ${syncTarget}`);

  if (prismaSocket) {
    prismaSocket.disconnect();
    prismaSocket.connect();
    res.json({ success: true, message: `Sincronización de ${syncTarget} iniciada.` });
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
    const user = usersEmailMap.get(payload.email.toLowerCase());
    if (user) {
      // Crear cookie SSO tras login Google exitoso
      if (process.env.ENABLE_GLOBAL_SSO === 'true') {
        const rawRole = (user.role || 'TEACHER').toUpperCase();
        const ssoRole = rawRole === 'TUTOR' ? 'TEACHER' : rawRole;
        const ssoPayload = { userId: user.id, email: payload.email.toLowerCase(), role: ssoRole, profileId: user.id };
        const ssoToken = jwt.sign(ssoPayload, process.env.JWT_SSO_SECRET || 'fallback-secret', { expiresIn: '8h' });
        res.cookie('BIBLIO_SSO_TOKEN', ssoToken, {
          domain: process.env.COOKIE_DOMAIN || '.bibliohispa.es',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 8 * 60 * 60 * 1000
        });
      }
      logAccess(user, 'LOGIN_GOOGLE');
      return res.json({ success: true, ...user });
    }
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

    const userEmail = (extUser.email || extUser.correo || cleanEmail).toLowerCase();
    const userId = extUser.id || cleanEmail;

    // Crear cookie SSO directamente (en vez de retransmitir de PrismaEdu)
    if (process.env.ENABLE_GLOBAL_SSO === 'true') {
      const ssoRole = rawRole === 'TUTOR' ? 'TEACHER' : rawRole;
      const ssoPayload = { userId, email: userEmail, role: ssoRole, profileId: userId };
      const ssoToken = jwt.sign(ssoPayload, process.env.JWT_SSO_SECRET || 'fallback-secret', { expiresIn: '8h' });
      res.cookie('BIBLIO_SSO_TOKEN', ssoToken, {
        domain: process.env.COOKIE_DOMAIN || '.bibliohispa.es',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 8 * 60 * 60 * 1000
      });
    }

    const appUser = {
      id: userId,
      name: extUser.name || extUser.nombre || extUser.full_name || 'Usuario',
      email: userEmail,
      role: appRole
    };
    logAccess(appUser, 'LOGIN_EXTERNAL');

    return res.json({
      success: true,
      role: appRole,
      name: appUser.name,
      id: userId,
      email: userEmail
    });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Error de conexión' });
  }
});

app.get('/api/proxy/me', (req, res) => {
  const token = req.cookies.BIBLIO_SSO_TOKEN;
  if (!token) return res.status(401).json({ success: false, message: 'No SSO session' });
  try {
    const JWT_SSO_SECRET = process.env.JWT_SSO_SECRET || 'fallback-secret';
    const decoded = jwt.verify(token, JWT_SSO_SECRET);

    // Rellenamos desde la caché local para obtener nombre y role real en la app
    const cleanEmail = (decoded.email || decoded.userId || '').toLowerCase();
    const localUser = usersEmailMap.get(cleanEmail);

    if (localUser) {
      logAccess(localUser, 'SESSION_RESTORE');
      return res.json({ success: true, user: localUser });
    }

    const fallbackUser = { id: decoded.userId, name: decoded.name || decoded.userId, email: decoded.email, role: decoded.role };
    logAccess(fallbackUser, 'SESSION_RESTORE', 'Fallback from Token');

    return res.json({
      success: true,
      user: fallbackUser
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// SSO Logout — clears the shared SSO cookie
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('BIBLIO_SSO_TOKEN', {
    domain: process.env.COOKIE_DOMAIN || '.bibliohispa.es',
    path: '/'
  });
  res.json({ success: true });
});

app.get('/api/teachers', (req, res) => {
  const sorted = [...usersMemoryCache].sort((a, b) => a.name.localeCompare(b.name));
  res.json(sorted);
});
app.get('/api/students', (req, res) => {
  const sorted = [...studentsMemoryCache].sort((a, b) => a.name.localeCompare(b.name));
  res.json(sorted);
});
app.get('/api/classes', (req, res) => res.json(classesMemoryCache));
app.get('/api/bookings', (req, res) => {
  res.json(bookingsMemoryCache);
});

app.post('/api/bookings', (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [req.body];

    // --- VALIDATION: Prevent past bookings for non-admins ---
    if (incoming.length > 0) {
      const userEmail = incoming[0].teacherEmail;
      const user = usersEmailMap.get(userEmail ? userEmail.toLowerCase() : '');
      // If user is not found or not ADMIN, apply restriction
      if (!user || user.role !== 'ADMIN') {
        const now = new Date();
        // Local date string construction YYYY-MM-DD
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentDay = String(now.getDate()).padStart(2, '0');
        const todayLocalStr = `${currentYear}-${currentMonth}-${currentDay}`;

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeVal = currentHour * 60 + currentMinute;

        for (const item of incoming) {
          if (item.date < todayLocalStr) {
            return res.status(403).json({ error: 'No se permiten reservas en días pasados.' });
          }

          if (item.date === todayLocalStr) {
            const slotId = item.slotId;
            const stage = item.stage;

            let slotDef;
            if (stage === 'PRIMARIA') {
              slotDef = SLOTS_PRIMARY.find(s => s.id === slotId);
            } else {
              slotDef = SLOTS_SECONDARY.find(s => s.id === slotId);
            }

            if (slotDef) {
              const [eHour, eMinute] = slotDef.end.split(':').map(Number);
              const slotEndVal = eHour * 60 + eMinute;

              if (currentTimeVal >= slotEndVal) {
                return res.status(403).json({ error: 'No se permiten reservas en horas pasadas.' });
              }
            }
          }
        }
      }
    }
    // --------------------------------------------------------

    for (const item of incoming) {
      const incomingResource = item.resource || 'ROOM';
      if (bookingsMemoryCache.some(b => b.date === item.date && b.slotId === item.slotId && b.stage === item.stage && (b.resource || 'ROOM') === incomingResource)) {
        return res.status(409).json({ error: 'Conflict' });
      }
    }
    bookingsMemoryCache.push(...incoming);
    saveBookings();

    if (incoming[0]?.logs?.[0]) {
      historyMemoryCache.push(incoming[0].logs[0]);
      if (historyMemoryCache.length > 1000) historyMemoryCache = historyMemoryCache.slice(-1000);
      saveHistory();
    }

    io.emit('server:bookings_updated', bookingsMemoryCache);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/bookings/:id', (req, res) => {
  try {
    const index = bookingsMemoryCache.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    // Update fields (preserving ID and potentially other immutable fields if needed)
    bookingsMemoryCache[index] = { ...bookingsMemoryCache[index], ...req.body, id: req.params.id };

    saveBookings();
    io.emit('server:bookings_updated', bookingsMemoryCache);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/bookings/:id', (req, res) => {
  const target = bookingsMemoryCache.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });

  if (req.body.deleteSeries) {
    const targetDateStr = target.date;
    const targetDay = new Date(targetDateStr).getUTCDay();

    const toDeleteIds = bookingsMemoryCache.filter(b => {
      if (b.teacherEmail !== target.teacherEmail) return false;
      if (b.slotId !== target.slotId) return false;
      if (b.stage !== target.stage) return false;
      if ((b.resource || 'ROOM') !== (target.resource || 'ROOM')) return false;

      if (b.date < targetDateStr) return false;

      const bDay = new Date(b.date).getUTCDay();
      return bDay === targetDay;
    }).map(b => b.id);

    const toDeleteSet = new Set(toDeleteIds);
    bookingsMemoryCache = bookingsMemoryCache.filter(b => !toDeleteSet.has(b.id));

    if (req.body.user) {
      historyMemoryCache.push({
        action: 'DELETED_SERIES',
        user: req.body.user.email,
        userName: req.body.user.name,
        timestamp: Date.now(),
        details: `Eliminada serie de reservas de ${target.teacherName} desde ${target.date}`
      });
      if (historyMemoryCache.length > 1000) historyMemoryCache = historyMemoryCache.slice(-1000);
      saveHistory();
    }
  } else {
    bookingsMemoryCache = bookingsMemoryCache.filter(b => b.id !== req.params.id);

    if (req.body.user) {
      historyMemoryCache.push({ action: 'DELETED', user: req.body.user.email, userName: req.body.user.name, timestamp: Date.now(), details: `Eliminada reserva de ${target.teacherName}` });
      if (historyMemoryCache.length > 1000) historyMemoryCache = historyMemoryCache.slice(-1000);
      saveHistory();
    }
  }

  saveBookings();
  io.emit('server:bookings_updated', bookingsMemoryCache);
  res.json({ success: true });
});

app.get('/api/incidents', (req, res) => {
  res.json([...incidentsMemoryCache].sort((a, b) => b.timestamp - a.timestamp));
});

app.post('/api/incidents', (req, res) => {
  try {
    const newIncident = req.body;

    // Ensure ID and timestamp
    newIncident.id = newIncident.id || Math.random().toString(36).substr(2, 9);
    newIncident.timestamp = newIncident.timestamp || Date.now();

    incidentsMemoryCache.push(newIncident);
    saveIncidents();

    io.emit('server:incidents_updated', incidentsMemoryCache);
    res.status(201).json({ success: true, incident: newIncident });
  } catch (e) { res.status(500).json({ error: 'Error saving incident' }); }
});

app.patch('/api/incidents/:id', (req, res) => {
  try {
    const index = incidentsMemoryCache.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    incidentsMemoryCache[index] = { ...incidentsMemoryCache[index], ...req.body };
    saveIncidents();

    io.emit('server:incidents_updated', incidentsMemoryCache);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error updating incident' }); }
});

app.get('/api/history', (req, res) => {
  res.json([...historyMemoryCache].sort((a, b) => b.timestamp - a.timestamp));
});

app.get('/api/admin/test-email', requireAdmin, async (req, res) => {
  try {
    console.log('🧪 [ADMIN] Iniciando prueba de email...');
    const result = await reportService.sendWeeklyReport();
    res.json({ success: true, message: 'Proceso de reporte ejecutado.', result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- BOOKING SWAP ENDPOINTS ---

app.post('/api/bookings/request-swap', async (req, res) => {
  try {
    const { bookingId, reason, requesterEmail, requesterName, slotLabel, resourceName } = req.body;
    const booking = bookingsMemoryCache.find(b => b.id === bookingId);

    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Encode params
    const token = Buffer.from(bookingId).toString('base64');
    const reqEmailEncoded = Buffer.from(requesterEmail).toString('base64');
    const labelEncoded = Buffer.from(slotLabel || booking.slotId).toString('base64');
    const resourceEncoded = Buffer.from(resourceName || booking.resource).toString('base64');

    const confirmLink = `${baseUrl}/api/bookings/swap/confirm?token=${token}&requester=${reqEmailEncoded}&label=${labelEncoded}&resource=${resourceEncoded}`;

    const bookingInfo = {
      date: booking.date,
      slotLabel: slotLabel || booking.slotId,
      resourceName: resourceName || booking.resource
    };

    await reportService.sendSwapRequestEmail(booking.teacherEmail, requesterName, requesterEmail, reason, bookingInfo, confirmLink);

    res.json({ success: true });
  } catch (e) {
    console.error("Error swapping", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bookings/swap/confirm', async (req, res) => {
  try {
    const { token, requester, label, resource } = req.query;
    if (!token || !requester) return res.status(400).send("Enlace inválido");

    const bookingId = Buffer.from(token, 'base64').toString('utf8');
    const requesterEmail = Buffer.from(requester, 'base64').toString('utf8');
    const slotLabel = label ? Buffer.from(label, 'base64').toString('utf8') : null;
    const resourceName = resource ? Buffer.from(resource, 'base64').toString('utf8') : null;

    const bookingIndex = bookingsMemoryCache.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) {
      return res.send("<h1>La reserva ya no existe o ya ha sido eliminada.</h1>");
    }

    const booking = bookingsMemoryCache[bookingIndex];
    const ownerName = booking.teacherName;

    // Delete booking
    bookingsMemoryCache.splice(bookingIndex, 1);
    saveBookings();
    io.emit('server:bookings_updated', bookingsMemoryCache);

    // Log history
    historyMemoryCache.push({
      action: 'DELETED',
      user: booking.teacherEmail,
      userName: booking.teacherName,
      timestamp: Date.now(),
      details: `Reserva cedida a solicitud de ${requesterEmail}`
    });
    saveHistory();

    const bookingInfo = {
      date: booking.date,
      slotLabel: slotLabel || booking.slotId,
      resourceName: resourceName || booking.resource
    };

    await reportService.sendSwapReleasedEmail(requesterEmail, ownerName, bookingInfo);

    res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">¡Reserva Cedida con Éxito!</h1>
                <p>La reserva ha sido eliminada y se ha notificado al compañero/a.</p>
                <p>Ya puedes cerrar esta ventana.</p>
            </div>
        `);

  } catch (e) {
    console.error("Error confirming swap", e);
    res.status(500).send("Error interno del servidor");
  }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Iniciar planificador de tareas
reportService.initScheduler();

server.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
