import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/connection.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', (_req: AuthRequest, res) => {
  const users = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil, activo, created_at FROM usuarios ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

router.put('/users/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { rol, activo, nombre, cedula, cargo } = req.body;

  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (rol !== undefined) {
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, id);
  }
  if (activo !== undefined) {
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id);
  }
  if (nombre !== undefined) {
    db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').run(nombre, id);
  }
  if (cedula !== undefined) {
    db.prepare('UPDATE usuarios SET cedula = ? WHERE id = ?').run(cedula, id);
  }
  if (cargo !== undefined) {
    db.prepare('UPDATE usuarios SET cargo = ? WHERE id = ?').run(cargo, id);
  }

  const updated = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil, activo, created_at FROM usuarios WHERE id = ?'
  ).get(id);
  res.json(updated);
});

router.put('/users/:id/password', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const password_hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(password_hash, id);

  res.json({ ok: true, message: 'Contraseña actualizada' });
});

router.delete('/users/:id', (req: AuthRequest, res) => {
  const { id } = req.params;

  // Can't delete yourself
  if (Number(id) === req.userId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  const user = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Can't delete other admins (last admin protection)
  if (user.rol === 'admin') {
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE rol = ?').get('admin') as any;
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
    }
  }

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
