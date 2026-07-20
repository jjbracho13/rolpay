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
      const isAndroid = !!(window as any).Capacitor;
      const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;

      let apiUrl: string;
      if (isAndroid) {
        apiUrl = (localStorage.getItem('api_url') || 'https://rolpay.onrender.com/api').replace(/\/api\/?$/, '') + `/api/registros/pdf/${mes}/${anio}`;
      } else {
        apiUrl = `/api/registros/pdf/${mes}/${anio}`;
      }

      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al generar PDF' }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const blob = await res.blob();

      if (isAndroid) {
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.ExternalStorage });
        const { Toast } = await import('@capacitor/toast');
        await Toast.show({ text: `PDF guardado en Descargas/${filename}`, duration: 'long' });
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
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
