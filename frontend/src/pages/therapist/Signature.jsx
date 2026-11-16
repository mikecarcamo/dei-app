import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Alert, CircularProgress, Slider, Grid,
} from '@mui/material';
import { Upload, Save, Delete, AutoFixHigh } from '@mui/icons-material';
import api from '../../api/axios';
import { LicenseBanner, useTherapistLicense } from './common';

const TARGET_W = 280, TARGET_H = 84;

// Quita el fondo claro, recorta bordes transparentes y redimensiona a 280x84 conservando proporción.
function processSignature(dataUrl, threshold = 235) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const work = document.createElement('canvas');
      work.width = img.width;
      work.height = img.height;
      const ctx = work.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, work.width, work.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] >= threshold && d[i + 1] >= threshold && d[i + 2] >= threshold) d[i + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);

      // Recortar al contenido visible
      const px = ctx.getImageData(0, 0, work.width, work.height).data;
      let minX = work.width, minY = work.height, maxX = 0, maxY = 0;
      for (let yy = 0; yy < work.height; yy++) {
        for (let xx = 0; xx < work.width; xx++) {
          if (px[(yy * work.width + xx) * 4 + 3] > 10) {
            if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
            if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return reject(new Error('La imagen quedó vacía al quitar el fondo'));
      const cw = maxX - minX + 1, ch = maxY - minY + 1;
      if (cw < TARGET_W || ch < TARGET_H) {
        return reject(new Error(`La firma debe medir al menos ${TARGET_W}x${TARGET_H} px (detectado: ${cw}x${ch})`));
      }

      // Escalar a 280x84 conservando proporción (encajar)
      const scale = Math.min(TARGET_W / cw, TARGET_H / ch);
      const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
      const out = document.createElement('canvas');
      out.width = TARGET_W; out.height = TARGET_H;
      const octx = out.getContext('2d');
      octx.drawImage(work, minX, minY, cw, ch, (TARGET_W - dw) / 2, (TARGET_H - dh) / 2, dw, dh);
      resolve(out.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = dataUrl;
  });
}

export default function Signature() {
  const license = useTherapistLicense();
  const [original, setOriginal] = useState(null);   // imagen tal como se subió
  const [processed, setProcessed] = useState(null); // con fondo removido
  const [saved, setSaved] = useState(null);         // la que está en el servidor
  const [threshold, setThreshold] = useState(235);
  const [removeBg, setRemoveBg] = useState(true);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (license?.signature_image) setSaved(license.signature_image); }, [license]);

  useEffect(() => {
    if (!original) { setProcessed(null); return; }
    setMsg('');
    processSignature(original, removeBg ? threshold : 256)
      .then(setProcessed)
      .catch(e => { setProcessed(null); setMsg(e.message); });
  }, [original, threshold, removeBg]);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg('');
    const reader = new FileReader();
    reader.onload = () => setOriginal(reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!processed) { setMsg('Primero seleccione una imagen'); return; }
    setLoading(true); setMsg('');
    try {
      await api.post('/therapy/me/signature', { image: processed });
      setSaved(processed);
      setMsg('Firma guardada. Se usará al final de los PDF de tamizaje y ficha.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'No se pudo guardar la firma');
    } finally { setLoading(false); }
  };

  const remove = async () => {
    setLoading(true); setMsg('');
    try {
      await api.delete('/therapy/me/signature');
      setSaved(null); setOriginal(null); setProcessed(null);
      setMsg('Firma eliminada. Los PDF usarán solo su nombre.');
    } finally { setLoading(false); }
  };

  return (
    <Box maxWidth={700}>
      <Typography variant="h5" fontWeight={700} color="primary.main">Firma y sello</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Esta imagen aparecerá al final de sus PDF de tamizaje y de la ficha del paciente, junto a su nombre.
      </Typography>
      <LicenseBanner license={license} />

      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Button variant="outlined" component="label" startIcon={<Upload />} sx={{ mb: 2 }}>
            Seleccionar imagen (PNG o JPG)
            <input type="file" accept="image/png,image/jpeg" hidden onChange={onPick} />
          </Button>

          {original && (
            <>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" mb={0.5}>Original</Typography>
                  <Box sx={{ border: '1px dashed #CCC', borderRadius: 2, p: 1, bgcolor: '#EEE', textAlign: 'center' }}>
                    <img src={original} alt="Original" style={{ maxWidth: '100%', maxHeight: 160 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" mb={0.5}>Resultado (fondo transparente)</Typography>
                  <Box sx={{ border: '1px dashed #CCC', borderRadius: 2, p: 1, textAlign: 'center', bgcolor: 'repeating-conic-gradient(#DDD 0% 25%, #FFF 0% 50%) 0 0 / 20px 20px' }}>
                    {processed && <img src={processed} alt="Procesada" style={{ maxWidth: '100%', maxHeight: 160 }} />}
                  </Box>
                </Grid>
              </Grid>

              <Box mt={2}>
                <Button size="small" variant={removeBg ? 'contained' : 'outlined'} startIcon={<AutoFixHigh />}
                  onClick={() => setRemoveBg(r => !r)} sx={{ mr: 2 }}>
                  {removeBg ? 'Quitar fondo: activado' : 'Quitar fondo: desactivado'}
                </Button>
                {removeBg && (
                  <Box display="inline-flex" alignItems="center" gap={1} sx={{ verticalAlign: 'middle', width: 220 }}>
                    <Typography variant="caption" color="text.secondary">Sensibilidad</Typography>
                    <Slider size="small" min={200} max={250} value={threshold} onChange={(_, v) => setThreshold(v)} />
                  </Box>
                )}
              </Box>
            </>
          )}

          {msg && <Alert severity={msg.includes('guardada') || msg.includes('eliminada') ? 'success' : 'error'} sx={{ mt: 2 }}>{msg}</Alert>}

          <Box display="flex" gap={1} mt={2}>
            <Button variant="contained" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
              onClick={save} disabled={loading || !processed}>
              Guardar firma
            </Button>
            {saved && <Button color="error" startIcon={<Delete />} onClick={remove} disabled={loading}>Eliminar firma actual</Button>}
          </Box>
        </CardContent>
      </Card>

      {saved && (
        <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" mb={0.5}>Firma actual guardada</Typography>
            <Box sx={{ border: '1px dashed #CCC', borderRadius: 2, p: 1, textAlign: 'center', bgcolor: 'repeating-conic-gradient(#DDD 0% 25%, #FFF 0% 50%) 0 0 / 20px 20px' }}>
              <img src={saved} alt="Firma actual" style={{ maxWidth: '100%', maxHeight: 160 }} />
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
