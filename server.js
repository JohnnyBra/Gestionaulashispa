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

// Headers para simular un navegador real (Chrome) y evitar filtros de bots
const PROXY_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
  // Intentamos varias rutas comunes para obtener usuarios
  const endpoints = ['/api/users', '/api/teachers', '/api/auth/users'];
  
  for (const endpoint of endpoints) {
    try {
      const targetUrl = `${EXTERNAL_API_BASE}${endpoint}`;
      console.log(`[SYNC] Probando: ${targetUrl}...`);
      
      const response = await fetch(targetUrl, { headers: PROXY_HEADERS });
      
      if (response.status === 404) continue; // Ruta incorrecta, probar siguiente

      if (response.ok) {
          const users = await response.json();
          if (Array.isArray(users)) {
            usersMemoryCache = users;
            fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(users, null, 2));
            console.log(`[SYNC] Éxito: ${users.length} profesores actualizados desde ${endpoint}.`);
            return;
          }
      }
    } catch (err) {
      console.warn(`[SYNC] Error conectando a ${endpoint}: ${err.message}`);
    }
  }
  console.log('[SYNC] No se pudo sincronizar con ninguna ruta. Usando caché local.');
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
 * Descripción: Autenticación con estrategia de reintento en múltiples rutas
 */
app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  console.log(`[AUTH] Iniciando login para: ${cleanEmail}`);

  // LISTA DE ENDPOINTS A PROBAR (Prioridad: Ruta confirmada por usuario)
  const candidateEndpoints = [
    '/api/auth/external-check', // Ruta ESPECÍFICA confirmada
    '/api/auth/login',    
    '/api/login'
  ];

  for (const endpoint of candidateEndpoints) {
    const targetUrl = `${EXTERNAL_API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: PROXY_HEADERS,
        body: JSON.stringify({ email: cleanEmail, password })
      });

      // Si devuelve 404, es que la ruta no existe en el servidor remoto.
      // Continuamos al siguiente endpoint del bucle.
      if (response.status === 404) {
        console.warn(`[AUTH] Ruta fallida (404): ${endpoint}`);
        continue; 
      }

      // Si llegamos aquí, el servidor respondió
      const responseText = await response.text();

      // Chequeo de seguridad Cloudflare (Captcha/Challenge)
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('challenge-platform')) {
         console.error(`[AUTH] WAF Bloqueó la petición en ${endpoint}`);
         return res.status(403).json({ 
            success: false, 
            message: 'El sistema de seguridad (WAF) está bloqueando la conexión. Verifica la Whitelist de IP.' 
         });
      }

      if (!response.ok) {
        // Es un error de credenciales (401) o permisos (403), pero la ruta EXISTE.
        let errorMessage = 'Credenciales inválidas.';
        try {
          const jsonError = JSON.parse(responseText);
          errorMessage = jsonError.message || jsonError.error || errorMessage;
        } catch (e) {}
        
        console.log(`[AUTH] Fallo de credenciales en ${endpoint}: ${errorMessage}`);
        return res.status(401).json({ success: false, message: errorMessage });
      }

      // --- ÉXITO (200 OK) ---
      let externalUser;
      try {
        externalUser = JSON.parse(responseText);
      } catch (e) {
        console.error('[AUTH ERROR] JSON inválido:', responseText.substring(0, 50));
        return res.status(502).json({ success: false, message: 'Respuesta inválida del servidor.' });
      }

      // Validar usuario
      if (!externalUser || !externalUser.role) {
         return res.status(500).json({ success: false, message: 'Datos de usuario incompletos recibidos.' });
      }

      console.log(`[AUTH SUCCESS] Login correcto en ${endpoint}. Usuario: ${externalUser.name}`);

      // Mapeo de Roles
      const allowedRoles = ['teacher', 'direction', 'admin'];
      const userRole = externalUser.role.toLowerCase();

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ success: false, message: 'No tienes permisos para acceder.' });
      }

      const internalRole = (userRole === 'direction' || userRole === 'admin') ? 'ADMIN' : 'TEACHER';

      return res.json({
        success: true,
        user: {
          email: externalUser.email,
          name: externalUser.name,
          role: internalRole
        }
      });

    } catch (err) {
      console.error(`[AUTH] Error de red en ${endpoint}:`, err.message);
    }
  }

  console.error('[AUTH] Ningún endpoint respondió correctamente.');
  res.status(404).json({ 
    success: false, 
    message: 'No se pudo conectar con el servicio de autenticación (Rutas no encontradas).' 
  });
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