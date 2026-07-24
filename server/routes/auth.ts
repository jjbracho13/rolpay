import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';
import { authMiddleware, AuthRequest, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 255 && EMAIL_REGEX.test(email);
}

function validatePassword(password: string): string | null {
  if (typeof password !== 'string') return 'Contraseña inválida';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  if (password.length > 128) return 'La contraseña es demasiado larga';
  return null;
}

function validateName(name: string): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'El nombre es requerido';
  if (name.length > 100) return 'El nombre es demasiado largo (máx. 100 caracteres)';
  return null;
}

function trimStr(s: any, max: number): string {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, cedula, cargo } = req.body;

    const nameErr = validateName(nombre);
    if (nameErr) return res.status(400).json({ error: nameErr });

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const cedulaTrimmed = trimStr(cedula, 20);
    if (cedulaTrimmed && !/^\d+$/.test(cedulaTrimmed)) {
      return res.status(400).json({ error: 'La cédula solo puede contener números' });
    }

    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const hasAdmin = db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE rol = ?').get('admin') as any;
    const rol = (!hasAdmin || hasAdmin.count === 0) ? 'admin' : 'user';

    const result = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash, cedula, cargo, rol) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(trimStr(nombre, 100), email.toLowerCase().trim(), password_hash, trimStr(cedula, 20), trimStr(cargo, 100), rol);

    const userId = result.lastInsertRowid;

    db.prepare('INSERT OR IGNORE INTO configuracion (usuario_id) VALUES (?)').run(userId);

    const token = jwt.sign({ userId }, JWT_SECRET!, { expiresIn: '24h' });

    res.status(201).json({
      token,
      user: { id: userId, nombre: trimStr(nombre, 100), email: email.toLowerCase().trim(), cedula: trimStr(cedula, 20), cargo: trimStr(cargo, 100), rol: rol as 'admin' | 'user', foto_perfil: '' },
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
      'SELECT id, nombre, email, password_hash, cedula, cargo, rol, foto_perfil, activo FROM usuarios WHERE email = ?'
    ).get(String(email).toLowerCase().trim()) as any;

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (user.activo === 0) {
      return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada. Contacta al administrador.' });
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: '24h' });

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
  if (rol !== 'admin' && rol !== 'user') {
    return res.status(400).json({ error: 'Rol inválido. Debe ser "admin" o "user"' });
  }
  db.prepare('UPDATE usuarios SET rol = ? WHERE email = ?').run(rol, String(email).toLowerCase().trim());
  const user = db.prepare('SELECT id, nombre, email, cedula, cargo, rol, foto_perfil FROM usuarios WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

router.post('/logout', authMiddleware, (_req: AuthRequest, res) => {
  res.json({ ok: true });
});

export default router;
