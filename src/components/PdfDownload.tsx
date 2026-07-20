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

  const handleDownload = () => {
    if (!token) {
      alert('No hay sesión activa');
      return;
    }
    setGenerating(true);

    const isAndroid = !!(window as any).Capacitor;
    const filename = `recibo_${MESES[mes - 1]}_${anio}.pdf`;

    if (isAndroid) {
      (async () => {
        try {
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
        } catch (err: any) {
          alert(err.message || 'Error al generar el PDF');
        } finally {
          setGenerating(false);
        }
      })();
    } else {
      const url = `/api/registros/pdf/${mes}/${anio}?token=${encodeURIComponent(token)}`;
      window.location.href = url;
      setTimeout(() => setGenerating(false), 2000);
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
