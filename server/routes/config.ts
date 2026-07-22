import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const CONFIG_FIELDS = [
  'sueldo_base', 'horas_std', 'aporte_iess_pct', 'subsidio_medico',
  'anticipo_quincena', 'prestamo_quirografario', 'fondo_reserva_pct', 'bonificacion',
] as const;

function isValidConfigValue(v: any): boolean {
  return v === undefined || v === null || (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 999999);
}

router.get('/', (req: AuthRequest, res) => {
  const config = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(req.userId);
  if (!config) {
    return res.status(404).json({ error: 'Configuración no encontrada' });
  }
  res.json(config);
});

router.put('/', adminMiddleware, (req: AuthRequest, res) => {
  const body = req.body;

  for (const field of CONFIG_FIELDS) {
    if (body[field] !== undefined && !isValidConfigValue(body[field])) {
      return res.status(400).json({ error: `Valor inválido para ${field}. Debe ser un número positivo.` });
    }
  }

  if (body.horas_std !== undefined && body.horas_std === 0) {
    return res.status(400).json({ error: 'Las horas estándar no pueden ser cero' });
  }

  const {
    sueldo_base, horas_std, aporte_iess_pct, subsidio_medico,
    anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion,
  } = body;

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
  `).run(
    sueldo_base, horas_std, aporte_iess_pct, subsidio_medico,
    anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion,
    req.userId
  );

  const updated = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(req.userId);
  res.json(updated);
});

export default router;
