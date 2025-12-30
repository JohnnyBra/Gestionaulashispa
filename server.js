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

// --- CONFIGURACIÓN EXTERNA ---
const EXTERNAL_API_BASE = 'https://prisma.bibliohispa.es';
// CLAVE SECRETA PROPORCIONADA
const API_SECRET = process.env.API_SECRET || 'YOUR_API_SECRET'; 

// Headers base (Simulación de navegador + API Secret)
const PROXY_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'api_secret': API_SECRET // Requerido por la API externa
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE"] }
});

app.use(cors());
app.use(express.json());

// --- MEMORY CACHE ---
let usersMemoryCache = [];

// Carga inicial con diagnóstico
if (fs.existsSync(USERS_CACHE_FILE)) {
  try {
    const rawData = fs.readFileSync(USERS_CACHE_FILE, 'utf8');
    usersMemoryCache = JSON.parse(rawData || '[]');
    console.log(`✅ [SISTEMA] Caché de usuarios cargada desde disco. Total: ${usersMemoryCache.length} profesores.`);
  } catch (e) {
    console.error("❌ [ERROR] Error leyendo archivo de usuarios local:", e.message);
  }
} else {
  console.warn("⚠️ [SISTEMA] No existe archivo 'users_cache.json'. Se creará tras la primera sincronización.");
}

// --- EXTERNAL DATA SYNC ---
const syncUsers = async () => {
  const targetUrl = `${EXTERNAL_API_BASE}/api/export/users`;
  console.log(`🔄 [SYNC] Conectando con Prisma para actualizar usuarios...`);

  try {
    const response = await fetch(targetUrl, { 
        method: 'GET',
        headers: PROXY_HEADERS 
    });

    if (!response.ok) {
        console.warn(`⚠️ [SYNC] Falló la petición (${response.status}). Manteniendo caché anterior.`);
        return;
    }

    const externalUsers = await response.json();

    if (Array.isArray(externalUsers)) {
      // Mapear datos externos a formato interno
      const mappedUsers = externalUsers.map(u => ({
        name: u.nombre || u.name || 'Desconocido',
        // Normalizamos emails a minúsculas para evitar errores
        email: (u.email || (u.id && u.id.includes('@') ? u.id : `${u.nombre?.replace(/\s+/g, '.').toLowerCase()}@colegiolahispanidad.es`)).toLowerCase(),
        role: (u.role === 'TUTOR' || u.rol === 'TUTOR') ? 'TEACHER' : (u.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'),
        originalId: u.id
      }));

      usersMemoryCache = mappedUsers;
      fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(mappedUsers, null, 2));
      console.log(`✅ [SYNC] Sincronización completada. Usuarios activos: ${mappedUsers.length}`);
    } else {
      console.warn('⚠️ [SYNC] La respuesta de Prisma no es una lista válida.');
    }

  } catch (err) {
    console.error(`❌ [SYNC] Error de conexión: ${err.message}`);
  }
};

// Sincronizar al iniciar y cada 1 hora
syncUsers();
setInterval(syncUsers, 60 * 60 * 1000);

// --- HELPERS DATOS LOCALES ---
const readBookings = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
};

const appendToHistory = (actionLog) => {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
  }
  history.push(actionLog);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
};

// --- API ENDPOINTS ---

/**
 * Endpoint: /api/auth/google
 * Descripción: Verifica token de Google Y comprueba que el email exista en la lista de Prisma.
 */
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'Falta el token.' });

  try {
    // 1. Validar el token con Google
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    
    if (!googleRes.ok) {
        return res.status(401).json({ success: false, message: 'Token de Google inválido.' });
    }

    const payload = await googleRes.json();
    const googleEmail = payload.email.toLowerCase(); // Normalizamos el email de Google

    console.log(`🔐 [AUTH GOOGLE] Intento de acceso: ${googleEmail}`);

    if (!googleEmail) return res.status(400).json({ success: false, message: 'El token no contiene email.' });

    // 2. SEGURIDAD: Comprobar si este email está en nuestra lista sincronizada
    // Buscamos coincidencia exacta de email
    const existingUser = usersMemoryCache.find(u => u.email === googleEmail);

    if (existingUser) {
        console.log(`✅ [AUTH GOOGLE] Acceso PERMITIDO: ${existingUser.name} (${existingUser.role})`);
        return res.json({
            success: true,
            user: existingUser 
        });
    } else {
        console.warn(`⛔ [AUTH GOOGLE] Acceso DENEGADO: ${googleEmail}`);
        console.warn(`   Motivo: El email es válido en Google pero NO está en la lista de ${usersMemoryCache.length} profesores de Prisma.`);
        
        // Debug extra: Ver si existe un usuario similar (para detectar errores de tecleo en Prisma)
        const similar = usersMemoryCache.find(u => u.name.toLowerCase().includes(googleEmail.split('@')[0]) || googleEmail.includes(u.name.split(' ')[0].toLowerCase()));
        if (similar) {
            console.warn(`   ¿Quizás es este usuario en Prisma?: ${similar.name} (${similar.email})`);
        }

        return res.status(403).json({ 
            success: false, 
            message: 'Acceso denegado: Tu cuenta de Google no corresponde a un profesor activo en PrismaEdu.' 
        });
    }

  } catch (e) {
      console.error('❌ [AUTH GOOGLE ERROR]', e);
      res.status(500).json({ success: false, message: 'Error interno verificando Google.' });
  }
});

/**
 * Endpoint: /api/proxy/login
 * Target: POST /api/auth/external-check
 */
app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  console.log(`🔑 [AUTH PASS] Login tradicional: ${cleanEmail}`);

  const targetUrl = `${EXTERNAL_API_BASE}/api/auth/external-check`;
  
  try {
    const payload = {
        username: cleanEmail, 
        email: cleanEmail,    
        password: password
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: PROXY_HEADERS,
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (responseText.includes('<!DOCTYPE html>') || responseText.includes('challenge')) {
         console.error(`❌ [AUTH ERROR] WAF/Cloudflare bloqueó la petición.`);
         return res.status(403).json({ success: false, message: 'Bloqueo de seguridad (WAF).' });
    }

    if (!response.ok) {
      let errorMessage = 'Credenciales inválidas.';
      try {
        const jsonError = JSON.parse(responseText);
        errorMessage = jsonError.message || jsonError.error || errorMessage;
      } catch (e) {}
      return res.status(401).json({ success: false, message: errorMessage });
    }

    let externalUser;
    try {
      externalUser = JSON.parse(responseText);
    } catch (e) {
      return res.status(502).json({ success: false, message: 'Respuesta inválida del servidor.' });
    }

    let finalUser = {
        email: externalUser.email || cleanEmail,
        name: externalUser.name || externalUser.nombre || 'Usuario',
        role: 'TEACHER'
    };

    const rawRole = (externalUser.role || externalUser.rol || '').toUpperCase();
    if (rawRole === 'ADMIN' || rawRole === 'DIRECTION') {
        finalUser.role = 'ADMIN';
    } else {
        finalUser.role = 'TEACHER'; 
    }
    
    console.log(`✅ [AUTH SUCCESS] ${finalUser.email} (${finalUser.role})`);

    return res.json({
      success: true,
      user: finalUser
    });

  } catch (err) {
    console.error('❌ [AUTH CRITICAL]', err.message);
    res.status(503).json({ success: false, message: 'Error de conexión con servidor de autenticación.' });
  }
});

app.get('/api/teachers', (req, res) => {
  // Debug: Ver quién consulta la lista
  // console.log(`[API] Solicitud de lista de profesores. Enviando ${usersMemoryCache.length} registros.`);
  res.json(usersMemoryCache);
});

app.get('/api/bookings', (req, res) => {
  res.json(readBookings());
});

app.get('/api/history', (req, res) => {
  if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
  history.sort((a, b) => b.timestamp - a.timestamp);
  res.json(history);
});

app.post('/api/bookings', (req, res) => {
  try {
    const incomingData = req.body;
    let bookings = readBookings();
    const items = Array.isArray(incomingData) ? incomingData : [incomingData];
    
    for (const item of items) {
       if (bookings.some(b => b.date === item.date && b.slotId === item.slotId && b.stage === item.stage)) {
         return res.status(409).json({ error: 'Conflict' });
       }
    }

    bookings.push(...items);
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));

    items.forEach(b => {
      if (b.logs && b.logs.length > 0) appendToHistory(b.logs[0]);
    });
    
    io.emit('server:bookings_updated', bookings);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  let bookings = readBookings();
  const bookingToDelete = bookings.find(b => b.id === id);

  if (!bookingToDelete) return res.status(404).json({ error: 'Not found' });

  bookings = bookings.filter(b => b.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));

  appendToHistory({
    action: 'DELETED',
    user: user.email,
    userName: user.name,
    timestamp: Date.now(),
    details: `Eliminada reserva de ${bookingToDelete.teacherName}: ${bookingToDelete.date}`
  });
  
  io.emit('server:bookings_updated', bookings);
  res.status(200).json({ success: true });
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(PORT, () => {
  console.log(`🚀 Servidor de Reservas corriendo en puerto ${PORT}`);
  console.log(`📡 Autenticación apuntando a: ${EXTERNAL_API_BASE}`);
});