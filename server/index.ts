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

  const fotoPath = `/uploads/user_${req.userId}${path.extname(req.file.originalname)}`;
  db.prepare('UPDATE usuarios SET foto_perfil = ? WHERE id = ?').run(fotoPath, req.userId);

  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  res.json(user);
});

// Eliminar foto de perfil
app.delete('/api/user/photo', authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT foto_perfil FROM usuarios WHERE id = ?').get(req.userId) as any;

  if (user?.foto_perfil) {
    const filePath = path.join(__dirname, '..', 'public', user.foto_perfil);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE usuarios SET foto_perfil = ? WHERE id = ?').run('', req.userId);
  }

  const updated = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId);
  res.json(updated);
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*splat}', (_req, res) => {
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
