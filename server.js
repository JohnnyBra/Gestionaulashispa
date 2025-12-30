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

// URL Base de la API Centralizada
const EXTERNAL_API_BASE = 'https://prisma.bibliohispa.es';

// Headers específicos para identificarnos ante Cloudflare
// NOTA: En Cloudflare WAF -> Custom Rules, puedes crear una regla:
// IF User-Agent contains "HispanidadReservas-Server" THEN Skip WAF/Super Bot Fight Mode
const PROXY_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'HispanidadReservas-Server/1.0', 
  'Origin': 'https://prisma.bibliohispa.es',
  'Referer': 'https://prisma.bibliohispa.es/'
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE"] }
});

app.use(cors());
app.use(express.json());

// --- MEMORY CACHE ---
let usersMemoryCache = [];

// Inicializar caché desde disco si existe
if (fs.existsSync(USERS_CACHE_FILE)) {
  try {
    usersMemoryCache = JSON.parse(fs.readFileSync(USERS_CACHE_FILE, 'utf8') || '[]');
  } catch (e) {
    console.error("Error leyendo caché local:", e);
  }
}

// --- EXTERNAL DATA SYNC ---
const syncUsers = async () => {
  try {
    // Intentamos ruta estándar si /export/ no funciona
    const targetUrl = `${EXTERNAL_API_BASE}/api/users`; 
    console.log(`[SYNC] Sincronizando profesores desde ${targetUrl}...`);
    
    const response = await fetch(targetUrl, { headers: PROXY_HEADERS });
    
    if (!response.ok) {
        console.warn(`[SYNC] Ruta principal falló (${response.status})...`);
    } else {
        const users = await response.json();
        usersMemoryCache = users;
        fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(users, null, 2));
        console.log(`[SYNC] ${users.length} profesores actualizados.`);
        return; // Éxito
    }
  } catch (err) {
    console.error(`[SYNC] Fallo en sincronización: ${err.message}. Usando caché local.`);
  }
};

// Sincronizar al iniciar y cada 1 hora
syncUsers();
setInterval(syncUsers, 60 * 60 * 1000);

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
 * Endpoint: /api/proxy/login
 * Descripción: Autenticación centralizada
 */
app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  console.log(`[AUTH] Login Proxy: ${cleanEmail}`);

  try {
    // 1. Probamos la ruta estándar de Login (/api/login)
    // Si sigue fallando con 404, prueba: /api/auth/login o consulta al admin de Prisma la ruta exacta.
    const targetUrl = `${EXTERNAL_API_BASE}/api/login`;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: PROXY_HEADERS,
      body: JSON.stringify({ email: cleanEmail, password })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[AUTH ERROR] Estado: ${response.status} en ${targetUrl}`);
      
      // Check si es Cloudflare HTML
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('challenge')) {
         console.error('[AUTH ERROR] Bloqueo de seguridad detectado (Cloudflare/WAF).');
         return res.status(403).json({ 
            success: false, 
            message: 'Cloudflare bloqueó la conexión. Añade la IP del servidor a la Whitelist en Cloudflare > Security > WAF > IP Access Rules.' 
         });
      }

      // Intentar extraer mensaje JSON del error
      let errorMessage = 'Credenciales inválidas.';
      try {
        const jsonError = JSON.parse(responseText);
        if (jsonError.message) errorMessage = jsonError.message;
        if (jsonError.error) errorMessage = jsonError.error;
      } catch (e) {}

      return res.status(401).json({ success: false, message: errorMessage });
    }

    // Parseo de éxito
    let externalUser;
    try {
      externalUser = JSON.parse(responseText);
    } catch (e) {
      console.error('[AUTH ERROR] Respuesta no es JSON válido:', responseText.substring(0, 100));
      return res.status(502).json({ success: false, message: 'Respuesta inválida del servidor externo.' });
    }
    
    // Validar usuario devuelto
    if (!externalUser || !externalUser.role) {
         return res.status(500).json({ success: false, message: 'Datos de usuario incompletos.' });
    }

    // 2. Validación de Roles
    console.log(`[AUTH SUCCESS] Usuario: ${externalUser.name}, Rol: ${externalUser.role}`);

    const allowedRoles = ['teacher', 'direction', 'admin'];
    const userRole = externalUser.role.toLowerCase();

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tu usuario no tiene permisos para reservar aulas.' 
      });
    }

    // 3. Mapeo Roles
    const internalRole = (userRole === 'direction' || userRole === 'admin') ? 'ADMIN' : 'TEACHER';

    res.json({
      success: true,
      user: {
        email: externalUser.email,
        name: externalUser.name,
        role: internalRole
      }
    });

  } catch (err) {
    console.error('[AUTH CRITICAL]', err);
    res.status(503).json({ 
      success: false, 
      message: 'Error de conexión con el servidor de autenticación.' 
    });
  }
});

// Endpoint para obtener lista de profesores
app.get('/api/teachers', (req, res) => {
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
  console.log(`Servidor de Reservas corriendo en puerto ${PORT}`);
  console.log(`Autenticación delegada a: ${EXTERNAL_API_BASE}`);
});