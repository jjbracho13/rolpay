import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../types';

interface Props {
  mes: number;
  anio: number;
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    const saved = localStorage.getItem('api_url');
    if (saved) return saved.replace('/api', '');
    return 'https://rolpay.onrender.com';
  }
  return '';
}

export default function PdfDownload({ mes, anio }: Props) {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;

  const handleDownload = async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/registros/pdf/${mes}/${anio}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error' }));
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if ((window as any).Capacitor) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Downloads,
        });
        alert('PDF guardado en Descargas');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
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
      {generating ? 'Generando PDF...' : 'Descargar PDF'}
    </button>
  );
}
