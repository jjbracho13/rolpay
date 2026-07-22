import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function trimStr(s: any, max: number): string {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

router.get('/', (req: AuthRequest, res) => {
  const conceptos = db.prepare(
    'SELECT * FROM conceptos_variables WHERE usuario_id = ? ORDER BY tipo, nombre'
  ).all(req.userId);
  res.json(conceptos);
});

router.post('/', (req: AuthRequest, res) => {
  const { nombre, tipo, monto } = req.body;

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({ error: 'Nombre es requerido' });
  }

  const trimmedName = trimStr(nombre, 100);
  if (!trimmedName) {
    return res.status(400).json({ error: 'Nombre no puede estar vacío' });
  }

  if (tipo !== 'asignacion' && tipo !== 'deduccion') {
    return res.status(400).json({ error: 'Tipo debe ser "asignacion" o "deduccion"' });
  }

  const montoNum = Number(monto) || 0;
  if (!isFinite(montoNum) || montoNum < 0 || montoNum > 999999) {
    return res.status(400).json({ error: 'El monto debe ser un número positivo (0-999999)' });
  }

  const result = db.prepare(
    'INSERT INTO conceptos_variables (usuario_id, nombre, tipo, monto) VALUES (?, ?, ?, ?)'
  ).run(req.userId, trimmedName, tipo, montoNum);

  const concepto = db.prepare('SELECT * FROM conceptos_variables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(concepto);
});

router.put('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { nombre, tipo, monto, activo } = req.body;

  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (tipo !== undefined && tipo !== 'asignacion' && tipo !== 'deduccion') {
    return res.status(400).json({ error: 'Tipo debe ser "asignacion" o "deduccion"' });
  }

  if (monto !== undefined) {
    const montoNum = Number(monto);
    if (!isFinite(montoNum) || montoNum < 0 || montoNum > 999999) {
      return res.status(400).json({ error: 'El monto debe ser un número positivo (0-999999)' });
    }
  }

  db.prepare(
    'UPDATE conceptos_variables SET nombre = COALESCE(?, nombre), tipo = COALESCE(?, tipo), monto = COALESCE(?, monto), activo = COALESCE(?, activo) WHERE id = ? AND usuario_id = ?'
  ).run(trimStr(nombre, 100) || null, tipo || null, monto !== undefined ? Number(monto) : null, activo !== undefined ? (activo ? 1 : 0) : null, numId, req.userId);

  const concepto = db.prepare('SELECT * FROM conceptos_variables WHERE id = ? AND usuario_id = ?').get(numId, req.userId);
  if (!concepto) return res.status(404).json({ error: 'Concepto no encontrado' });
  res.json(concepto);
});

router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  db.prepare('DELETE FROM conceptos_variables WHERE id = ? AND usuario_id = ?').run(numId, req.userId);
  res.json({ ok: true });
});

export default router;
