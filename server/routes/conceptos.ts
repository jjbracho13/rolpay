import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req: AuthRequest, res) => {
  const conceptos = db.prepare(
    'SELECT * FROM conceptos_variables WHERE usuario_id = ? ORDER BY tipo, nombre'
  ).all(req.userId);
  res.json(conceptos);
});

router.post('/', (req: AuthRequest, res) => {
  const { nombre, tipo, monto } = req.body;

  if (!nombre || !tipo) {
    return res.status(400).json({ error: 'Nombre y tipo son requeridos' });
  }

  if (tipo !== 'asignacion' && tipo !== 'deduccion') {
    return res.status(400).json({ error: 'Tipo debe ser "asignacion" o "deduccion"' });
  }

  const result = db.prepare(
    'INSERT INTO conceptos_variables (usuario_id, nombre, tipo, monto) VALUES (?, ?, ?, ?)'
  ).run(req.userId, nombre, tipo, monto || 0);

  const concepto = db.prepare('SELECT * FROM conceptos_variables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(concepto);
});

router.put('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { nombre, tipo, monto, activo } = req.body;

  db.prepare(
    'UPDATE conceptos_variables SET nombre = COALESCE(?, nombre), tipo = COALESCE(?, tipo), monto = COALESCE(?, monto), activo = COALESCE(?, activo) WHERE id = ? AND usuario_id = ?'
  ).run(nombre, tipo, monto, activo !== undefined ? (activo ? 1 : 0) : null, id, req.userId);

  const concepto = db.prepare('SELECT * FROM conceptos_variables WHERE id = ? AND usuario_id = ?').get(id, req.userId);
  if (!concepto) return res.status(404).json({ error: 'Concepto no encontrado' });
  res.json(concepto);
});

router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM conceptos_variables WHERE id = ? AND usuario_id = ?').run(id, req.userId);
  res.json({ ok: true });
});

export default router;
