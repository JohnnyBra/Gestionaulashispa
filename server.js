const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
// Se usa el puerto definido en el entorno o el 3001 por defecto para evitar conflicto con el 3000
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Middleware
app.use(cors());
app.use(express.json()); // Built-in middleware for JSON

// Request Logger (Helpful for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
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

// --- BACKUP SYSTEM ---
const performBackup = () => {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR);
    }

    if (fs.existsSync(DATA_FILE)) {
      const date = new Date();
      // Format: YYYY-MM-DD-HHmm
      const timestamp = date.toISOString().replace(/T/, '-').replace(/:/g, '').split('.')[0];
      const backupFilename = `bookings-${timestamp}.json`;
      const destination = path.join(BACKUP_DIR, backupFilename);

      fs.copyFileSync(DATA_FILE, destination);
      console.log(`[BACKUP] Copia de seguridad creada exitosamente: ${backupFilename}`);
      
      // Optional: Clean old backups (keep last 30 days)
      cleanOldBackups();
    }
  } catch (err) {
    console.error('[BACKUP] Error al crear la copia de seguridad:', err);
  }
};

const cleanOldBackups = () => {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        // Sort by time, newest first
        const sortedFiles = files.map(file => {
            const filepath = path.join(BACKUP_DIR, file);
            return {
                name: file,
                time: fs.statSync(filepath).mtime.getTime(),
                path: filepath
            };
        }).sort((a, b) => b.time - a.time);

        // Keep only the last 30 backups
        if (sortedFiles.length > 30) {
            const filesToDelete = sortedFiles.slice(30);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`[BACKUP] Eliminada copia antigua: ${file.name}`);
            });
        }
    } catch (err) {
        console.error('[BACKUP] Error limpiando copias antiguas:', err);
    }
};

// Schedule Backup every 24 hours (milliseconds)
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(performBackup, TWENTY_FOUR_HOURS);

// Perform an initial backup on server start if data exists
setTimeout(performBackup, 5000); 


// --- API Endpoints (MUST BE BEFORE STATIC FILES) ---

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

// Auth: Change Password
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

// POST: Create a booking (or multiple)
app.post('/api/bookings', (req, res) => {
  try {
    const data = req.body;
    const bookings = readBookings();
    
    if (Array.isArray(data)) {
        // Batch insert
        bookings.push(...data);
    } else {
        // Single insert
        bookings.push(data);
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    res.status(201).json({ message: 'Saved successfully', count: Array.isArray(data) ? data.length : 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// DELETE: Remove a booking
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    let bookings = readBookings();
    const initialLength = bookings.length;
    bookings = bookings.filter(b => b.id !== id);
    
    if (bookings.length === initialLength) {
        return res.status(404).json({ message: 'Booking not found' });
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// --- STATIC FILES ---
// Serve static files from the current directory
app.use(express.static(__dirname));

// Handle SPA routing - return index.html for any non-API request
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Create default config/data files if they don't exist
  readConfig();
  readBookings();
});