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
// Mantenemos la sincronización de usuarios para el selector de profesores
const syncUsers = async () => {
  try {
    console.log(`[SYNC] Sincronizando profesores desde ${EXTERNAL_API_BASE}...`);
    // Asumimos que la ruta de exportación se mantiene relativa a la base, 
    // si cambia en producción, ajustar aquí.
    const response = await fetch(`${EXTERNAL_API_BASE}/api/export/users`);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const users = await response.json();
    usersMemoryCache = users;
    fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(users, null, 2));
    console.log(`[SYNC] ${users.length} profesores actualizados.`);
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
 * Descripción: Autenticación centralizada contra Prisma Bibliohispa
 * Lógica:
 * 1. Envía credenciales a la API externa.
 * 2. Verifica si el usuario tiene rol 'teacher' o 'direction'.
 * 3. Si no tiene rol válido, devuelve 403.
 * 4. Si es válido, mapea a roles internos (TEACHER/ADMIN) y devuelve la sesión.
 */
app.post('/api/proxy/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Llamada a la API Externa
    const response = await fetch(`${EXTERNAL_API_BASE}/api/external/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      // Si la API externa rechaza (401/404), devolvemos credenciales inválidas
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas o usuario no encontrado.' });
    }

    const externalUser = await response.json();
    
    // 2. Validación Estricta de Roles
    const allowedRoles = ['teacher', 'direction'];
    if (!allowedRoles.includes(externalUser.role)) {
      console.warn(`[AUTH] Acceso denegado para ${email}. Rol detectado: ${externalUser.role}`);
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para reservar aulas.' 
      });
    }

    // 3. Mapeo de Roles Externos -> Internos
    // 'direction' -> ADMIN (Permiso total: bloquear, borrar cualquiera, ver logs)
    // 'teacher'   -> TEACHER (Permiso estándar: reservar, borrar propias)
    const internalRole = externalUser.role === 'direction' ? 'ADMIN' : 'TEACHER';

    // 4. Respuesta Exitosa
    res.json({
      success: true,
      user: {
        email: externalUser.email,
        name: externalUser.name,
        role: internalRole
      }
    });

  } catch (err) {
    console.error('[AUTH] Error de conexión con Prisma:', err);
    res.status(503).json({ 
      success: false, 
      message: 'Error de comunicación con el servidor de autenticación.' 
    });
  }
});

// Endpoint para obtener lista de profesores (usado por Admin en frontend)
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
    
    // Check conflicto básico
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