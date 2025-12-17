const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
// Se usa el puerto definido en el entorno o el 3001 por defecto
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Crear servidor HTTP y adjuntar Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Ajustar en producción si es necesario
    methods: ["GET", "POST", "DELETE"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- SOCKET.IO CONNECTION ---
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// --- CONFIGURATION MANAGEMENT ---
const DEFAULT_CONFIG = {
  adminPassword: "adminhispanidad"
};

const readConfig = () => {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data || JSON.stringify(DEFAULT_CONFIG));
  } catch (err) {
    console.error("Error parsing config.json:", err);
    return DEFAULT_CONFIG;
  }
};

const saveConfig = (newConfig) => {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
};

// --- DATA MANAGEMENT ---
const readBookings = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error("Error parsing bookings.json:", err);
    return [];
  }
};

// --- AUDIT HISTORY MANAGEMENT ---
const appendToHistory = (actionLog) => {
    try {
        let history = [];
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
        }
        history.push(actionLog);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        console.log(`[AUDIT] Action recorded: ${actionLog.action} by ${actionLog.user}`);
    } catch (err) {
        console.error("Error writing to history.json:", err);
    }
};

const readHistory = () => {
    if (!fs.existsSync(HISTORY_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error("Error parsing history.json:", err);
        return [];
    }
};

// --- BACKUP SYSTEM ---
const performBackup = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR);
    }

    if (fs.existsSync(DATA_FILE)) {
      const date = new Date();
      const timestamp = date.toISOString().replace(/T/, '-').replace(/:/g, '').split('.')[0];
      const backupFilename = `bookings-${timestamp}.json`;
      const destination = path.join(BACKUP_DIR, backupFilename);

      fs.copyFileSync(DATA_FILE, destination);
      console.log(`[BACKUP] Copia creada: ${backupFilename}`);
      cleanOldBackups();
    }
  } catch (err) {
    console.error('[BACKUP] Error:', err);
  }
};

const cleanOldBackups = () => {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const sortedFiles = files.map(file => {
            const filepath = path.join(BACKUP_DIR, file);
            return {
                name: file,
                time: fs.statSync(filepath).mtime.getTime(),
                path: filepath
            };
        }).sort((a, b) => b.time - a.time);

        if (sortedFiles.length > 30) {
            const filesToDelete = sortedFiles.slice(30);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
            });
        }
    } catch (err) {
        console.error('[BACKUP] Error limpieza:', err);
    }
};

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(performBackup, TWENTY_FOUR_HOURS);
setTimeout(performBackup, 5000); 

// --- API Endpoints ---

// Auth: Admin Login
app.post('/api/auth/admin', (req, res) => {
  const { password } = req.body;
  const config = readConfig();
  
  if (password === config.adminPassword) {
    res.json({ 
      success: true, 
      user: { 
        email: 'direccion@colegiolahispanidad.es', 
        name: 'Administración', 
        role: 'ADMIN' 
      } 
    });
  } else {
    res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
  }
});

app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const config = readConfig();

  if (currentPassword !== config.adminPassword) {
    return res.status(401).json({ success: false, message: 'La contraseña actual no es correcta.' });
  }

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña es demasiado corta.' });
  }

  config.adminPassword = newPassword;
  saveConfig(config);

  res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
});

// GET: Get all bookings
app.get('/api/bookings', (req, res) => {
  try {
    const bookings = readBookings();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// GET: Get history logs (Admin only in frontend, but endpoint open for simplicity in this demo)
app.get('/api/history', (req, res) => {
    try {
        const history = readHistory();
        // Ordenar por fecha descendente
        history.sort((a, b) => b.timestamp - a.timestamp);
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read history' });
    }
});

// POST: Create a booking (Race Condition Protected)
app.post('/api/bookings', (req, res) => {
  try {
    const incomingData = req.body;
    let bookings = readBookings();
    
    // Normalizar a array para procesar lógica común
    const itemsToProcess = Array.isArray(incomingData) ? incomingData : [incomingData];
    
    // VALIDACIÓN DE CONCURRENCIA
    for (const item of itemsToProcess) {
       const isTaken = bookings.some(b => 
          b.date === item.date && 
          b.slotId === item.slotId && 
          b.stage === item.stage
       );

       if (isTaken) {
         console.warn(`[CONFLICT] Intento de reserva duplicada: ${item.date} - ${item.slotId}`);
         return res.status(409).json({ 
           error: 'Conflict', 
           message: `El hueco ${item.slotId} del día ${item.date} ya ha sido ocupado por otro usuario.` 
         });
       }
    }

    // Si pasamos la validación, guardamos
    bookings.push(...itemsToProcess);
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));

    // REGISTRO EN HISTORIAL (Audit)
    itemsToProcess.forEach(booking => {
        if (booking.logs && booking.logs.length > 0) {
            // Registramos el log inicial (CREATED o BLOCKED)
            const logEntry = booking.logs[0];
            // Aseguramos la estructura ActionLog
            appendToHistory({
                action: logEntry.action,
                user: logEntry.user,
                userName: logEntry.userName,
                timestamp: Date.now(),
                details: logEntry.details || `Reserva: ${booking.date} - ${booking.slotId}`
            });
        }
    });
    
    // NOTIFICAR A TODOS LOS CLIENTES CONECTADOS
    io.emit('server:bookings_updated', bookings);

    res.status(201).json({ message: 'Saved successfully', count: itemsToProcess.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// DELETE: Remove a booking
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.body; // Recibimos info del usuario que elimina

    let bookings = readBookings();
    const initialLength = bookings.length;
    const bookingToDelete = bookings.find(b => b.id === id);

    bookings = bookings.filter(b => b.id !== id);
    
    if (bookings.length === initialLength) {
        return res.status(404).json({ message: 'Booking not found' });
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));

    // REGISTRO EN HISTORIAL (Audit)
    if (bookingToDelete && user) {
        appendToHistory({
            action: 'DELETED',
            user: user.email,
            userName: user.name,
            timestamp: Date.now(),
            details: `Eliminada reserva de ${bookingToDelete.teacherName}: ${bookingToDelete.date} - ${bookingToDelete.slotId} (${bookingToDelete.stage})`
        });
    } else if (bookingToDelete) {
         // Fallback si no viene usuario (ej: llamadas API directas)
         appendToHistory({
            action: 'DELETED',
            user: 'unknown',
            userName: 'Unknown User',
            timestamp: Date.now(),
            details: `Eliminada reserva ID ${id}`
        });
    }
    
    // NOTIFICAR A TODOS LOS CLIENTES CONECTADOS
    io.emit('server:bookings_updated', bookings);

    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// --- STATIC FILES ---
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Usar server.listen en lugar de app.listen para Socket.io
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  readConfig();
  readBookings();
});