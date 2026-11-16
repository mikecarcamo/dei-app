import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, Grid, Dialog, DialogContent, DialogActions, IconButton, Tooltip,
} from '@mui/material';
import { ArrowBack, Edit, FactCheck, Visibility, WarningAmber, Description, Link as LinkIcon } from '@mui/icons-material';
import api from '../../api/axios';
import PdfViewerModal, { openOrDownloadPdf } from '../../components/PdfViewerModal';
import { PatientDialog, ScreeningResult, LicenseBanner, useTherapistLicense, fmtDateTime, severityColor } from './common';

const SEX = { F: 'Femenino', M: 'Masculino', O: 'Otro' };
const SHORT = { PHQ9: 'PHQ-9', GAD7: 'GAD-7', PCL5: 'PCL-5', CSSRS: 'C-SSRS' };

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const license = useTherapistLicense();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [pdfViewer, setPdfViewer] = useState(null);

  const load = () => api.get(`/therapy/patients/${id}`).then(({ data }) => setData(data)).catch(e => setError(e.response?.data?.message || 'Error al cargar'));
  useEffect(() => { load(); }, [id]);

  const openScreening = async (s) => {
    const { data: detail } = await api.get(`/therapy/screenings/${s.id}`);
    setViewing(detail);
  };

  const openFicha = async () => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const url = `${baseURL}/therapy/patients/${id}/ficha.pdf`;
    const token = localStorage.getItem('dei_token');
    const filename = `ficha_${data.code}.pdf`;
    const viewUrl = await openOrDownloadPdf({ url, filename, token });
    if (viewUrl) setPdfViewer({ url, title: `Ficha ${data.code} — ${data.full_name}`, filename, token });
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  const info = [
    ['Código', data.code], ['Edad', data.age != null ? `${data.age} años` : '—'], ['Sexo', SEX[data.sex] || '—'],
    ['Fecha de nacimiento', data.birth_date || '—'], ['Teléfono', data.phone || '—'], ['Correo', data.email || '—'],
    ['Consentimiento', data.consent ? `Sí (${data.consent_date})` : 'No'],
  ];

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/terapeuta/pacientes')} sx={{ mb: 1 }}>Pacientes</Button>
      <LicenseBanner license={license} />

      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} mb={1}>
            <Box>
              <Typography variant="h5" fontWeight={700} color="primary.main">{data.full_name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{data.code}</Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Button variant="outlined" startIcon={<Description />} onClick={openFicha}>Ficha</Button>
              <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditOpen(true)} disabled={!license?.active}>Editar</Button>
              <Button variant="contained" startIcon={<FactCheck />} onClick={() => navigate(`/terapeuta/tamizaje?patient=${data.id}`)} disabled={!license?.active}>Nuevo tamizaje</Button>
            </Box>
          </Box>
          <Grid container spacing={1}>
            {info.map(([k, v]) => (
              <Grid item xs={12} sm={6} md={3} key={k}><Typography variant="body2"><b>{k}:</b> {v}</Typography></Grid>
            ))}
          </Grid>
          {[['Motivo de consulta', data.consultation_reason], ['Antecedentes', data.background], ['Medicación actual', data.medication]]
            .filter(([, v]) => v).map(([k, v]) => (
              <Typography key={k} variant="body2" mt={1}><b>{k}:</b> {v}</Typography>
            ))}
        </CardContent>
      </Card>

      <Typography variant="subtitle1" fontWeight={700} color="primary.main" mb={1}>Historial de tamizajes</Typography>
      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                <TableCell><b>#</b></TableCell>
                <TableCell><b>Fecha</b></TableCell>
                <TableCell><b>Terapeuta</b></TableCell>
                <TableCell><b>Resultados</b></TableCell>
                <TableCell><b>Riesgo</b></TableCell>
                <TableCell><b>Hipótesis IA</b></TableCell>
                <TableCell align="center"><b>Ver</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.screenings.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.id}</TableCell>
                  <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {fmtDateTime(s.screened_at)}
                    {s.source === 'link' && !s.viewed_at && <Chip label="Nuevo" color="primary" size="small" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />}
                    {s.source === 'link' && s.viewed_at && <Chip label="Link" size="small" variant="outlined" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{s.therapist_name}</TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {s.results.map(r => (
                        <Chip key={r.code} size="small" color={severityColor(r.severity)} variant="outlined"
                          label={r.code === 'CSSRS' ? `${SHORT[r.code]}: ${r.severity}` : `${SHORT[r.code]}: ${r.score}/${r.max}`} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {s.risk_alert ? <Chip icon={<WarningAmber />} label={s.risk_level} color="error" size="small" /> : <Chip label="Sin alerta" size="small" />}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {s.ai_result?.hipotesis?.length ? s.ai_result.hipotesis.map(h => h.codigo_cie10).join(', ') : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Ver tamizaje"><IconButton size="small" onClick={() => openScreening(s)}><Visibility fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {data.screenings.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>Este paciente aún no tiene tamizajes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <PatientDialog open={editOpen} patient={data} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} />

      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="lg" fullWidth>
        <DialogContent sx={{ bgcolor: '#F5F7FA' }}>
          {viewing && <ScreeningResult screening={viewing} canRegenerate={!!license?.active}
            onUpdated={(s) => { setViewing(s); load(); }} />}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewing(null)}>Cerrar</Button></DialogActions>
      </Dialog>

      {pdfViewer && (
        <PdfViewerModal open={!!pdfViewer} url={pdfViewer.url} title={pdfViewer.title}
          token={pdfViewer.token} filename={pdfViewer.filename} onClose={() => setPdfViewer(null)} />
      )}
    </Box>
  );
}
