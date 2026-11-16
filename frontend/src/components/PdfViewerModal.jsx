import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box, CircularProgress, Alert } from '@mui/material';
import { Close, Download } from '@mui/icons-material';
let pdfjsLibPromise = null;
const getPdfjs = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.js?url')]);
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })();
  }
  return pdfjsLibPromise;
};

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

const isLocalUrl = (url) => url.startsWith('data:') || url.startsWith('blob:');

export async function openOrDownloadPdf({ url, filename, token }) {
  if (isMobile()) {
    const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    return null;
  }
  // Adjuntos locales (data:/blob:): se convierten a ObjectURL.
  if (isLocalUrl(url)) {
    const res = await fetch(url);
    const blob = await res.blob();
    return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  }
  return url;
}

// Renderiza el PDF en canvas con pdf.js: no depende del visor nativo del navegador.
function PdfPages({ bytes }) {
  const containerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const pdf = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min((container.clientWidth - 24) / base.width, 2) || 1;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'display:block;margin:0 auto 14px;box-shadow:0 2px 10px rgba(0,0,0,.4);background:#fff;max-width:100%;';
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch (e) {
        if (!cancelled) setError('No se pudo mostrar el PDF. Use el botón Descargar.');
      }
    })();
    return () => { cancelled = true; if (container) container.innerHTML = ''; };
  }, [bytes]);

  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  return <div ref={containerRef} style={{ padding: 12, background: '#525659', minHeight: '70vh' }} />;
}

export default function PdfViewerModal({ open, url, title, token, filename, onClose }) {
  const [bytes, setBytes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !url) return;
    setBytes(null); setError('');
    fetch(url, token && !isLocalUrl(url) ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setBytes(await res.arrayBuffer());
      })
      .catch(() => setError('No se pudo cargar el PDF. Intente descargarlo.'));
  }, [open, url, token]);

  const handleDownload = async () => {
    let blob;
    if (bytes) blob = new Blob([bytes], { type: 'application/pdf' });
    else {
      const res = await fetch(url, token && !isLocalUrl(url) ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      blob = await res.blob();
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} fullWidth
      PaperProps={{ sx: { width: '95vw', maxWidth: '95vw', height: '95vh', maxHeight: '95vh', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {title}
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, overflow: 'auto', bgcolor: '#525659' }}>
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        {!error && !bytes && <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>}
        {bytes && <PdfPages bytes={bytes} />}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button startIcon={<Download />} variant="outlined" size="small" onClick={handleDownload}>
          Descargar
        </Button>
        <Button onClick={onClose} size="small">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
