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

// Get a user's config
router.get('/users/:id/config', (req: AuthRequest, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT id, nombre, email, cedula, cargo FROM usuarios WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const config = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(id);
  if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });

  res.json({ user, config });
});

// Update a user's config and personal data
router.put('/users/:id/config', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { nombre, cedula, cargo, sueldo_base, horas_std, aporte_iess_pct, subsidio_medico, anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion } = req.body;

  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (nombre !== undefined || cedula !== undefined || cargo !== undefined) {
    db.prepare(`
      UPDATE usuarios SET
        nombre = COALESCE(?, nombre),
        cedula = COALESCE(?, cedula),
        cargo = COALESCE(?, cargo)
      WHERE id = ?
    `).run(nombre, cedula, cargo, id);
  }

  db.prepare(`
    UPDATE configuracion SET
      sueldo_base = COALESCE(?, sueldo_base),
      horas_std = COALESCE(?, horas_std),
      aporte_iess_pct = COALESCE(?, aporte_iess_pct),
      subsidio_medico = COALESCE(?, subsidio_medico),
      anticipo_quincena = COALESCE(?, anticipo_quincena),
      prestamo_quirografario = COALESCE(?, prestamo_quirografario),
      fondo_reserva_pct = COALESCE(?, fondo_reserva_pct),
      bonificacion = COALESCE(?, bonificacion)
    WHERE usuario_id = ?
  `).run(sueldo_base, horas_std, aporte_iess_pct, subsidio_medico, anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion, id);

  const updatedUser = db.prepare('SELECT id, nombre, email, cedula, cargo FROM usuarios WHERE id = ?').get(id);
  const updatedConfig = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(id);
  res.json({ user: updatedUser, config: updatedConfig });
});

export default router;
