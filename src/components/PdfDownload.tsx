import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../types';

interface Props {
  mes: number;
  anio: number;
}

export default function PdfDownload({ mes, anio }: Props) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const getPdfUrl = () => {
    if (!token) return '';
    return `/api/registros/pdf/${mes}/${anio}?token=${encodeURIComponent(token)}`;
  };

  const handleDownload = async () => {
    if (!token) {
      setError('No hay sesión activa');
      return;
    }
    setGenerating(true);
    setError('');
    setLinkUrl('');

    try {
      const isAndroid = !!(window as any).Capacitor;

      if (isAndroid) {
        let apiBase = (localStorage.getItem('api_url') || 'https://rolpay.onrender.com/api').replace(/\/api\/?$/, '');
        const res = await fetch(`${apiBase}/api/registros/pdf/${mes}/${anio}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error al generar PDF' }));
          throw new Error(err.error || `Error ${res.status}`);
        }
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
        const url = getPdfUrl();
        const opened = window.open(url, '_blank');
        if (!opened) {
          setLinkUrl(url);
          setError('El navegador bloqueó la ventana. Haz clic en el enlace abaixo.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleDownload}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition cursor-pointer text-sm"
      >
        {generating ? 'Generando...' : 'Descargar PDF'}
      </button>
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline text-xs break-all"
        >
          Click aqui para descargar el PDF
        </a>
      )}
      {error && !linkUrl && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
