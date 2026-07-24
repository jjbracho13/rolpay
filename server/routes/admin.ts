import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/connection.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

function trimStr(s: any, max: number): string {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

router.get('/users', (_req: AuthRequest, res) => {
  const users = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil, activo, created_at FROM usuarios ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

router.put('/users/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { rol, activo, nombre, cedula, cargo } = req.body;

  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(numId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (rol !== undefined) {
    if (rol !== 'admin' && rol !== 'user') {
      return res.status(400).json({ error: 'Rol inválido. Debe ser "admin" o "user"' });
    }
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, numId);
  }
  if (activo !== undefined) {
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, numId);
  }
  if (nombre !== undefined) {
    const trimmed = trimStr(nombre, 100);
    if (!trimmed) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').run(trimmed, numId);
  }
  if (cedula !== undefined) {
    const cedulaStr = trimStr(cedula, 20);
    if (cedulaStr && !/^\d+$/.test(cedulaStr)) {
      return res.status(400).json({ error: 'La cédula solo puede contener números' });
    }
    db.prepare('UPDATE usuarios SET cedula = ? WHERE id = ?').run(cedulaStr, numId);
  }
  if (cargo !== undefined) {
    db.prepare('UPDATE usuarios SET cargo = ? WHERE id = ?').run(trimStr(cargo, 100), numId);
  }

  const updated = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, rol, foto_perfil, activo, created_at FROM usuarios WHERE id = ?'
  ).get(numId);
  res.json(updated);
});

router.put('/users/:id/password', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: 'La contraseña es demasiado larga (máx. 128 caracteres)' });
  }

  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(numId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const password_hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(password_hash, numId);

  res.json({ ok: true, message: 'Contraseña actualizada' });
});

router.delete('/users/:id', (req: AuthRequest, res) => {
  const { id } = req.params;

  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (numId === req.userId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  const user = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(numId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (user.rol === 'admin') {
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE rol = ?').get('admin') as any;
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
    }
  }

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(numId);
  res.json({ ok: true });
});

router.get('/users/:id/config', (req: AuthRequest, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const user = db.prepare('SELECT id, nombre, email, cedula, cargo FROM usuarios WHERE id = ?').get(numId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const config = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(numId);
  if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });

  res.json({ user, config });
});

const CONFIG_FIELDS = [
  'sueldo_base', 'horas_std', 'aporte_iess_pct', 'subsidio_medico',
  'anticipo_quincena', 'prestamo_quirografario', 'fondo_reserva_pct', 'bonificacion',
] as const;

function isValidConfigValue(v: any): boolean {
  return v === undefined || v === null || (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 999999);
}

router.put('/users/:id/config', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { nombre, cedula, cargo, sueldo_base, horas_std, aporte_iess_pct, subsidio_medico, anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion } = req.body;

  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(numId) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (nombre !== undefined) {
    const trimmed = trimStr(nombre, 100);
    if (!trimmed) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  }
  if (cedula !== undefined && typeof cedula === 'string' && cedula.length > 20) {
    return res.status(400).json({ error: 'La cédula es demasiado larga (máx. 20 caracteres)' });
  }
  if (cedula !== undefined && typeof cedula === 'string' && cedula && !/^\d+$/.test(cedula)) {
    return res.status(400).json({ error: 'La cédula solo puede contener números' });
  }
  if (cargo !== undefined && typeof cargo === 'string' && cargo.length > 100) {
    return res.status(400).json({ error: 'El cargo es demasiado largo (máx. 100 caracteres)' });
  }

  for (const field of CONFIG_FIELDS) {
    if (req.body[field] !== undefined && !isValidConfigValue(req.body[field])) {
      return res.status(400).json({ error: `Valor inválido para ${field}. Debe ser un número positivo.` });
    }
  }
  if (horas_std !== undefined && horas_std === 0) {
    return res.status(400).json({ error: 'Las horas estándar no pueden ser cero' });
  }

  if (nombre !== undefined || cedula !== undefined || cargo !== undefined) {
    db.prepare(`
      UPDATE usuarios SET
        nombre = COALESCE(?, nombre),
        cedula = COALESCE(?, cedula),
        cargo = COALESCE(?, cargo)
      WHERE id = ?
    `).run(trimStr(nombre, 100), trimStr(cedula, 20), trimStr(cargo, 100), numId);
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
  `).run(sueldo_base, horas_std, aporte_iess_pct, subsidio_medico, anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion, numId);

  const updatedUser = db.prepare('SELECT id, nombre, email, cedula, cargo FROM usuarios WHERE id = ?').get(numId);
  const updatedConfig = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(numId);
  res.json({ user: updatedUser, config: updatedConfig });
});

export default router;
