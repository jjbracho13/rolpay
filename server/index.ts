import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import registrosRoutes from './routes/registros.js';
import conceptosRoutes from './routes/conceptos.js';
import adminRoutes from './routes/admin.js';
import { authMiddleware, AuthRequest } from './middleware/auth.js';
import db from './db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un momento.' },
});

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://rolpay.onrender.com',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:3000',
];
if (process.env.ALLOWED_ORIGINS) {
  ALLOWED_ORIGINS.push(...process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Configure multer
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.userId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  },
});

// Protected uploads - requires auth
app.use('/uploads', authMiddleware, (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, express.static(uploadsDir));

// Kill old service workers
const CLEANUP_SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.registration.unregister())
    .then(() => self.clients.matchAll())
    .then(clients => {
      for (const c of clients) { c.navigate(c.url); }
    })
  );
});
`;
app.get('/sw.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(CLEANUP_SW);
});
app.get('/registerSW.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(CLEANUP_SW);
});
app.get('/rolpay-nuke-sw.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'no-store');
  res.send(CLEANUP_SW);
});

// Auth routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/config', apiLimiter, configRoutes);
app.use('/api/registros', apiLimiter, registrosRoutes);
app.use('/api/conceptos', apiLimiter, conceptosRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

app.get('/api/user', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

app.put('/api/user', authMiddleware, (req: AuthRequest, res) => {
  const { nombre, cedula, cargo } = req.body;

  function trimStr(s: any, max: number): string {
    return typeof s === 'string' ? s.trim().slice(0, max) : '';
  }

  if (nombre !== undefined) {
    const trimmed = trimStr(nombre, 100);
    if (!trimmed) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').run(trimmed, req.userId);
  }
  if (cedula !== undefined) {
    db.prepare('UPDATE usuarios SET cedula = ? WHERE id = ?').run(trimStr(cedula, 20), req.userId);
  }
  if (cargo !== undefined) {
    db.prepare('UPDATE usuarios SET cargo = ? WHERE id = ?').run(trimStr(cargo, 100), req.userId);
  }

  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  res.json(user);
});

// Photo upload
app.post('/api/user/photo', authMiddleware, upload.single('foto'), (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó imagen' });
  }

  const ext = path.extname(req.file.originalname);
  const fotoPath = `/uploads/user_${req.userId}${ext}`;
  const finalPath = path.join(uploadsDir, `user_${req.userId}${ext}`);

  const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
  for (const e of extensions) {
    const oldPath = path.join(uploadsDir, `user_${req.userId}${e}`);
    if (oldPath !== finalPath && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  db.prepare('UPDATE usuarios SET foto_perfil = ? WHERE id = ?').run(fotoPath, req.userId);

  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId) as any;
  user.foto_perfil = `${fotoPath}?t=${Date.now()}`;
  res.json(user);
});

// Delete photo
app.delete('/api/user/photo', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT foto_perfil FROM usuarios WHERE id = ?').get(req.userId) as any;

  if (user?.foto_perfil) {
    const cleanPath = user.foto_perfil.split('?')[0];
    const filename = path.basename(cleanPath);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const ext = path.extname(filename);
    const base = filename.replace(ext, '');
    for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
      if (e !== ext) {
        const altPath = path.join(uploadsDir, base + e);
        if (fs.existsSync(altPath)) fs.unlinkSync(altPath);
      }
    }
    db.prepare('UPDATE usuarios SET foto_perfil = ? WHERE id = ?').run('', req.userId);
  }

  const updated = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  res.json(updated);
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath, { maxAge: 0, etag: false, lastModified: false }));
app.get('/{*splat}', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor RolPay corriendo en http://localhost:${PORT}`);
});

// Keep-alive
if (process.env.NODE_ENV === 'production') {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://rolpay.onrender.com';
  setInterval(async () => {
    try {
      await fetch(`${RENDER_URL}/api/user`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}
  }, 14 * 60 * 1000);
}
