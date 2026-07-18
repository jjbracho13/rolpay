import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'rolpay_secret_key_2024';

router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, cedula, cargo } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }

    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const existingCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as any;
    const rol = existingCount.count === 0 ? 'admin' : 'user';

    const result = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash, cedula, cargo, rol) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nombre, email, password_hash, cedula || '', cargo || '', rol);

    const userId = result.lastInsertRowid;

    db.prepare('INSERT INTO configuracion (usuario_id) VALUES (?)').run(userId);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: userId, nombre, email, cedula, cargo, rol: rol as 'admin' | 'user', foto_perfil: '' },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const user = db.prepare(
      'SELECT id, nombre, email, password_hash, cedula, cargo, rol, foto_perfil FROM usuarios WHERE email = ?'
    ).get(email) as any;

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        cedula: user.cedula,
        cargo: user.cargo,
        rol: user.rol,
        foto_perfil: user.foto_perfil || '',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/promote', authMiddleware, (req: AuthRequest, res) => {
  const caller = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(req.userId) as any;
  if (!caller || caller.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo admins pueden promover usuarios' });
  }
  const { email, rol } = req.body;
  if (!email || !rol) {
    return res.status(400).json({ error: 'email y rol son requeridos' });
  }
  db.prepare('UPDATE usuarios SET rol = ? WHERE email = ?').run(rol, email);
  const user = db.prepare('SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

export default router;
