import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function isNativeApp(): boolean {
  try {
    const c = (window as any).Capacitor;
    return c && typeof c.getPlatform === 'function' && c.getPlatform() !== 'web';
  } catch {
    return false;
  }
}

function getApiBase(): string {
  if (isNativeApp()) {
    const saved = localStorage.getItem('api_url');
    if (saved) return saved.replace('/api', '');
    return 'https://rolpay.onrender.com';
  }
  return '';
}

export function usePhotoUrl(fotoPerfil: string | null | undefined): string | null {
  const { token } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fotoPerfil || !token) {
      setBlobUrl(null);
      return;
    }

    const path = fotoPerfil.split('?')[0];
    const fullUrl = `${getApiBase()}${path}?_t=${Date.now()}`;

    let cancelled = false;

    fetch(fullUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [fotoPerfil, token]);

  return blobUrl;
}
