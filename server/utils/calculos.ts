interface Configuracion {
  sueldo_base: number;
  horas_std: number;
  aporte_iess_pct: number;
  subsidio_medico: number;
  anticipo_quincena: number;
  prestamo_quirografario: number;
  fondo_reserva_pct: number;
  bonificacion: number;
}

interface Registro {
  horas_25: number;
  horas_50: number;
  horas_100: number;
  prestamo_quirografario?: number;
}

interface ConceptoVariable {
  id: number;
  nombre: string;
  tipo: 'asignacion' | 'deduccion';
  monto: number;
  activo: boolean;
}

interface ResultadoCalculo {
  valor_hora: number;
  recargo_25: number;
  recargo_50: number;
  recargo_100: number;
  total_horas_extras: number;
  sueldo_base: number;
  fondos_reserva: number;
  total_asignaciones: number;
  iess: number;
  subsidio_medico: number;
  anticipo_quincena: number;
  prestamo_quirografario: number;
  bonificacion: number;
  total_deducibles: number;
  neto_cobrar: number;
  conceptos_asignaciones: ConceptoVariable[];
  conceptos_deducciones: ConceptoVariable[];
}

export function calcularSalario(
  config: Configuracion,
  registro: Registro,
  conceptosVariables: ConceptoVariable[] = []
): ResultadoCalculo {
  const valor_hora = config.sueldo_base / config.horas_std;

  const recargo_25 = valor_hora * 1.25 * registro.horas_25;
  const recargo_50 = valor_hora * 1.50 * registro.horas_50;
  const recargo_100 = valor_hora * 2.00 * registro.horas_100;

  const total_horas_extras = +(recargo_25 + recargo_50 + recargo_100).toFixed(2);
  const sueldo_base = config.sueldo_base;

  const fondos_reserva = 0;

  const total_asignaciones = +(sueldo_base + total_horas_extras).toFixed(2);

  const iess = +(total_asignaciones * (config.aporte_iess_pct / 100)).toFixed(2);

  const anticipo_quincena = config.anticipo_quincena;

  // Préstamo quirografario: usar el del registro si existe, si no usar el de config
  const prestamo_quirografario = registro.prestamo_quirografario ?? config.prestamo_quirografario;

  const subsidio_medico = config.subsidio_medico;
  const bonificacion = config.bonificacion;

  // Conceptos variables activos
  const conceptos_asignaciones = conceptosVariables.filter(c => c.tipo === 'asignacion' && c.activo);
  const conceptos_deducciones = conceptosVariables.filter(c => c.tipo === 'deduccion' && c.activo);

  const total_conceptos_asignaciones = conceptos_asignaciones.reduce((sum, c) => sum + c.monto, 0);
  const total_conceptos_deducciones = conceptos_deducciones.reduce((sum, c) => sum + c.monto, 0);

  const total_asignaciones_finales = +(total_asignaciones + total_conceptos_asignaciones).toFixed(2);

  const total_deducibles = +(iess
    + subsidio_medico
    + anticipo_quincena
    + prestamo_quirografario
    + total_conceptos_deducciones).toFixed(2);

  const neto_cobrar = +(total_asignaciones_finales - total_deducibles).toFixed(2);

  return {
    valor_hora: +valor_hora.toFixed(2),
    recargo_25: +recargo_25.toFixed(2),
    recargo_50: +recargo_50.toFixed(2),
    recargo_100: +recargo_100.toFixed(2),
    total_horas_extras,
    sueldo_base,
    fondos_reserva,
    total_asignaciones: total_asignaciones_finales,
    iess,
    subsidio_medico,
    anticipo_quincena,
    prestamo_quirografario,
    bonificacion,
    total_deducibles,
    neto_cobrar,
    conceptos_asignaciones,
    conceptos_deducciones,
  };
}
