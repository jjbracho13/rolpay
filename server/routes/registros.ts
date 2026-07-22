import { Router } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
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

function isValidMonth(mes: any): boolean {
  const n = Number(mes);
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

function isValidYear(anio: any): boolean {
  const n = Number(anio);
  return Number.isInteger(n) && n >= 2020 && n <= 2030;
}

function isValidHours(v: any): boolean {
  if (v === undefined || v === null || v === '') return true;
  const n = Number(v);
  return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 999;
}

router.get('/', (req: AuthRequest, res) => {
  const { mes, anio } = req.query;

  if (mes && anio) {
    if (!isValidMonth(mes) || !isValidYear(anio)) {
      return res.status(400).json({ error: 'Mes (1-12) o año (2020-2030) inválido' });
    }
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

  if (!isValidMonth(mes) || !isValidYear(anio)) {
    return res.status(400).json({ error: 'Mes (1-12) o año (2020-2030) inválido' });
  }

  if (!isValidHours(horas_25) || !isValidHours(horas_50) || !isValidHours(horas_100)) {
    return res.status(400).json({ error: 'Las horas deben ser números positivos (0-999)' });
  }

  if (prestamo_quirografario !== undefined && prestamo_quirografario !== null) {
    const p = Number(prestamo_quirografario);
    if (!isFinite(p) || p < 0 || p > 999999) {
      return res.status(400).json({ error: 'El préstamo debe ser un número positivo' });
    }
  }

  const h25 = Number(horas_25) || 0;
  const h50 = Number(horas_50) || 0;
  const h100 = Number(horas_100) || 0;
  const prest = Number(prestamo_quirografario) || 0;

  const existing = db.prepare(
    'SELECT id FROM registros WHERE usuario_id = ? AND mes = ? AND anio = ?'
  ).get(req.userId, mes, anio) as any;

  if (existing) {
    db.prepare(
      'UPDATE registros SET horas_25 = ?, horas_50 = ?, horas_100 = ?, prestamo_quirografario = ? WHERE id = ?'
    ).run(h25, h50, h100, prest, existing.id);

    const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(existing.id) as any;
    const calculo = getCalculo(req.userId, registro);

    return res.json({ ...registro, calculo });
  }

  const result = db.prepare(
    'INSERT INTO registros (usuario_id, mes, anio, horas_25, horas_50, horas_100, prestamo_quirografario) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId, mes, anio, h25, h50, h100, prest);

  const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(result.lastInsertRowid) as any;
  const calculo = getCalculo(req.userId, registro);

  res.status(201).json({ ...registro, calculo });
});

router.delete('/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  db.prepare('DELETE FROM registros WHERE id = ? AND usuario_id = ?').run(numId, req.userId);
  res.json({ ok: true });
});

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

router.get('/pdf/:mes/:anio', (req: AuthRequest, res) => {
  const mes = Number(req.params.mes);
  const anio = Number(req.params.anio);

  if (!isValidMonth(mes) || !isValidYear(anio)) {
    return res.status(400).json({ error: 'Mes (1-12) o año (2020-2030) inválido' });
  }

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
  const ssu = config?.sueldo_base || 487;

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recibo_${mesNombre}_${anio}.pdf"`);
  doc.pipe(res);

  const pageW = 595.28;
  const margin = 40;
  const contentW = pageW - margin * 2;

  const headerH = 72;
  const headerY = 30;
  doc.roundedRect(margin, headerY, contentW, headerH, 8).fill('#1e293b');

  let titleX = margin + 16;
  const photoR = 26;
  const photoCx = margin + 16 + photoR;
  const photoCy = headerY + headerH / 2;

  if (user?.foto_perfil) {
    try {
      const cleanPath = user.foto_perfil.split('?')[0];
      const filename = path.basename(cleanPath);
      const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
      if (fs.existsSync(filePath)) {
        doc.save();
        doc.circle(photoCx, photoCy, photoR).clip();
        doc.image(filePath, photoCx - photoR, photoCy - photoR, { width: photoR * 2, height: photoR * 2 });
        doc.restore();
        doc.circle(photoCx, photoCy, photoR + 1).lineWidth(1).stroke('#475569');
        titleX = photoCx + photoR + 12;
      }
    } catch { /* ignore */ }
  }

  doc.fontSize(16).font('Helvetica-Bold').fillColor('white')
    .text('RECIBO DE SUELDO', titleX, headerY + 16, { width: 300 });
  doc.fontSize(10).font('Helvetica').fillColor('#94a3b8')
    .text(`${mesNombre} ${anio}`, titleX, headerY + 38, { width: 300 });

  doc.fontSize(10).font('Helvetica').fillColor('#94a3b8')
    .text(`S-S-U   ${ssu}`, margin + contentW - 160, headerY + 22, { width: 140, align: 'right' });

  const dataY = headerY + headerH + 12;
  doc.roundedRect(margin, dataY, contentW, 52, 4).fill('#f8fafc');

  const col1X = margin + 16;
  const col2X = margin + contentW / 2 + 8;
  const rowH = 20;

  doc.fontSize(9).font('Helvetica');
  doc.fillColor('#64748b').text('Empleado:', col1X, dataY + 10);
  doc.fillColor('#1e293b').font('Helvetica-Bold').text(user?.nombre || '-', col1X + 55, dataY + 10);
  doc.fillColor('#64748b').font('Helvetica').text('C.I:', col2X, dataY + 10);
  doc.fillColor('#1e293b').font('Helvetica-Bold').text(user?.cedula || '-', col2X + 22, dataY + 10);

  doc.fillColor('#64748b').font('Helvetica').text('Cargo:', col1X, dataY + 10 + rowH);
  doc.fillColor('#1e293b').font('Helvetica-Bold').text(user?.cargo || '-', col1X + 40, dataY + 10 + rowH);
  doc.fillColor('#64748b').font('Helvetica').text('Valor Hora:', col2X, dataY + 10 + rowH);
  doc.fillColor('#1e293b').font('Helvetica-Bold').text(fmt(calculo.valor_hora), col2X + 60, dataY + 10 + rowH);

  let y = dataY + 70;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748b')
    .text('ASIGNACIONES', margin + 16, y);
  y += 20;
  doc.font('Helvetica').fontSize(9);
  const drawRow = (label: string, value: string, yPos: number, valueColor?: string) => {
    doc.fillColor('#475569').text(label, margin + 20, yPos, { width: 320 });
    doc.fillColor(valueColor || '#1e293b').font('Helvetica-Bold')
      .text(value, margin + contentW - 180, yPos, { width: 160, align: 'right' });
    doc.font('Helvetica');
    return yPos + 18;
  };

  y = drawRow('Sueldo Base', fmt(calculo.sueldo_base), y);
  y = drawRow(`Horas 25% (${registro.horas_25}h)`, fmt(calculo.recargo_25), y);
  y = drawRow(`Horas 50% (${registro.horas_50}h)`, fmt(calculo.recargo_50), y);
  y = drawRow(`Horas 100% (${registro.horas_100}h)`, fmt(calculo.recargo_100), y);
  if (calculo.fondos_reserva > 0) y = drawRow(`Fondos Reserva (${config?.fondo_reserva_pct}%)`, fmt(calculo.fondos_reserva), y);
  if (calculo.bonificacion > 0) y = drawRow('Bonificación', fmt(calculo.bonificacion), y);
  for (const c of calculo.conceptos_asignaciones) {
    y = drawRow(c.nombre, `+${fmt(c.monto)}`, y, '#16a34a');
  }
  doc.moveTo(margin + 16, y).lineTo(margin + contentW - 16, y).lineWidth(0.5).stroke('#e2e8f0');
  y += 6;
  doc.font('Helvetica-Bold').fontSize(9);
  y = drawRow('Total Asignaciones', fmt(calculo.total_asignaciones), y);

  y += 10;
  doc.roundedRect(margin, y - 4, contentW, 0, 0).fill();
  y += 4;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748b')
    .text('DEDUCIBLES', margin + 16, y);
  y += 20;
  doc.font('Helvetica').fontSize(9);
  y = drawRow(`Aporte IESS (${config?.aporte_iess_pct}%)`, fmt(calculo.iess), y);
  if (calculo.subsidio_medico > 0) y = drawRow('Subsidio Médico', fmt(calculo.subsidio_medico), y);
  if (calculo.anticipo_quincena > 0) y = drawRow('Anticipo Quincena', fmt(calculo.anticipo_quincena), y);
  if (calculo.prestamo_quirografario > 0) y = drawRow('Préstamo Quirografario', fmt(calculo.prestamo_quirografario), y);
  for (const c of calculo.conceptos_deducciones) {
    y = drawRow(c.nombre, `-${fmt(c.monto)}`, y, '#dc2626');
  }
  doc.moveTo(margin + 16, y).lineTo(margin + contentW - 16, y).lineWidth(0.5).stroke('#e2e8f0');
  y += 6;
  doc.font('Helvetica-Bold').fontSize(9);
  y = drawRow('Total Deducibles', fmt(calculo.total_deducibles), y);

  y += 12;
  doc.moveTo(margin, y).lineTo(margin + contentW, y).lineWidth(2).stroke('#22c55e');
  y += 8;
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
    .text('NETO A COBRAR', margin + 16, y, { width: 250 });
  doc.fontSize(18).fillColor('#16a34a')
    .text(fmt(calculo.neto_cobrar), margin + contentW - 180, y - 2, { width: 160, align: 'right' });

  y += 50;
  const firmaW = 140;
  doc.moveTo(margin + 30, y).lineTo(margin + 30 + firmaW, y).lineWidth(0.5).stroke('#94a3b8');
  doc.moveTo(margin + contentW - 30 - firmaW, y).lineTo(margin + contentW - 30, y).lineWidth(0.5).stroke('#94a3b8');
  doc.fontSize(8).font('Helvetica').fillColor('#64748b')
    .text('Firma Empleado', margin + 30, y + 5, { width: firmaW, align: 'center' })
    .text('Firma Empleador', margin + contentW - 30 - firmaW, y + 5, { width: firmaW, align: 'center' });

  doc.end();
});

export default router;
