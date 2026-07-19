import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGetConfig, apiUpdateConfig, apiGetUser, apiUpdateUser, apiUploadPhoto, apiDeletePhoto, apiGetConceptos, apiCreateConcepto, apiDeleteConcepto } from '../api';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { isBiometricAvailable, getCredentials, saveCredentials, deleteCredentials } from '../utils/biometric';
import type { Configuracion, User, ConceptoVariable } from '../types';

export default function ConfigPage() {
  const { token, user: authUser, updateUser } = useAuth();
  const isAdmin = authUser?.rol === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [conceptos, setConceptos] = useState<ConceptoVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoUrl = usePhotoUrl(user?.foto_perfil);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [msg, setMsg] = useState('');
  const [nuevoConcepto, setNuevoConcepto] = useState({ nombre: '', tipo: 'deduccion' as 'asignacion' | 'deduccion', monto: 0 });

  useEffect(() => {
    if (!token) return;
    Promise.all([apiGetConfig(token), apiGetUser(token), apiGetConceptos(token)]).then(([cfg, usr, conceptos]) => {
      setConfig(cfg);
      setUser(usr);
      setConceptos(conceptos);
    }).finally(() => setLoading(false));

    isBiometricAvailable().then((avail) => {
      setBiometricAvailable(avail);
      if (avail) {
        getCredentials().then((creds) => setBiometricEnabled(!!creds));
      }
    });
  }, [token]);

  const handleConfigChange = (field: keyof Configuracion, value: number) => {
    if (!config || !isAdmin) return;
    setConfig({ ...config, [field]: value });
  };

  const handleUserChange = (field: keyof User, value: string) => {
    if (!user) return;
    setUser({ ...user, [field]: value });
  };

  const handleSaveConfig = async () => {
    if (!token || !config || !isAdmin) return;
    setSaving(true);
    setMsg('');
    try {
      const updated = await apiUpdateConfig(token, config);
      setConfig(updated);
      setMsg('Configuración guardada');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!token || !user) return;
    setSaving(true);
    setMsg('');
    try {
      const updated = await apiUpdateUser(token, {
        nombre: user.nombre,
        cedula: user.cedula,
        cargo: user.cargo,
      });
      setUser(updated);
      updateUser(updated);
      setMsg('Datos guardados');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploading(true);
    setMsg('');
    try {
      const updated = await apiUploadPhoto(token, file);
      setUser(updated);
      updateUser(updated);
      setMsg('Foto subida correctamente');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg(err.message || 'Error al subir foto');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!token) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar tu foto de perfil?')) return;
    setUploading(true);
    setMsg('');
    try {
      const updated = await apiDeletePhoto(token);
      setUser(updated);
      updateUser(updated);
      setMsg('Foto eliminada');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Error al eliminar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      await deleteCredentials();
      setBiometricEnabled(false);
      setMsg('Inicio biométrico desactivado');
      setTimeout(() => setMsg(''), 3000);
    } else {
      if (!user?.email) return;
      const password = window.prompt('Ingresa tu contraseña para habilitar la biometría:');
      if (!password) return;
      try {
        const { apiLogin } = await import('../api');
        await apiLogin(user.email, password);
        await saveCredentials(user.email, password);
        setBiometricEnabled(true);
        setMsg('Inicio biométrico activado');
      } catch {
        setMsg('Contraseña incorrecta');
      }
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleCreateConcepto = async () => {
    if (!token || !nuevoConcepto.nombre) return;
    setSaving(true);
    try {
      const created = await apiCreateConcepto(token, nuevoConcepto);
      setConceptos([...conceptos, created]);
      setNuevoConcepto({ nombre: '', tipo: 'deduccion', monto: 0 });
      setMsg('Concepto agregado');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Error al crear concepto');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConcepto = async (id: number) => {
    if (!token || !confirm('¿Eliminar este concepto?')) return;
    try {
      await apiDeleteConcepto(token, id);
      setConceptos(conceptos.filter(c => c.id !== id));
      setMsg('Concepto eliminado');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Error al eliminar');
    }
  };

  const [apiUrl, setApiUrl] = useState(() => {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      return localStorage.getItem('api_url') || '';
    }
    return '';
  });
  const [isCapacitor] = useState(() => typeof window !== 'undefined' && !!(window as any).Capacitor);

  const handleSaveApiUrl = () => {
    if (!apiUrl.trim()) return;
    localStorage.setItem('api_url', apiUrl.trim());
    setMsg('URL del servidor guardada. Reinicia la app.');
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Configuración</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Datos personales y parámetros de cálculo</p>
        </div>
        {!isAdmin && (
          <span className="px-3 py-1 bg-slate-700/50 border border-slate-600/50 text-slate-400 text-xs font-medium rounded-lg">
            Solo lectura
          </span>
        )}
        {isAdmin && (
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg">
            Admin
          </span>
        )}
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          msg.includes('Error')
            ? 'bg-red-500/10 border border-red-500/20 text-red-300'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
        }`}>
          {msg}
        </div>
      )}

      {/* Configuración de servidor (solo APK) */}
      {isCapacitor && (
        <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl">
          <div className="p-4 md:p-5 border-b border-slate-700/50">
            <h2 className="text-base md:text-lg font-semibold text-amber-400">Conexión al Servidor</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1">URL del backend (ej: https://mi-app.onrender.com)</p>
          </div>
          <div className="p-4 md:p-5 flex gap-3">
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://tu-servidor.onrender.com"
              className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              onClick={handleSaveApiUrl}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              Guardar URL
            </button>
          </div>
        </div>
      )}

      {/* Foto de perfil */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <div className="p-4 md:p-5 border-b border-slate-700/50">
          <h2 className="text-base md:text-lg font-semibold text-white">Foto de Perfil</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Aparecerá en el recibo de pago</p>
        </div>
        <div className="p-4 md:p-5 flex items-center gap-4 md:gap-6">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={user.nombre}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-slate-600"
            />
          ) : (
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xl md:text-2xl font-bold border-2 border-slate-600">
              {user?.nombre?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <button
                disabled={uploading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition w-full"
              >
                {uploading ? 'Subiendo...' : user?.foto_perfil ? 'Cambiar' : 'Subir foto'}
              </button>
            </div>
            {user?.foto_perfil && (
              <button
                onClick={handleDeletePhoto}
                disabled={uploading}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-slate-300 text-sm font-medium rounded-lg transition cursor-pointer"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {biometricAvailable && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
          <div className="p-4 md:p-5 border-b border-slate-700/50">
            <h2 className="text-base md:text-lg font-semibold text-white">Inicio Biométrico</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1">Inicia sesión con huella dactilar o Face ID</p>
          </div>
          <div className="p-4 md:p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">{biometricEnabled ? 'Activado' : 'Desactivado'}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {biometricEnabled ? 'Puedes iniciar sesión con tu biometría' : 'Activa para iniciar sesión más rápido'}
              </p>
            </div>
            <button
              onClick={handleToggleBiometric}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer ${
                biometricEnabled ? 'bg-emerald-600' : 'bg-slate-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                biometricEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Datos personales */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <div className="p-4 md:p-5 border-b border-slate-700/50">
          <h2 className="text-base md:text-lg font-semibold text-white">Datos Personales</h2>
        </div>
        <div className="p-4 md:p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={user?.nombre || ''}
              onChange={(e) => handleUserChange('nombre', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cédula</label>
              <input
                type="text"
                value={user?.cedula || ''}
                onChange={(e) => handleUserChange('cedula', e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cargo</label>
              <input
                type="text"
                value={user?.cargo || ''}
                onChange={(e) => handleUserChange('cargo', e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveUser}
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar Datos'}
            </button>
          </div>
        </div>
      </div>

      {/* Parámetros de cálculo */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <div className="p-4 md:p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-white">Parámetros de Cálculo</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1">Valores del salario</p>
          </div>
          {!isAdmin && (
            <p className="text-xs text-amber-400/80 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              Solo admin puede editar
            </p>
          )}
        </div>
        <div className="p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Sueldo Base / SSU ($)</label>
              <input
                type="number"
                step="0.01"
                value={config?.sueldo_base || 0}
                onChange={(e) => handleConfigChange('sueldo_base', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Horas Std (STD)</label>
              <input
                type="number"
                step="0.01"
                value={config?.horas_std || 0}
                onChange={(e) => handleConfigChange('horas_std', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Aporte IESS (%)</label>
              <input
                type="number"
                step="0.01"
                value={config?.aporte_iess_pct || 0}
                onChange={(e) => handleConfigChange('aporte_iess_pct', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Fondos de Reserva (%)</label>
              <input
                type="number"
                step="0.01"
                value={config?.fondo_reserva_pct || 0}
                onChange={(e) => handleConfigChange('fondo_reserva_pct', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Subsidio Médico ($)</label>
              <input
                type="number"
                step="0.01"
                value={config?.subsidio_medico || 0}
                onChange={(e) => handleConfigChange('subsidio_medico', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Anticipo Quincena ($)</label>
              <input
                type="number"
                step="0.01"
                value={config?.anticipo_quincena || 0}
                onChange={(e) => handleConfigChange('anticipo_quincena', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Préstamo Quirografario ($)</label>
              <input
                type="number"
                step="0.01"
                value={config?.prestamo_quirografario || 0}
                onChange={(e) => handleConfigChange('prestamo_quirografario', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Bonificación ($)</label>
              <input
                type="number"
                step="0.01"
                value={config?.bonificacion || 0}
                onChange={(e) => handleConfigChange('bonificacion', Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conceptos Variables */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <div className="p-4 md:p-5 border-b border-slate-700/50">
          <h2 className="text-base md:text-lg font-semibold text-white">Conceptos Variables</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Agrega deducciones o asignaciones adicionales al recibo</p>
        </div>
        <div className="p-4 md:p-5 space-y-4">
          {/* Lista de conceptos existentes */}
          {conceptos.length > 0 && (
            <div className="space-y-2">
              {conceptos.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      c.tipo === 'asignacion'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {c.tipo === 'asignacion' ? '+' : '-'}
                    </span>
                    <span className="text-white text-sm">{c.nombre}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">${c.monto.toFixed(2)}</span>
                    <button
                      onClick={() => handleDeleteConcepto(c.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para nuevo concepto */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Nombre</label>
              <input
                type="text"
                value={nuevoConcepto.nombre}
                onChange={(e) => setNuevoConcepto({ ...nuevoConcepto, nombre: e.target.value })}
                placeholder="Ej: Subsidio médico, Bono..."
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
              <select
                value={nuevoConcepto.tipo}
                onChange={(e) => setNuevoConcepto({ ...nuevoConcepto, tipo: e.target.value as 'asignacion' | 'deduccion' })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="deduccion">Deducción (-)</option>
                <option value="asignacion">Asignación (+)</option>
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-medium text-slate-400 mb-1">Monto ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={nuevoConcepto.monto || ''}
                onChange={(e) => setNuevoConcepto({ ...nuevoConcepto, monto: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <button
              onClick={handleCreateConcepto}
              disabled={saving || !nuevoConcepto.nombre}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
