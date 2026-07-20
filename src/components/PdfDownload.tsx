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

  const handleDownload = async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const base = (window as any).Capacitor
        ? (localStorage.getItem('api_url') || 'https://rolpay.onrender.com/api').replace('/api', '')
        : '';
      const pdfUrl = `${base}/api/registros/pdf/${mes}/${anio}`;

      const res = await fetch(pdfUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let msg = 'Error al generar PDF';
        try { const j = await res.json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;

      if ((window as any).Capacitor) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const buf = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.ExternalStorage });
        const { Toast } = await import('@capacitor/toast');
        await Toast.show({ text: 'PDF guardado en Descargas', duration: 'long' });
      } else {
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
        }, 100);
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
      {generating ? 'Generando...' : 'Descargar PDF'}
    </button>
  );
}
