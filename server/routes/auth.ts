import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';

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

    const result = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash, cedula, cargo) VALUES (?, ?, ?, ?, ?)'
    ).run(nombre, email, password_hash, cedula || '', cargo || '');

    const userId = result.lastInsertRowid;

    db.prepare('INSERT INTO configuracion (usuario_id) VALUES (?)').run(userId);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: userId, nombre, email, cedula, cargo, rol: 'user' as const, foto_perfil: '' },
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

export default router;
