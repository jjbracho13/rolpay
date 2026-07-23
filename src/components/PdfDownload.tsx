import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../types';

interface Props {
  mes: number;
  anio: number;
}

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
    if (saved) return saved.replace(/\/api\/?$/, '');
    return 'https://rolpay.onrender.com';
  }
  return '';
}

async function showToast(text: string) {
  try {
    const { Toast } = await import('@capacitor/toast');
    await Toast.show({ text, duration: 'long' });
  } catch {
    console.log(text);
  }
}

export default function PdfDownload({ mes, anio }: Props) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (!token) {
      await showToast('No hay sesion activa');
      return;
    }
    setGenerating(true);

    try {
      const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;
      const apiBase = getApiBase();

      if (isNativeApp()) {
        const { Browser } = await import('@capacitor/browser');
        const url = `${apiBase}/api/registros/pdf/${mes}/${anio}?token=${encodeURIComponent(token)}&_t=${Date.now()}`;
        await Browser.open({ url, windowName: '_blank' });
      } else {
        const url = `${apiBase}/api/registros/pdf/${mes}/${anio}?_t=${Date.now()}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          let msg = `Error ${res.status}`;
          try {
            const err = await res.json();
            msg = err.error || msg;
          } catch {}
          throw new Error(msg);
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 5000);
      }
    } catch (err: any) {
      console.error('PDF download error:', err);
      await showToast(err.message || 'Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition cursor-pointer text-sm"
    >
      {generating ? 'Descargando...' : 'Descargar PDF'}
    </button>
  );
}
