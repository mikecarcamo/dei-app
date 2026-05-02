import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box } from '@mui/material';
import { Close, Download } from '@mui/icons-material';

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

export async function openOrDownloadPdf({ url, filename, token }) {
  if (isMobile()) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    return null;
  }
  return url + (url.includes('?') ? '&' : '?') + 'view=true';
}

export default function PdfViewerModal({ open, url, title, token, filename, onClose }) {
  if (!open || !url) return null;

  const handleDownload = async () => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const sep = url.includes('?') ? '&' : '?';
  const viewUrl = `${url}${sep}view=true&token=${encodeURIComponent(token)}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} fullWidth
      PaperProps={{ sx: { width: '95vw', maxWidth: '95vw', height: '95vh', maxHeight: '95vh', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {title}
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          <iframe
            src={viewUrl}
            title={title}
            style={{ width: '100%', height: '100%', border: 'none', minHeight: '70vh' }}
          />
        </Box>
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
