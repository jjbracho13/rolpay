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
      const url = `${base}/api/registros/pdf/${mes}/${anio}?token=${token}`;

      if ((window as any).Capacitor) {
        const res = await fetch(`${base}/api/registros/pdf/${mes}/${anio}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al generar PDF');
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.ExternalStorage });
        const { Toast } = await import('@capacitor/toast');
        await Toast.show({ text: 'PDF guardado en Descargas', duration: 'long' });
      } else {
        window.open(url, '_blank');
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
