import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetRegistroMes, apiGetConfig, apiGetUser } from '../api';
import type { Registro, Configuracion, User, CalculoSalario } from '../types';
import { MESES, formatCurrency } from '../types';
import PdfDownload from '../components/PdfDownload';

const ahora = new Date();
const MES_ACTUAL = ahora.getMonth() + 1;
const ANIO_ACTUAL = ahora.getFullYear();

export default function ReciboPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mes, setMes] = useState(Number(searchParams.get('mes')) || MES_ACTUAL);
  const [anio, setAnio] = useState(Number(searchParams.get('anio')) || ANIO_ACTUAL);
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [calculo, setCalculo] = useState<CalculoSalario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiGetUser(token),
      apiGetConfig(token),
      apiGetRegistroMes(token, mes, anio),
    ]).then(([u, cfg, reg]) => {
      setUser(u);
      setConfig(cfg);
      setRegistro(reg);
      setCalculo(reg?.calculo || null);
    }).finally(() => setLoading(false));
  }, [token, mes, anio]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando recibo...</div>;
  }

  if (!calculo || !registro) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Mes</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
              className="px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white">
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Año</label>
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
              className="px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white">
              {[ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 md:p-12 text-center">
          <p className="text-slate-400 text-lg">No hay registro para {MESES[mes - 1]} {anio}</p>
          <p className="text-slate-500 mt-2 text-sm">Ve a "Horas" para ingresar los datos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Recibo de Sueldo</h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">{MESES[mes - 1]} {anio}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Mes</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
              className="px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-sm">
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Año</label>
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
              className="px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-sm">
              {[ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <PdfDownload
            user={user}
            config={config}
            calculo={calculo}
            mes={mes}
            anio={anio}
            horas25={registro.horas_25}
            horas50={registro.horas_50}
            horas100={registro.horas_100}
          />
        </div>
      </div>

      {/* Recibo visual */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl overflow-hidden max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 text-white px-4 md:px-8 py-4 md:py-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 md:gap-4">
              {user?.foto_perfil && (
                  <img
                    src={`${user.foto_perfil}?v=${user.id}_${Date.now()}`}
                  alt={user.nombre}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-slate-600"
                />
              )}
              <div>
                <h2 className="text-base md:text-xl font-bold">RECIBO DE SUELDO</h2>
                <p className="text-slate-300 text-xs md:text-sm mt-1">{MESES[mes - 1]} {anio}</p>
              </div>
            </div>
            <div className="text-right text-xs md:text-sm text-slate-300">
              <p>S-S-U &nbsp; 487</p>
            </div>
          </div>
        </div>

        {/* Datos empleado */}
        <div className="px-4 md:px-8 py-3 md:py-4 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
            <div>
              <span className="text-slate-500">Empleado:</span>
              <span className="ml-1 md:ml-2 font-semibold text-slate-800">{user?.nombre || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">C.I:</span>
              <span className="ml-1 md:ml-2 font-semibold text-slate-800">{user?.cedula || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Cargo:</span>
              <span className="ml-1 md:ml-2 font-semibold text-slate-800">{user?.cargo || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Valor Hora:</span>
              <span className="ml-1 md:ml-2 font-semibold text-slate-800">{formatCurrency(calculo.valor_hora)}</span>
            </div>
          </div>
        </div>

        {/* Asignaciones */}
        <div className="px-4 md:px-8 py-4 md:py-6">
          <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 md:mb-4">Asignaciones</h3>
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-slate-600">Sueldo Base</span>
              <span className="font-semibold text-slate-800">{formatCurrency(calculo.sueldo_base)}</span>
            </div>
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-slate-600">Horas 25% ({registro.horas_25}h)</span>
              <span className="font-semibold text-slate-800">{formatCurrency(calculo.recargo_25)}</span>
            </div>
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-slate-600">Horas 50% ({registro.horas_50}h)</span>
              <span className="font-semibold text-slate-800">{formatCurrency(calculo.recargo_50)}</span>
            </div>
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-slate-600">Horas 100% ({registro.horas_100}h)</span>
              <span className="font-semibold text-slate-800">{formatCurrency(calculo.recargo_100)}</span>
            </div>
            {calculo.fondos_reserva > 0 && (
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">Fondos Reserva ({config?.fondo_reserva_pct}%)</span>
                <span className="font-semibold text-slate-800">{formatCurrency(calculo.fondos_reserva)}</span>
              </div>
            )}
            {calculo.bonificacion > 0 && (
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">Bonificación</span>
                <span className="font-semibold text-slate-800">{formatCurrency(calculo.bonificacion)}</span>
              </div>
            )}
            {calculo.conceptos_asignaciones?.map((c) => (
              <div key={c.id} className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">{c.nombre}</span>
                <span className="font-semibold text-emerald-600">+{formatCurrency(c.monto)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 md:pt-3 flex justify-between">
              <span className="font-bold text-slate-700 text-xs md:text-sm">Total Asignaciones</span>
              <span className="font-bold text-slate-800 text-xs md:text-sm">{formatCurrency(calculo.total_asignaciones)}</span>
            </div>
          </div>
        </div>

        {/* Deducibles */}
        <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50 border-t border-slate-200">
          <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 md:mb-4">Deducibles</h3>
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-slate-600">Aporte IESS ({config?.aporte_iess_pct}%)</span>
              <span className="font-semibold text-slate-800">{formatCurrency(calculo.iess)}</span>
            </div>
            {calculo.subsidio_medico > 0 && (
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">Subsidio Médico</span>
                <span className="font-semibold text-slate-800">{formatCurrency(calculo.subsidio_medico)}</span>
              </div>
            )}
            {calculo.anticipo_quincena > 0 && (
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">Anticipo Quincena</span>
                <span className="font-semibold text-slate-800">{formatCurrency(calculo.anticipo_quincena)}</span>
              </div>
            )}
            {calculo.prestamo_quirografario > 0 && (
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">Préstamo Quirografario</span>
                <span className="font-semibold text-slate-800">{formatCurrency(calculo.prestamo_quirografario)}</span>
              </div>
            )}
            {calculo.conceptos_deducciones?.map((c) => (
              <div key={c.id} className="flex justify-between text-xs md:text-sm">
                <span className="text-slate-600">{c.nombre}</span>
                <span className="font-semibold text-red-600">-{formatCurrency(c.monto)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 md:pt-3 flex justify-between">
              <span className="font-bold text-slate-700 text-xs md:text-sm">Total Deducibles</span>
              <span className="font-bold text-slate-800 text-xs md:text-sm">{formatCurrency(calculo.total_deducibles)}</span>
            </div>
          </div>
        </div>

        {/* Neto */}
        <div className="px-4 md:px-8 py-4 md:py-6 border-t-2 border-emerald-500">
          <div className="flex justify-between items-center">
            <span className="text-base md:text-xl font-bold text-slate-800">NETO A COBRAR</span>
            <span className="text-xl md:text-3xl font-bold text-emerald-600">{formatCurrency(calculo.neto_cobrar)}</span>
          </div>
        </div>

        {/* Firmas */}
        <div className="px-4 md:px-8 py-6 md:py-8 grid grid-cols-2 gap-4 md:gap-8 border-t border-slate-200">
          <div className="text-center">
            <div className="border-t border-slate-400 w-28 md:w-48 mx-auto mb-2"></div>
            <p className="text-xs md:text-sm text-slate-500">Firma Empleado</p>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 w-28 md:w-48 mx-auto mb-2"></div>
            <p className="text-xs md:text-sm text-slate-500">Firma Empleador</p>
          </div>
        </div>
      </div>
    </div>
  );
}
