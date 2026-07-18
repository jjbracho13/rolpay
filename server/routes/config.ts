import { Router } from 'express';
import db from '../db/connection.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req: AuthRequest, res) => {
  const config = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(req.userId);
  if (!config) {
    return res.status(404).json({ error: 'Configuración no encontrada' });
  }
  res.json(config);
});

router.put('/', adminMiddleware, (req: AuthRequest, res) => {
  const {
    sueldo_base, horas_std, aporte_iess_pct, subsidio_medico,
    anticipo_quincena, prestamo_quirografario, fondo_reserva_pct, bonificacion,
  } = req.body;

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
