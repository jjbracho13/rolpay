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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

export default function PdfDownload({ mes, anio }: Props) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (!token) {
      alert('No hay sesion activa');
      return;
    }
    setGenerating(true);

    try {
      const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;
      const apiBase = getApiBase();
      const url = `${apiBase}/api/registros/pdf/${mes}/${anio}?_t=${Date.now()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al generar PDF' }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      if (isNativeApp()) {
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        let saved = false;
        const dirs = [Directory.Documents, Directory.ExternalStorage, Directory.Cache];
        for (const dir of dirs) {
          try {
            await Filesystem.writeFile({ path: `RolPay/${filename}`, data: base64, directory: dir });
            saved = true;
            const { Toast } = await import('@capacitor/toast');
            await Toast.show({ text: `PDF guardado en ${dir === Directory.Cache ? 'Cache' : 'Descargas'}/${filename}`, duration: 'long' });
            break;
          } catch { /* try next dir */ }
        }
        if (!saved) throw new Error('No se pudo guardar el archivo en el dispositivo');
      } else {
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
      alert(err.message || 'Error al generar el PDF');
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
