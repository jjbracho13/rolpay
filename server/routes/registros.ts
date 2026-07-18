import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { calcularSalario } from '../utils/calculos.js';

const router = Router();
router.use(authMiddleware);

function getCalculo(userId: number, registro: any) {
  const config = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(userId) as any;
  const conceptos = db.prepare(
    'SELECT * FROM conceptos_variables WHERE usuario_id = ? AND activo = 1'
  ).all(userId) as any[];
  return calcularSalario(config, registro, conceptos);
}

router.get('/', (req: AuthRequest, res) => {
  const { mes, anio } = req.query;

  if (mes && anio) {
    const registro = db.prepare(
      'SELECT * FROM registros WHERE usuario_id = ? AND mes = ? AND anio = ?'
    ).get(req.userId, Number(mes), Number(anio));

    if (!registro) {
      return res.json(null);
    }

    const calculo = getCalculo(req.userId, registro);
    return res.json({ ...(registro as any), calculo });
  }

  const registros = db.prepare(
    'SELECT * FROM registros WHERE usuario_id = ? ORDER BY anio DESC, mes DESC'
  ).all(req.userId);

  res.json(registros);
});

router.post('/', (req: AuthRequest, res) => {
  const { mes, anio, horas_25, horas_50, horas_100, prestamo_quirografario } = req.body;

  if (!mes || !anio) {
    return res.status(400).json({ error: 'Mes y año son requeridos' });
  }

  const existing = db.prepare(
    'SELECT id FROM registros WHERE usuario_id = ? AND mes = ? AND anio = ?'
  ).get(req.userId, mes, anio) as any;

  if (existing) {
    db.prepare(
      'UPDATE registros SET horas_25 = ?, horas_50 = ?, horas_100 = ?, prestamo_quirografario = ? WHERE id = ?'
    ).run(horas_25 || 0, horas_50 || 0, horas_100 || 0, prestamo_quirografario || 0, existing.id);

    const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(existing.id) as any;
    const calculo = getCalculo(req.userId, registro);

    return res.json({ ...registro, calculo });
  }

  const result = db.prepare(
    'INSERT INTO registros (usuario_id, mes, anio, horas_25, horas_50, horas_100, prestamo_quirografario) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId, mes, anio, horas_25 || 0, horas_50 || 0, horas_100 || 0, prestamo_quirografario || 0);

  const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(result.lastInsertRowid) as any;
  const calculo = getCalculo(req.userId, registro);

  res.status(201).json({ ...registro, calculo });
});

router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM registros WHERE id = ? AND usuario_id = ?').run(id, req.userId);
  res.json({ ok: true });
});

export default router;
