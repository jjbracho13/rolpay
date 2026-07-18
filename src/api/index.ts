import type { Configuracion, Registro, User, ConceptoVariable } from '../types';

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const saved = localStorage.getItem('api_url');
    if (saved) return saved;
    return 'https://rolpay.onrender.com';
  }
  return '/api';
}

const BASE = getBaseUrl();

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error);
  }
  return res.json();
}

export async function apiRegister(data: {
  nombre: string; email: string; password: string; cedula?: string; cargo?: string;
}) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function apiGetUser(token: string) {
  return request<User>('/user', token);
}

export function apiUpdateUser(token: string, data: { nombre?: string; cedula?: string; cargo?: string }) {
  return request<User>('/user', token, { method: 'PUT', body: JSON.stringify(data) });
}

export function apiGetConfig(token: string) {
  return request<Configuracion>('/config', token);
}

export function apiUpdateConfig(token: string, data: Partial<Configuracion>) {
  return request<Configuracion>('/config', token, { method: 'PUT', body: JSON.stringify(data) });
}

export function apiGetRegistros(token: string) {
  return request<Registro[]>('/registros', token);
}

export function apiGetRegistroMes(token: string, mes: number, anio: number) {
  return request<Registro | null>(`/registros?mes=${mes}&anio=${anio}`, token);
}

export function apiSaveRegistro(token: string, data: {
  mes: number; anio: number; horas_25: number; horas_50: number; horas_100: number; prestamo_quirografario?: number;
}) {
  return request<Registro>('/registros', token, { method: 'POST', body: JSON.stringify(data) });
}

export function apiDeleteRegistro(token: string, id: number) {
  return request<{ ok: boolean }>(`/registros/${id}`, token, { method: 'DELETE' });
}

export async function apiUploadPhoto(token: string, file: File): Promise<User> {
  const formData = new FormData();
  formData.append('foto', file);

  const res = await fetch(`${BASE}/user/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error al subir foto' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function apiDeletePhoto(token: string) {
  return request<User>('/user/photo', token, { method: 'DELETE' });
}

// Conceptos Variables
export function apiGetConceptos(token: string) {
  return request<ConceptoVariable[]>('/conceptos', token);
}

export function apiCreateConcepto(token: string, data: { nombre: string; tipo: 'asignacion' | 'deduccion'; monto: number }) {
  return request<ConceptoVariable>('/conceptos', token, { method: 'POST', body: JSON.stringify(data) });
}

export function apiUpdateConcepto(token: string, id: number, data: { nombre?: string; tipo?: string; monto?: number; activo?: boolean }) {
  return request<ConceptoVariable>(`/conceptos/${id}`, token, { method: 'PUT', body: JSON.stringify(data) });
}

export function apiDeleteConcepto(token: string, id: number) {
  return request<{ ok: boolean }>(`/conceptos/${id}`, token, { method: 'DELETE' });
}
