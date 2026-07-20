import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../types';

interface Props {
  mes: number;
  anio: number;
}

async function clearServiceWorker() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  }
}

export default function PdfDownload({ mes, anio }: Props) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  const handleDownload = async () => {
    if (!token) {
      alert('No hay sesión activa');
      return;
    }
    setGenerating(true);
    setMsg('');

    try {
      const isAndroid = !!(window as any).Capacitor;
      const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;

      if (isAndroid) {
        let apiBase = (localStorage.getItem('api_url') || 'https://rolpay.onrender.com/api').replace(/\/api\/?$/, '');
        const res = await fetch(`${apiBase}/api/registros/pdf/${mes}/${anio}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al generar PDF');
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.ExternalStorage });
        const { Toast } = await import('@capacitor/toast');
        await Toast.show({ text: `PDF guardado en Descargas/${filename}`, duration: 'long' });
      } else {
        await clearServiceWorker();

        const res = await fetch(`/api/registros/pdf/${mes}/${anio}?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error al generar PDF' }));
          throw new Error(err.error || `Error ${res.status}`);
        }

        const ct = res.headers.get('content-type') || '';
        const blob = await res.blob();

        if (!ct.includes('pdf') && blob.size < 1000) {
          const text = await blob.text();
          if (text.includes('<!doctype') || text.includes('<html')) {
            throw new Error('El servidor devolvió HTML en vez de PDF. La cache del navegador está obsoleta. Presiona Ctrl+Shift+R y vuelve a intentar.');
          }
        }

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 1000);

        setMsg('PDF descargado. Si no ves el archivo, revisa la carpeta de Descargas.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition cursor-pointer text-sm"
      >
        {generating ? 'Descargando...' : 'Descargar PDF'}
      </button>
      {msg && <p className="text-green-400 text-xs mt-1">{msg}</p>}
    </div>
  );
}
