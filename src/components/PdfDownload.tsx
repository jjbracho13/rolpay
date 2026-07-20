import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../types';

interface Props {
  mes: number;
  anio: number;
}

async function nukeAllSWs() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      try { await r.unregister(); } catch {}
    }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    } catch {}
  }
}

export default function PdfDownload({ mes, anio }: Props) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const [showLink, setShowLink] = useState(false);

  const pdfUrl = token
    ? `/api/registros/pdf/${mes}/${anio}?token=${encodeURIComponent(token)}`
    : '';

  const handleDownload = async () => {
    if (!token) {
      alert('No hay sesión activa');
      return;
    }
    setGenerating(true);
    setMsg('');
    setShowLink(false);

    try {
      const isAndroid = !!(window as any).Capacitor;

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
        const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.ExternalStorage });
        const { Toast } = await import('@capacitor/toast');
        await Toast.show({ text: `PDF guardado en Descargas/${filename}`, duration: 'long' });
      } else {
        // Step 1: Nuke all service workers
        await nukeAllSWs();

        // Step 2: Fetch PDF directly
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

        // Validate response is actually a PDF
        if (!ct.includes('pdf')) {
          const preview = await blob.text();
          if (preview.includes('<!doctype') || preview.includes('<html')) {
            throw new Error(
              'El navegador está sirviendo HTML cacheado en vez del PDF.\n\n' +
              'Solución: Abre la consola (F12), pega esto y dale Enter:\n' +
              'navigator.serviceWorker.getRegistrations().then(r=>{r.forEach(s=>s.unregister());location.reload()})'
            );
          }
          throw new Error('El servidor no devolvió un PDF válido');
        }

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `recibo_${MESES[mes - 1]}_${anio}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 5000);

        setMsg('PDF descargado correctamente');
      }
    } catch (err: any) {
      setMsg('');
      // Show error AND the direct link as fallback
      setShowLink(true);
      alert(err.message || 'Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleDownload}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition cursor-pointer text-sm"
      >
        {generating ? 'Descargando...' : 'Descargar PDF'}
      </button>
      {msg && <p className="text-green-400 text-xs">{msg}</p>}
      {showLink && pdfUrl && (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs space-y-1">
          <p className="text-yellow-400">Si el botón no funciona, copia este enlace y pégalo en una nueva pestaña:</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline break-all"
          >
            Abrir PDF en nueva pestaña
          </a>
        </div>
      )}
    </div>
  );
}
