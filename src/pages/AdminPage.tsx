import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  apiAdminGetUsers, apiAdminUpdateUser, apiAdminChangePassword, apiAdminDeleteUser,
  apiAdminGetUserConfig, apiAdminUpdateUserConfig,
} from '../api';
import type { AdminUser } from '../api';
import type { Configuracion } from '../types';
import { usePhotoUrl } from '../hooks/usePhotoUrl';

function UserRow({ u, currentUserId, onToggle, onChangeRole, onChangePassword, onDelete, onConfig }: {
  u: AdminUser;
  currentUserId: number;
  onToggle: (id: number, active: boolean) => void;
  onChangeRole: (id: number, role: string) => void;
  onChangePassword: (id: number) => void;
  onDelete: (id: number, name: string) => void;
  onConfig: (id: number) => void;
}) {
  const photoUrl = usePhotoUrl(u.foto_perfil);
  const isMe = u.id === currentUserId;

  return (
    <div className={`p-4 rounded-xl border transition ${
      u.activo ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-900/50 border-slate-800/50 opacity-60'
    }`}>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt={u.nombre} className="w-10 h-10 rounded-full object-cover border border-slate-600" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">
              {u.nombre?.charAt(0) || '?'}
            </div>
          )}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${
            u.activo ? 'bg-emerald-400' : 'bg-red-400'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{u.nombre}</p>
            {u.rol === 'admin' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">ADMIN</span>
            )}
            {isMe && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">TU</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{u.email}</p>
          <p className="text-xs text-slate-500 truncate">{u.cargo || 'Sin cargo'} &middot; {u.cedula || 'Sin cedula'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => onConfig(u.id)}
          className="flex-1 min-w-[80px] px-2.5 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition cursor-pointer"
        >
          Configurar
        </button>
        {!isMe && (
          <>
            <button
              onClick={() => onToggle(u.id, u.activo === 1)}
              className={`flex-1 min-w-[80px] px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer border ${
                u.activo
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20'
              }`}
            >
              {u.activo ? 'Bloquear' : 'Activar'}
            </button>
            <button
              onClick={() => onChangeRole(u.id, u.rol === 'admin' ? 'user' : 'admin')}
              className={`flex-1 min-w-[80px] px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer border ${
                u.rol === 'admin'
                  ? 'bg-slate-600/20 text-slate-300 hover:bg-slate-600/30 border-slate-600/30'
                  : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20'
              }`}
            >
              {u.rol === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
            </button>
            <button
              onClick={() => onChangePassword(u.id)}
              className="flex-1 min-w-[80px] px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition cursor-pointer"
            >
              Contrasena
            </button>
            <button
              onClick={() => onDelete(u.id, u.nombre)}
              className="flex-1 min-w-[80px] px-2.5 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password modal
  const [pwModal, setPwModal] = useState<{ userId: number; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error2, setError2] = useState('');

  // Config modal
  const [cfgModal, setCfgModal] = useState<{ userId: number; userName: string } | null>(null);
  const [cfgUser, setCfgUser] = useState({ nombre: '', cedula: '', cargo: '' });
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState('');

  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    if (!token) return;
    setLoading(true);
    apiAdminGetUsers(token)
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadUsers, [token]);

  // --- User actions ---
  const handleToggle = async (id: number, currentActive: boolean) => {
    if (!token) return;
    try {
      const updated = await apiAdminUpdateUser(token, id, { activo: !currentActive });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, activo: updated.activo } : u));
    } catch (e: any) { alert(e.message); }
  };

  const handleChangeRole = async (id: number, newRole: string) => {
    if (!token) return;
    try {
      const updated = await apiAdminUpdateUser(token, id, { rol: newRole });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, rol: updated.rol } : u));
    } catch (e: any) { alert(e.message); }
  };

  const handlePasswordSubmit = async () => {
    if (!token || !pwModal) return;
    if (!newPassword) { setError2('La contraseña es requerida'); return; }
    if (newPassword.length < 6) { setError2('La contraseña debe tener al menos 6 caracteres'); return; }
    if (newPassword.length > 128) { setError2('La contraseña es demasiado larga'); return; }
    setSaving(true);
    setError2('');
    try {
      await apiAdminChangePassword(token, pwModal.userId, newPassword);
      setPwModal(null);
      setNewPassword('');
      alert('Contraseña actualizada');
    } catch (e: any) { setError2(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!token) return;
    if (!confirm(`Eliminar a ${name}? Esta accion no se puede deshacer.`)) return;
    try {
      await apiAdminDeleteUser(token, id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e: any) { alert(e.message); }
  };

  // --- Config modal ---
  const openConfig = async (userId: number) => {
    if (!token) return;
    const target = users.find(u => u.id === userId);
    setCfgModal({ userId, userName: target?.nombre || '' });
    setCfgLoading(true);
    setCfgMsg('');
    try {
      const data = await apiAdminGetUserConfig(token, userId);
      setCfgUser({ nombre: data.user.nombre, cedula: data.user.cedula, cargo: data.user.cargo });
      setCfg(data.config);
    } catch (e: any) { setCfgMsg(e.message); }
    finally { setCfgLoading(false); }
  };

  const handleConfigSave = async () => {
    if (!token || !cfgModal || !cfg) return;

    if (!cfgUser.nombre.trim()) { setCfgMsg('Error: El nombre es requerido'); return; }
    if (cfgUser.nombre.trim().length > 100) { setCfgMsg('Error: El nombre es demasiado largo'); return; }
    if (cfgUser.cedula.length > 20) { setCfgMsg('Error: La cédula es demasiado larga'); return; }
    if (cfgUser.cargo.length > 100) { setCfgMsg('Error: El cargo es demasiado largo'); return; }

    const fields = ['sueldo_base', 'horas_std', 'aporte_iess_pct', 'subsidio_medico', 'anticipo_quincena', 'prestamo_quirografario', 'fondo_reserva_pct', 'bonificacion'] as const;
    for (const f of fields) {
      if (!isFinite(cfg[f]) || cfg[f] < 0 || cfg[f] > 999999) {
        setCfgMsg(`Error: ${f} debe ser un número positivo`);
        return;
      }
    }
    if (cfg.horas_std === 0) { setCfgMsg('Error: Las horas estándar no pueden ser cero'); return; }

    setCfgSaving(true);
    setCfgMsg('');
    try {
      const result = await apiAdminUpdateUserConfig(token, cfgModal.userId, {
        nombre: cfgUser.nombre.trim(),
        cedula: cfgUser.cedula.trim(),
        cargo: cfgUser.cargo.trim(),
        sueldo_base: cfg.sueldo_base,
        horas_std: cfg.horas_std,
        aporte_iess_pct: cfg.aporte_iess_pct,
        subsidio_medico: cfg.subsidio_medico,
        anticipo_quincena: cfg.anticipo_quincena,
        prestamo_quirografario: cfg.prestamo_quirografario,
        fondo_reserva_pct: cfg.fondo_reserva_pct,
        bonificacion: cfg.bonificacion,
      });
      setUsers(prev => prev.map(u => u.id === cfgModal.userId
        ? { ...u, nombre: result.user.nombre, cedula: result.user.cedula, cargo: result.user.cargo }
        : u
      ));
      setCfgMsg('Guardado correctamente');
      setTimeout(() => setCfgMsg(''), 3000);
    } catch (e: any) { setCfgMsg(e.message); }
    finally { setCfgSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Administrar Usuarios</h1>
        <p className="text-slate-400 mt-1 text-sm">{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-12">Cargando usuarios...</div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <UserRow
              key={u.id}
              u={u}
              currentUserId={currentUser?.id || 0}
              onToggle={handleToggle}
              onChangeRole={handleChangeRole}
              onChangePassword={(id) => { const t = users.find(u => u.id === id); setPwModal({ userId: id, userName: t?.nombre || '' }); }}
              onDelete={handleDelete}
              onConfig={openConfig}
            />
          ))}
        </div>
      )}

      {/* Password Modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setPwModal(null); setError2(''); }}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Cambiar Contraseña</h3>
            <p className="text-sm text-slate-400 mb-4">Para: {pwModal.userName}</p>
            {error2 && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg p-3 mb-4 text-center">{error2}</div>
            )}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError2(''); }}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm mb-4 outline-none focus:border-emerald-500/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex gap-3">
              <button onClick={() => setPwModal(null)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition cursor-pointer">Cancelar</button>
              <button onClick={handlePasswordSubmit} disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {cfgModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setCfgModal(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Configurar Usuario</h3>
            <p className="text-sm text-slate-400 mb-5">{cfgModal.userName}</p>

            {cfgLoading ? (
              <div className="text-slate-400 text-center py-8">Cargando...</div>
            ) : (
              <div className="space-y-5">
                {/* User data */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Datos Personales</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nombre</label>
                      <input type="text" value={cfgUser.nombre} onChange={(e) => setCfgUser({ ...cfgUser, nombre: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Cedula</label>
                        <input type="text" value={cfgUser.cedula} onChange={(e) => setCfgUser({ ...cfgUser, cedula: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Cargo</label>
                        <input type="text" value={cfgUser.cargo} onChange={(e) => setCfgUser({ ...cfgUser, cargo: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calculation params */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Parametros de Calculo</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Sueldo Base / SSU ($)', field: 'sueldo_base' as const },
                      { label: 'Horas Std (STD)', field: 'horas_std' as const },
                      { label: 'Aporte IESS (%)', field: 'aporte_iess_pct' as const },
                      { label: 'Fondos Reserva (%)', field: 'fondo_reserva_pct' as const },
                      { label: 'Subsidio Medico ($)', field: 'subsidio_medico' as const },
                      { label: 'Anticipo Quincena ($)', field: 'anticipo_quincena' as const },
                      { label: 'Prestamo Quirografario ($)', field: 'prestamo_quirografario' as const },
                      { label: 'Bonificacion ($)', field: 'bonificacion' as const },
                    ].map(({ label, field }) => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                        <input type="number" step="0.01" value={cfg?.[field] || 0}
                          onChange={(e) => cfg && setCfg({ ...cfg, [field]: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                      </div>
                    ))}
                  </div>
                </div>

                {cfgMsg && (
                  <div className={`px-3 py-2 rounded-lg text-sm text-center ${
                    cfgMsg.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>{cfgMsg}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCfgModal(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition cursor-pointer">Cancelar</button>
                  <button onClick={handleConfigSave} disabled={cfgSaving} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer">{cfgSaving ? 'Guardando...' : 'Guardar Todo'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
