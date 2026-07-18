import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetRegistros, apiGetConfig, apiDeleteRegistro } from '../api';
import type { Registro, Configuracion } from '../types';
import { MESES, formatCurrency } from '../types';

export default function DashboardPage() {
  const { token } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRegistros = () => {
    if (!token) return;
    Promise.all([
      apiGetRegistros(token),
      apiGetConfig(token),
    ]).then(([regs, cfg]) => {
      setRegistros(regs);
      setConfig(cfg);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRegistros();
  }, [token]);

  const handleDelete = async (id: number) => {
    if (!token || !confirm('¿Eliminar este registro?')) return;
    try {
      await apiDeleteRegistro(token, id);
      setRegistros(registros.filter(r => r.id !== id));
    } catch {
      alert('Error al eliminar');
    }
  };

  const currentMes = new Date().getMonth() + 1;
  const currentAnio = new Date().getFullYear();
  const registroActual = registros.find(r => r.mes === currentMes && r.anio === currentAnio);

  const totalHorasAnio = registros
    .filter(r => r.anio === currentAnio)
    .reduce((acc, r) => acc + (r.horas_25 || 0) + (r.horas_50 || 0) + (r.horas_100 || 0), 0);

  const valorHora = config ? config.sueldo_base / config.horas_std : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">Resumen de tu salario por horas</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs md:text-sm text-slate-400">Mes Actual</p>
          <p className="text-lg md:text-2xl font-bold text-white mt-1">{MESES[currentMes - 1]} {currentAnio}</p>
          <p className="text-xs md:text-sm text-emerald-400 mt-2">
            {registroActual
              ? `${registroActual.horas_25 + registroActual.horas_50 + registroActual.horas_100}h`
              : 'Sin registro'}
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs md:text-sm text-slate-400">Valor Hora</p>
          <p className="text-lg md:text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(valorHora)}</p>
          <p className="text-xs md:text-sm text-slate-500 mt-2">Base: {formatCurrency(config?.sueldo_base || 0)}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs md:text-sm text-slate-400">Horas Año</p>
          <p className="text-lg md:text-2xl font-bold text-white mt-1">{totalHorasAnio.toFixed(1)}h</p>
          <p className="text-xs md:text-sm text-slate-500 mt-2">
            {registros.filter(r => r.anio === currentAnio).length} meses
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs md:text-sm text-slate-400">IESS</p>
          <p className="text-lg md:text-2xl font-bold text-white mt-1">{config?.aporte_iess_pct || 0}%</p>
          <p className="text-xs md:text-sm text-slate-500 mt-2">Aporte personal</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <div className="p-4 md:p-5 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold text-white">Registros</h2>
          <Link
            to="/registro"
            className="px-3 md:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-medium rounded-lg transition"
          >
            + Nuevo
          </Link>
        </div>

        {/* Vista móvil: tarjetas */}
        <div className="md:hidden divide-y divide-slate-700/30">
          {registros.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Sin registros aún
            </div>
          ) : (
            registros.map((r) => (
              <div key={r.id} className="p-4 hover:bg-slate-700/20 transition">
                <Link
                  to={`/registro?mes=${r.mes}&anio=${r.anio}`}
                  className="block"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-white text-sm">{MESES[r.mes - 1]} {r.anio}</span>
                    <span className="text-emerald-400 font-bold">{(r.horas_25 + r.horas_50 + r.horas_100).toFixed(1)}h</span>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>25%: {r.horas_25}h</span>
                    <span>50%: {r.horas_50}h</span>
                    <span>100%: {r.horas_100}h</span>
                  </div>
                </Link>
                <div className="flex gap-2 mt-2">
                  <Link
                    to={`/registro?mes=${r.mes}&anio=${r.anio}`}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vista desktop: tabla */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Período</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">25%</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">50%</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">100%</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Total</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No hay registros aún
                  </td>
                </tr>
              ) : (
                registros.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-700/20 transition">
                    <td className="px-5 py-3 text-white font-medium">{MESES[r.mes - 1]} {r.anio}</td>
                    <td className="px-5 py-3 text-center text-slate-300">{r.horas_25}h</td>
                    <td className="px-5 py-3 text-center text-slate-300">{r.horas_50}h</td>
                    <td className="px-5 py-3 text-center text-slate-300">{r.horas_100}h</td>
                    <td className="px-5 py-3 text-center text-white font-medium">
                      {(r.horas_25 + r.horas_50 + r.horas_100).toFixed(1)}h
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/registro?mes=${r.mes}&anio=${r.anio}`}
                          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-red-400 hover:text-red-300 text-sm font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
