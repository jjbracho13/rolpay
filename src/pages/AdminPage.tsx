import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiAdminGetUsers, apiAdminUpdateUser, apiAdminChangePassword, apiAdminDeleteUser } from '../api';
import type { AdminUser } from '../api';
import { usePhotoUrl } from '../hooks/usePhotoUrl';

function UserRow({ u, currentUserId, onToggle, onChangeRole, onChangePassword, onDelete }: {
  u: AdminUser;
  currentUserId: number;
  onToggle: (id: number, active: boolean) => void;
  onChangeRole: (id: number, role: string) => void;
  onChangePassword: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const photoUrl = usePhotoUrl(u.foto_perfil);
  const isMe = u.id === currentUserId;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition ${
      u.activo ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-900/50 border-slate-800/50 opacity-60'
    }`}>
      <div className="relative">
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
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">TÚ</span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate">{u.email}</p>
        <p className="text-xs text-slate-500 truncate">{u.cargo || 'Sin cargo'} · {u.cedula || 'Sin cédula'}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {!isMe && (
          <>
            <button
              onClick={() => onToggle(u.id, u.activo === 1)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                u.activo
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
              }`}
            >
              {u.activo ? 'Bloquear' : 'Activar'}
            </button>
            <button
              onClick={() => onChangeRole(u.id, u.rol === 'admin' ? 'user' : 'admin')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                u.rol === 'admin'
                  ? 'bg-slate-600/20 text-slate-300 hover:bg-slate-600/30 border-slate-600/30'
                  : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20'
              }`}
            >
              {u.rol === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
            </button>
            <button
              onClick={() => onChangePassword(u.id)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition cursor-pointer"
            >
              Contraseña
            </button>
            <button
              onClick={() => onDelete(u.id, u.nombre)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
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
  const [modal, setModal] = useState<{ type: string; userId: number; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
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

  const handleToggle = async (id: number, currentActive: boolean) => {
    if (!token) return;
    try {
      const updated = await apiAdminUpdateUser(token, id, { activo: !currentActive });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, activo: updated.activo } : u));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleChangeRole = async (id: number, newRole: string) => {
    if (!token) return;
    try {
      const updated = await apiAdminUpdateUser(token, id, { rol: newRole });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, rol: updated.rol } : u));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!token || !modal || modal.type !== 'password') return;
    if (!newPassword || newPassword.length < 4) {
      alert('Mínimo 4 caracteres');
      return;
    }
    setSaving(true);
    try {
      await apiAdminChangePassword(token, modal.userId, newPassword);
      setModal(null);
      setNewPassword('');
      alert('Contraseña actualizada');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!token) return;
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiAdminDeleteUser(token, id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
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
              onChangePassword={(id) => {
                const target = users.find(u => u.id === id);
                setModal({ type: 'password', userId: id, userName: target?.nombre || '' });
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Password Modal */}
      {modal?.type === 'password' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Cambiar Contraseña</h3>
            <p className="text-sm text-slate-400 mb-4">Para: {modal.userName}</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 4 caracteres)"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm mb-4 outline-none focus:border-emerald-500/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
