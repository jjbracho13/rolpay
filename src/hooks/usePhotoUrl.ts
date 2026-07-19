import { useState, useEffect } from 'react';

function getApiBase(): string {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const saved = localStorage.getItem('api_url');
    if (saved) return saved.replace('/api', '');
    return 'https://rolpay.onrender.com';
  }
  return '';
}

export function usePhotoUrl(fotoPerfil: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fotoPerfil) {
      setBlobUrl(null);
      return;
    }

    const path = fotoPerfil.split('?')[0];
    const fullUrl = `${getApiBase()}${path}?_t=${Date.now()}`;

    let cancelled = false;

    fetch(fullUrl, { cache: 'no-store' })
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
  }, [fotoPerfil]);

  return blobUrl;
}
