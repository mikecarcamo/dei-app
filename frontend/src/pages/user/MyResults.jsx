import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, List, ListItemButton, ListItemText,
  ListItemIcon, Chip, CircularProgress, Alert, Divider, Collapse,
  LinearProgress, Paper, Button, IconButton, Tooltip,
} from '@mui/material';
import {
  Event, ExpandMore, ExpandLess, Person, EmojiPeople,
  ArrowBack, CalendarMonth, PictureAsPdf, Download,
} from '@mui/icons-material';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const TEMP_LABELS = { SANGUINEO: 'Sanguíneo', COLERICO: 'Colérico', MELANCOLICO: 'Melancólico', FLEMATICO: 'Flemático' };

function formatLocalDate(str) {
  if (!str) return '—';
  const [datePart, timePart] = str.split(' ');
  const [y, m, d] = datePart.split('-');
  const [hh, mm] = (timePart || '00:00').split(':');
  return new Date(y, m - 1, d, hh, mm).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const TEMP_COLORS = { SANGUINEO: '#42A5F5', COLERICO: '#EF5350', MELANCOLICO: '#7E57C2', FLEMATICO: '#66BB6A' };
const NIVEL_COLOR = { BAJO: '#66BB6A', MEDIO: '#FFA726', ALTO: '#EF5350' };

function ConsolidatedDialog({ open, event, onClose }) {
  const [downloading, setDownloading] = useState(null);

  const handleDownload = async (detailMode) => {
    setDownloading(detailMode);
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const url = `${baseURL}/reports/consolidated/${event.id}?detail=${detailMode}`;
      const token = localStorage.getItem('dei_token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `consolidado_${(event.name || 'evento').replace(/\s+/g, '_')}.pdf`;
      link.click();
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>PDF Consolidado</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>{event?.name}</Typography>
        <Box display="flex" flexDirection="column" gap={1.5}>
          <Button fullWidth variant="outlined" color="secondary" startIcon={downloading === 'false' ? <CircularProgress size={18} /> : <Download />}
            disabled={!!downloading} onClick={() => handleDownload('false')}>
            Resumen general (tabla de participantes)
          </Button>
          <Button fullWidth variant="outlined" color="secondary" startIcon={downloading === 'true' ? <CircularProgress size={18} /> : <Download />}
            disabled={!!downloading} onClick={() => handleDownload('true')}>
            Con conclusión por persona
          </Button>
          <Button fullWidth variant="contained" color="secondary" startIcon={downloading === 'full' ? <CircularProgress size={18} /> : <Download />}
            disabled={!!downloading} onClick={() => handleDownload('full')}>
            Con detalle de respuestas por persona
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!downloading}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

async function downloadPdf(responseId, name) {
  const { default: apiFn } = await import('../../api/axios');
  const res = await apiFn.get(`/reports/individual/${responseId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `resultado_${(name || 'resultado').replace(/\s+/g, '_')}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function ResultCard({ result, testType }) {
  const isBurnout = testType === 'BURNOUT';
  const total = result.score_a + result.score_b + result.score_c + result.score_d;
  const domLabel = (result.dominant_temperament || '').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático');

  const burnoutSubescalas = [
    { label: 'Cansancio Emocional', score: result.burnout_ce, nivel: result.burnout_ce_nivel, max: 54, indicio: result.burnout_ce_nivel === 'ALTO' },
    { label: 'Despersonalización',  score: result.burnout_dp, nivel: result.burnout_dp_nivel, max: 30, indicio: result.burnout_dp_nivel === 'ALTO' },
    { label: 'Realización Personal', score: result.burnout_rp, nivel: result.burnout_rp_nivel, max: 48, indicio: result.burnout_rp_nivel === 'BAJO', invertColor: true },
  ];

  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${isBurnout ? '#FBE9E7' : '#E3F2FD'}`, mb: 1.5 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <Person sx={{ color: isBurnout ? '#BF360C' : '#1565C0', fontSize: 20 }} />
          <Typography fontWeight={700}>{result.participant_full_name}</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {!isBurnout && domLabel && <Chip label={domLabel} size="small" sx={{ bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 700 }} />}
          {isBurnout && result.burnout_diagnostico && (
            <Chip label={result.burnout_diagnostico.split('.')[0]} size="small" sx={{ bgcolor: '#FBE9E7', color: '#BF360C', fontWeight: 700, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} />
          )}
          <Typography variant="caption" color="text.secondary">
            {formatLocalDate(result.submitted_at)}
          </Typography>
        </Box>
      </Box>

      {isBurnout ? (
        <Box>
          {burnoutSubescalas.map(s => (
            <Box key={s.label} display="flex" alignItems="center" gap={1.5} mb={0.8}>
              <Typography variant="caption" sx={{ minWidth: 140, color: 'text.secondary' }}>{s.label}</Typography>
              <Box flex={1}>
                <LinearProgress variant="determinate" value={s.score != null ? (s.score / s.max) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#F5F5F5', '& .MuiLinearProgress-bar': { bgcolor: s.invertColor ? NIVEL_COLOR[s.nivel === 'BAJO' ? 'ALTO' : s.nivel === 'ALTO' ? 'BAJO' : 'MEDIO'] : (NIVEL_COLOR[s.nivel] || '#90A4AE'), borderRadius: 4 } }} />
              </Box>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="caption" fontWeight={700} sx={{ minWidth: 28 }}>{s.score ?? 0}</Typography>
                <Chip label={s.nivel || '—'} size="small" sx={{ height: 18, fontSize: 10, bgcolor: s.invertColor ? NIVEL_COLOR[s.nivel === 'BAJO' ? 'ALTO' : s.nivel === 'ALTO' ? 'BAJO' : 'MEDIO'] : (NIVEL_COLOR[s.nivel] || '#E0E0E0'), color: 'white', fontWeight: 700 }} />
                {s.indicio && <Chip label="⚠" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box>
          {[
            { label: 'Sanguíneo', score: result.score_a, temp: 'SANGUINEO' },
            { label: 'Colérico', score: result.score_b, temp: 'COLERICO' },
            { label: 'Melancólico', score: result.score_c, temp: 'MELANCOLICO' },
            { label: 'Flemático', score: result.score_d, temp: 'FLEMATICO' },
          ].map(item => (
            <Box key={item.temp} display="flex" alignItems="center" gap={1.5} mb={0.8}>
              <Typography variant="caption" sx={{ minWidth: 90, color: 'text.secondary' }}>{item.label}</Typography>
              <Box flex={1}>
                <LinearProgress variant="determinate" value={total > 0 ? (item.score / total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#F5F5F5', '& .MuiLinearProgress-bar': { bgcolor: TEMP_COLORS[item.temp], borderRadius: 4 } }} />
              </Box>
              <Typography variant="caption" fontWeight={700} sx={{ minWidth: 40, textAlign: 'right' }}>
                {item.score} ({total > 0 ? ((item.score / total) * 100).toFixed(0) : 0}%)
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box mt={1.5} display="flex" justifyContent="flex-end">
        <Tooltip title="Descargar PDF Individual">
          <Button size="small" variant="outlined" startIcon={<PictureAsPdf />}
            onClick={() => downloadPdf(result.id, result.participant_full_name)}
            sx={{ borderRadius: 2, fontSize: 12, borderColor: isBurnout ? '#BF360C' : undefined, color: isBurnout ? '#BF360C' : undefined }}
          >
            PDF
          </Button>
        </Tooltip>
      </Box>
    </Paper>
  );
}

export default function MyResults() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState(null);

  useEffect(() => {
    api.get('/responses/my-events')
      .then(({ data }) => setEvents(data))
      .catch(() => setError('Error al cargar eventos'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectEvent = async (event) => {
    if (expandedEvent === event.id) {
      setExpandedEvent(null);
      setSelectedEvent(null);
      setResults([]);
      return;
    }
    setExpandedEvent(event.id);
    setSelectedEvent(event);
    setLoadingResults(true);
    try {
      const { data } = await api.get(`/responses/my-events/${event.id}/results`);
      setResults(data.results || []);
    } catch {
      setError('Error al cargar resultados');
    } finally {
      setLoadingResults(false);
    }
  };

  const isEmpresa = user?.role === 'EMPRESA';
  const [consolidatedEvent, setConsolidatedEvent] = useState(null);

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;

  return (
    <Box maxWidth={800} mx="auto">
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          {isEmpresa ? 'Resultados de mi Empresa' : 'Mis Resultados'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isEmpresa
            ? 'Selecciona un evento para ver todos los participantes y sus temperamentos'
            : 'Selecciona un evento para ver tus resultados'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {events.length === 0 ? (
        <Alert severity="info">No hay eventos con resultados disponibles.</Alert>
      ) : (
        events.map(ev => (
          <Card key={ev.id} sx={{ mb: 2, borderRadius: 2, boxShadow: 1, border: expandedEvent === ev.id ? '1.5px solid #1565C0' : '1.5px solid #E0E0E0' }}>
            <ListItemButton onClick={() => handleSelectEvent(ev)} sx={{ borderRadius: 2, p: 2 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Event sx={{ color: '#1565C0' }} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography fontWeight={600}>{ev.name}</Typography>}
                secondary={
                  <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                    <Chip icon={<CalendarMonth sx={{ fontSize: 14 }} />} label={`${ev.start_date} → ${ev.end_date}`} size="small" variant="outlined" />
                    <Chip icon={<EmojiPeople sx={{ fontSize: 14 }} />} label={`${ev.total_responses} resultado${ev.total_responses !== 1 ? 's' : ''}`} size="small" color="primary" variant="outlined" />
                    <Chip label={ev.test_name} size="small" sx={{ bgcolor: '#F5F5F5' }} />
                  </Box>
                }
              />
              {expandedEvent === ev.id ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>

            <Collapse in={expandedEvent === ev.id}>
              <Divider />
              <Box p={2}>
                {loadingResults ? (
                  <Box display="flex" justifyContent="center" py={3}><CircularProgress size={32} /></Box>
                ) : results.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    {isEmpresa ? 'Aún no hay respuestas en este evento.' : 'Aún no has llenado el test en este evento.'}
                  </Alert>
                ) : (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
                      {results.length} participante{results.length !== 1 ? 's' : ''}
                    </Typography>
                    {isEmpresa && (
                      <Box display="flex" justifyContent="flex-end" mb={1.5}>
                        <Button size="small" variant="contained" color="secondary" startIcon={<PictureAsPdf />}
                          onClick={() => setConsolidatedEvent(selectedEvent)}>
                          PDF Consolidado
                        </Button>
                      </Box>
                    )}
                    {results.map(r => <ResultCard key={r.id} result={r} testType={selectedEvent?.test_type} />)}
                  </>
                )}
              </Box>
            </Collapse>
          </Card>
        ))
      )}
      {consolidatedEvent && (
        <ConsolidatedDialog open={!!consolidatedEvent} event={consolidatedEvent} onClose={() => setConsolidatedEvent(null)} />
      )}
    </Box>
  );
}
