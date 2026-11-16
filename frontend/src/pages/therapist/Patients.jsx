import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, CircularProgress, TextField, InputAdornment,
} from '@mui/material';
import { PersonAdd, Search, History, FactCheck, Description, Link as LinkIcon } from '@mui/icons-material';
import { Chip, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, Alert } from '@mui/material';
import api from '../../api/axios';
import PdfViewerModal, { openOrDownloadPdf } from '../../components/PdfViewerModal';
import { PatientDialog, LicenseBanner, useTherapistLicense, fmtDateTime } from './common';

const LINK_INSTRUMENTS = [
  { code: 'PHQ9', name: 'PHQ-9 (depresión)' },
  { code: 'GAD7', name: 'GAD-7 (ansiedad)' },
  { code: 'PCL5', name: 'PCL-5 (estrés postraumático)' },
  { code: 'CSSRS', name: 'C-SSRS (riesgo suicida)' },
];

export default function Patients() {
  const navigate = useNavigate();
  const license = useTherapistLicense();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [pdfViewer, setPdfViewer] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [linkSelected, setLinkSelected] = useState({ PHQ9: true, GAD7: true, PCL5: false, CSSRS: false });
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  const openFicha = async (p) => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const url = `${baseURL}/therapy/patients/${p.id}/ficha.pdf`;
    const token = localStorage.getItem('dei_token');
    const filename = `ficha_${p.code}.pdf`;
    const viewUrl = await openOrDownloadPdf({ url, filename, token });
    if (viewUrl) setPdfViewer({ url, title: `Ficha ${p.code} — ${p.full_name}`, filename, token });
  };

  const openLink = (p) => { setLinkFor(p); setLinkUrl(''); setLinkError(''); };

  const generateLink = async () => {
    setLinkError('');
    const instruments = Object.keys(linkSelected).filter(k => linkSelected[k]);
    if (!instruments.length) { setLinkError('Seleccione al menos un instrumento'); return; }
    try {
      const { data } = await api.post(`/therapy/patients/${linkFor.id}/links`, { instruments });
      setLinkUrl(`${window.location.origin}/tamizaje/${data.token}`);
    } catch (e) {
      setLinkError(e.response?.data?.message || 'No se pudo generar el link');
    }
  };

  const load = (query = q) => {
    setLoading(true);
    api.get('/therapy/patients', { params: { q: query } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Pacientes</Typography>
          <Typography variant="body2" color="text.secondary">Registro de pacientes e historial de tamizajes</Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setDialog(true)} disabled={!license?.active}>Nuevo paciente</Button>
      </Box>

      <LicenseBanner license={license} />

      <TextField fullWidth size="small" placeholder="Buscar por código o nombre" value={q} onChange={e => setQ(e.target.value)} sx={{ mb: 2, bgcolor: 'white' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                  <TableCell><b>Código</b></TableCell>
                  <TableCell><b>Paciente</b></TableCell>
                  <TableCell align="center"><b>Tamizajes</b></TableCell>
                  <TableCell><b>Último tamizaje</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(p => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/terapeuta/pacientes/${p.id}`)}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{p.code}</TableCell>
                    <TableCell>{p.full_name}</TableCell>
                    <TableCell align="center">{p.screenings_count}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtDateTime(p.last_screening_at)}</TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Ficha (PDF)"><IconButton size="small" onClick={() => openFicha(p)}><Description fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Historial"><IconButton size="small" onClick={() => navigate(`/terapeuta/pacientes/${p.id}`)}><History fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Nuevo tamizaje"><span><IconButton size="small" color="primary" disabled={!license?.active}
                        onClick={() => navigate(`/terapeuta/tamizaje?patient=${p.id}`)}><FactCheck fontSize="small" /></IconButton></span></Tooltip>
                      {p.pending_new > 0 && <Chip label="Nuevo" color="primary" size="small" sx={{ height: 20, fontSize: 11, ml: 0.5 }} />}
                      <Tooltip title="Enviar link al paciente"><span><IconButton size="small" disabled={!license?.active}
                        onClick={() => openLink(p)}><LinkIcon fontSize="small" /></IconButton></span></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay pacientes registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <PatientDialog open={dialog} onClose={() => setDialog(false)} onSaved={(p) => { setDialog(false); navigate(`/terapeuta/pacientes/${p.id}`); }} />

      <Dialog open={!!linkFor} onClose={() => setLinkFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Link de tamizaje — {linkFor?.code}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Seleccione los instrumentos que el paciente responderá. El link es de un solo uso;
            al enviarlo, el paciente no verá los resultados.
          </Typography>
          {linkError && <Alert severity="error" sx={{ mb: 1 }}>{linkError}</Alert>}
          {LINK_INSTRUMENTS.map(i => (
            <Box key={i.code}>
              <FormControlLabel label={i.name}
                control={<Checkbox size="small" checked={!!linkSelected[i.code]} onChange={e => setLinkSelected(s => ({ ...s, [i.code]: e.target.checked }))} />} />
            </Box>
          ))}
          {linkUrl && (
            <TextField fullWidth size="small" sx={{ mt: 1 }} label="Link generado" value={linkUrl}
              InputProps={{ readOnly: true }} onClick={e => e.target.select()}
              helperText="Copie y comparta este link con el paciente" />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkFor(null)}>Cerrar</Button>
          {!linkUrl
            ? <Button variant="contained" onClick={generateLink}>Generar link</Button>
            : <Button variant="contained" onClick={() => navigator.clipboard.writeText(linkUrl)}>Copiar link</Button>}
        </DialogActions>
      </Dialog>

      {pdfViewer && (
        <PdfViewerModal open={!!pdfViewer} url={pdfViewer.url} title={pdfViewer.title}
          token={pdfViewer.token} filename={pdfViewer.filename} onClose={() => setPdfViewer(null)} />
      )}
    </Box>
  );
}
