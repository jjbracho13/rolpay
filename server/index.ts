import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import registrosRoutes from './routes/registros.js';
import conceptosRoutes from './routes/conceptos.js';
import { authMiddleware, AuthRequest } from './middleware/auth.js';
import db from './db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Configurar multer para subir fotos
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  },
});

app.use(cors());
app.use(express.json());

// Servir archivos estáticos (fotos) - sin caché
app.use('/uploads', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, express.static(uploadsDir));

// Kill old service workers and clear all caches
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

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/conceptos', conceptosRoutes);

app.get('/api/user', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

app.put('/api/user', authMiddleware, (req: AuthRequest, res) => {
  const { nombre, cedula, cargo } = req.body;
  db.prepare(
    'UPDATE usuarios SET nombre = COALESCE(?, nombre), cedula = COALESCE(?, cedula), cargo = COALESCE(?, cargo) WHERE id = ?'
  ).run(nombre, cedula, cargo, req.userId);

  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  res.json(user);
});

// Subir foto de perfil
app.post('/api/user/photo', authMiddleware, upload.single('foto'), (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó imagen' });
  }

  const ext = path.extname(req.file.originalname);
  const fotoPath = `/uploads/user_${req.userId}${ext}`;
  const finalPath = path.join(uploadsDir, `user_${req.userId}${ext}`);

  // Delete old photo with different extension
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
  // Add timestamp to bust cache
  user.foto_perfil = `${fotoPath}?t=${Date.now()}`;
  res.json(user);
});

// Eliminar foto de perfil
app.delete('/api/user/photo', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT foto_perfil FROM usuarios WHERE id = ?').get(req.userId) as any;

  if (user?.foto_perfil) {
    // Strip query params and /uploads/ prefix before deleting file
    const cleanPath = user.foto_perfil.split('?')[0];
    const filename = path.basename(cleanPath);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // Also try deleting other extensions
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

// Keep-alive: prevent Render free tier from sleeping
if (process.env.NODE_ENV === 'production') {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://rolpay.onrender.com';
  setInterval(async () => {
    try {
      await fetch(`${RENDER_URL}/api/user`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}
  }, 14 * 60 * 1000); // every 14 minutes
}
