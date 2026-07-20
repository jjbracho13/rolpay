import { Router } from 'express';
import PDFDocument from 'pdfkit';
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

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

router.get('/pdf/:mes/:anio', (req: AuthRequest, res) => {
  const mes = Number(req.params.mes);
  const anio = Number(req.params.anio);

  const user = db.prepare(
    'SELECT id, nombre, email, cedula, cargo, foto_perfil FROM usuarios WHERE id = ?'
  ).get(req.userId) as any;
  const config = db.prepare('SELECT * FROM configuracion WHERE usuario_id = ?').get(req.userId) as any;
  const registro = db.prepare(
    'SELECT * FROM registros WHERE usuario_id = ? AND mes = ? AND anio = ?'
  ).get(req.userId, mes, anio) as any;

  if (!registro) {
    return res.status(404).json({ error: 'No hay registro para este mes' });
  }

  const calculo = getCalculo(req.userId, registro);
  const fmt = (v: number) => `$ ${v.toFixed(2)}`;
  const mesNombre = MESES[mes - 1];

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recibo_${mesNombre}_${anio}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('RECIBO DE SUELDO', 40, 40);
  doc.fontSize(10).font('Helvetica').fillColor('#666').text(`${mesNombre} ${anio}`, 40, 62);

  doc.fillColor('#333');
  doc.save();
  doc.fontSize(10).font('Helvetica');
  doc.text(`Empleado: ${user?.nombre || '-'}`, 40, 90, { continued: true });
  doc.text(`     C.I: ${user?.cedula || '-'}`);
  doc.restore();

  doc.save();
  doc.text(`Cargo: ${user?.cargo || '-'}`, 40, 105, { continued: true });
  doc.text(`   Valor Hora: ${fmt(calculo.valor_hora)}`);
  doc.restore();

  doc.moveTo(40, 120).lineTo(555, 120).strokeColor('#ccc').stroke();

  let y = 135;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#666').text('ASIGNACIONES', 40, y);
  y += 18;
  doc.font('Helvetica').fillColor('#333').fontSize(10);
  const drawRow = (label: string, value: string, yPos: number, color?: string) => {
    doc.fillColor(color || '#333').text(label, 50, yPos, { width: 300 });
    doc.text(value, 400, yPos, { width: 150, align: 'right' });
    return yPos + 16;
  };

  y = drawRow('Sueldo Base', fmt(calculo.sueldo_base), y);
  y = drawRow(`Horas Extras 25% (${registro.horas_25}h)`, fmt(calculo.recargo_25), y);
  y = drawRow(`Horas Extras 50% (${registro.horas_50}h)`, fmt(calculo.recargo_50), y);
  y = drawRow(`Horas Extras 100% (${registro.horas_100}h)`, fmt(calculo.recargo_100), y);
  if (calculo.fondos_reserva > 0) y = drawRow(`Fondos de Reserva (${config?.fondo_reserva_pct}%)`, fmt(calculo.fondos_reserva), y);
  if (calculo.bonificacion > 0) y = drawRow('Bonificación', fmt(calculo.bonificacion), y);
  for (const c of calculo.conceptos_asignaciones) {
    y = drawRow(c.nombre, `+${fmt(c.monto)}`, y, '#16a34a');
  }
  doc.moveTo(50, y).lineTo(555, y).strokeColor('#ccc').stroke();
  y += 6;
  y = drawRow('Total Asignaciones', fmt(calculo.total_asignaciones), y);

  y += 14;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#666').text('DEDUCIBLES', 40, y);
  y += 18;
  doc.font('Helvetica').fillColor('#333').fontSize(10);
  y = drawRow(`Aporte IESS (${config?.aporte_iess_pct}%)`, fmt(calculo.iess), y);
  if (calculo.subsidio_medico > 0) y = drawRow('Subsidio Médico', fmt(calculo.subsidio_medico), y);
  if (calculo.anticipo_quincena > 0) y = drawRow('Anticipo de Quincena', fmt(calculo.anticipo_quincena), y);
  if (calculo.prestamo_quirografario > 0) y = drawRow('Préstamo Quirografario', fmt(calculo.prestamo_quirografario), y);
  for (const c of calculo.conceptos_deducciones) {
    y = drawRow(c.nombre, `-${fmt(c.monto)}`, y, '#dc2626');
  }
  doc.moveTo(50, y).lineTo(555, y).strokeColor('#ccc').stroke();
  y += 6;
  y = drawRow('Total Deducibles', fmt(calculo.total_deducibles), y);

  y += 16;
  doc.rect(40, y, 515, 40).fill('#f0fdf4');
  doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('NETO A COBRAR', 50, y + 6, { width: 300 });
  doc.fillColor('#16a34a').fontSize(20).text(fmt(calculo.neto_cobrar), 400, y + 4, { width: 145, align: 'right' });

  y += 70;
  doc.moveTo(50, y).lineTo(250, y).strokeColor('#999').stroke();
  doc.fontSize(9).fillColor('#666').text('Firma del Empleado', 50, y + 4, { width: 200, align: 'center' });
  doc.moveTo(340, y).lineTo(545, y).strokeColor('#999').stroke();
  doc.text('Firma del Empleador', 340, y + 4, { width: 205, align: 'center' });

  doc.end();
});

export default router;
