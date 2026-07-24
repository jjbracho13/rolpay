import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetRegistroMes, apiSaveRegistro, apiGetConfig } from '../api';
import type { Configuracion } from '../types';
import { MESES } from '../types';

function calcularPreview(config: Configuracion, horas25: number, horas50: number, horas100: number, prestamo: number) {
  const valor_hora = config.sueldo_base / config.horas_std;
  const recargo_25 = valor_hora * 1.25 * horas25;
  const recargo_50 = valor_hora * 1.50 * horas50;
  const recargo_100 = valor_hora * 2.00 * horas100;
  const total_horas_extras = recargo_25 + recargo_50 + recargo_100;
  const total_asignaciones = config.sueldo_base + total_horas_extras;
  const iess = total_asignaciones * (config.aporte_iess_pct / 100);
  const total_deducibles = iess + config.subsidio_medico + config.anticipo_quincena + prestamo + config.bonificacion;
  const neto_cobrar = total_asignaciones - total_deducibles;
  return { valor_hora, recargo_25, recargo_50, recargo_100, neto_cobrar };
}

const ahora = new Date();
const MES_ACTUAL = ahora.getMonth() + 1;
const ANIO_ACTUAL = ahora.getFullYear();

export default function RegistroPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mes, setMes] = useState(Number(searchParams.get('mes')) || MES_ACTUAL);
  const [anio, setAnio] = useState(Number(searchParams.get('anio')) || ANIO_ACTUAL);
  const [horas25, setHoras25] = useState(0);
  const [horas50, setHoras50] = useState(0);
  const [horas100, setHoras100] = useState(0);
  const [prestamo, setPrestamo] = useState(0);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiGetRegistroMes(token, mes, anio),
      apiGetConfig(token),
    ]).then(([reg, cfg]) => {
      setConfig(cfg);
      if (reg) {
        setHoras25(reg.horas_25);
        setHoras50(reg.horas_50);
        setHoras100(reg.horas_100);
        setPrestamo(reg.prestamo_quirografario ?? cfg.prestamo_quirografario);
      } else {
        setHoras25(0);
        setHoras50(0);
        setHoras100(0);
        setPrestamo(cfg.prestamo_quirografario);
      }
    }).finally(() => setLoading(false));
  }, [token, mes, anio]);

  const preview = useMemo(() => {
    if (!config) return null;
    return calcularPreview(config, horas25, horas50, horas100, prestamo);
  }, [config, horas25, horas50, horas100, prestamo]);

  const fmt = (v: number) => `$ ${v.toFixed(2)}`;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (horas25 < 0 || horas25 > 999) e.horas25 = '0-999';
    if (horas50 < 0 || horas50 > 999) e.horas50 = '0-999';
    if (horas100 < 0 || horas100 > 999) e.horas100 = '0-999';
    if (prestamo < 0 || prestamo > 999999) e.prestamo = '0-999,999';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!token || !validate()) return;

    setSaving(true);
    setMsg('');
    try {
      await apiSaveRegistro(token, { mes, anio, horas_25: horas25, horas_50: horas50, horas_100: horas100, prestamo_quirografario: prestamo });
      setMsg('Guardado correctamente');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const totalHoras = horas25 + horas50 + horas100;

  return (
    <div className="space-y-6 md:space-y-8">
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
          <h1 className="text-xl md:text-2xl font-bold text-white">Registro de Horas</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Ingresa las horas extras del período</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Mes</label>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Año</label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {[ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 py-8 text-center">Cargando registro...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-sm">25</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm md:text-base">Horas 25%</h3>
                <p className="text-xs text-slate-500">Recargo del 25%</p>
              </div>
            </div>
            <input
              type="number"
              min="0"
              max="999"
              step="0.5"
              value={horas25 || ''}
              onChange={(e) => setHoras25(Number(e.target.value) || 0)}
              onBlur={validate}
              className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-white text-xl md:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${errors.horas25 ? 'border-red-500/50' : 'border-slate-600/50'}`}
              placeholder="0"
            />
            <p className="text-center text-slate-500 text-sm mt-2">horas</p>
            {preview && (
              <p className="text-center text-blue-400 text-sm font-medium mt-1">{fmt(preview.recargo_25)}</p>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-sm">50</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm md:text-base">Horas 50%</h3>
                <p className="text-xs text-slate-500">Recargo del 50%</p>
              </div>
            </div>
            <input
              type="number"
              min="0"
              max="999"
              step="0.5"
              value={horas50 || ''}
              onChange={(e) => setHoras50(Number(e.target.value) || 0)}
              onBlur={validate}
              className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-white text-xl md:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${errors.horas50 ? 'border-red-500/50' : 'border-slate-600/50'}`}
              placeholder="0"
            />
            <p className="text-center text-slate-500 text-sm mt-2">horas</p>
            {preview && (
              <p className="text-center text-amber-400 text-sm font-medium mt-1">{fmt(preview.recargo_50)}</p>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <span className="text-red-400 font-bold text-sm">100</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm md:text-base">Horas 100%</h3>
                <p className="text-xs text-slate-500">Recargo del 100%</p>
              </div>
            </div>
            <input
              type="number"
              min="0"
              max="999"
              step="0.5"
              value={horas100 || ''}
              onChange={(e) => setHoras100(Number(e.target.value) || 0)}
              onBlur={validate}
              className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-white text-xl md:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500/50 ${errors.horas100 ? 'border-red-500/50' : 'border-slate-600/50'}`}
              placeholder="0"
            />
            <p className="text-center text-slate-500 text-sm mt-2">horas</p>
            {preview && (
              <p className="text-center text-red-400 text-sm font-medium mt-1">{fmt(preview.recargo_100)}</p>
            )}
          </div>
        </div>
      )}

      {/* Préstamo quirografario */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm md:text-base">Préstamo Quirografario</h3>
            <p className="text-xs text-slate-500">Monto del préstamo este mes ($)</p>
          </div>
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          value={prestamo || ''}
          onChange={(e) => setPrestamo(Number(e.target.value) || 0)}
          onBlur={validate}
          className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-white text-xl md:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${errors.prestamo ? 'border-red-500/50' : 'border-slate-600/50'}`}
          placeholder="0.00"
        />
        <p className="text-center text-slate-500 text-sm mt-2">dólares</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-slate-400 text-sm">Total horas extras</p>
              <p className="text-2xl md:text-3xl font-bold text-white">{totalHoras.toFixed(1)}h</p>
            </div>
            {preview && (
              <div>
                <p className="text-slate-400 text-sm">Estimado a cobrar</p>
                <p className="text-2xl md:text-3xl font-bold text-emerald-400">{fmt(preview.neto_cobrar)}</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {msg && (
              <span className={`text-sm font-medium ${msg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                {msg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-medium rounded-lg transition cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => navigate(`/recibo?mes=${mes}&anio=${anio}`)}
              className="flex-1 sm:flex-none px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition cursor-pointer"
            >
              Ver Recibo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
