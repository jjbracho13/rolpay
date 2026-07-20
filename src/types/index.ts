export interface User {
  id: number;
  nombre: string;
  email: string;
  cedula: string;
  cargo: string;
  rol: 'admin' | 'user';
  foto_perfil: string;
  activo?: number;
}

export interface Configuracion {
  id: number;
  usuario_id: number;
  sueldo_base: number;
  horas_std: number;
  aporte_iess_pct: number;
  subsidio_medico: number;
  anticipo_quincena: number;
  prestamo_quirografario: number;
  fondo_reserva_pct: number;
  bonificacion: number;
}

export interface Registro {
  id: number;
  usuario_id: number;
  mes: number;
  anio: number;
  horas_25: number;
  horas_50: number;
  horas_100: number;
  prestamo_quirografario: number;
  calculo?: CalculoSalario;
}

export interface ConceptoVariable {
  id: number;
  usuario_id: number;
  nombre: string;
  tipo: 'asignacion' | 'deduccion';
  monto: number;
  activo: boolean;
}

export interface CalculoSalario {
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

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatCurrency(value: number): string {
  return `$ ${value.toFixed(2)}`;
}

export function getMesNombre(mes: number): string {
  return MESES[mes - 1] || '';
}
