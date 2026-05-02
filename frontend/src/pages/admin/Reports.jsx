import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, CircularProgress, Alert,
  Accordion, AccordionSummary, AccordionDetails, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox,
  LinearProgress, Divider, FormControl, InputLabel, Select, MenuItem, Paper,
} from '@mui/material';
import {
  ExpandMore, PictureAsPdf, Assessment, Event, People,
  Download, Visibility, FilterList,
} from '@mui/icons-material';
import api from '../../api/axios';

const TEMP_LABELS = { SANGUINEO: 'Sanguíneo', COLERICO: 'Colérico', MELANCOLICO: 'Melancólico', FLEMATICO: 'Flemático' };

function ConsolidatedDialog({ open, event, onClose }) {
  const [includeDetail, setIncludeDetail] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = `http://localhost:4000/api/reports/consolidated/${event.id}?detail=${includeDetail}`;
      const token = localStorage.getItem('dei_token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `consolidado_${event.name.replace(/\s+/g, '_')}.pdf`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>PDF Consolidado</DialogTitle>
      <DialogContent>
        <Typography variant="body2" mb={2}>{event?.name}</Typography>
        <FormControlLabel
          control={<Checkbox checked={includeDetail} onChange={e => setIncludeDetail(e.target.checked)} />}
          label="Incluir detalle completo por persona"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" startIcon={<Download />} onClick={handleDownload} disabled={downloading}>
          {downloading ? <CircularProgress size={20} /> : 'Descargar PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ResponseDetail({ responseId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/responses/${responseId}`)
      .then(({ data }) => setDetail(data))
      .finally(() => setLoading(false));
  }, [responseId]);

  if (loading) return <CircularProgress size={20} />;
  if (!detail) return null;

  const domLabel = (detail.dominant_temperament || '').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático');
  const secLabel = detail.secondary_temperament ? (TEMP_LABELS[detail.secondary_temperament] || detail.secondary_temperament) : '—';
  const total = detail.score_a + detail.score_b + detail.score_c + detail.score_d;

  return (
    <Box sx={{ bgcolor: '#F9FAFB', p: 2, borderRadius: 2 }}>
      <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
        <Chip label={`Dominante: ${domLabel}`} color="primary" />
        {detail.secondary_temperament && <Chip label={`Secundario: ${secLabel}`} color="secondary" />}
      </Box>
      <Box mb={2}>
        {[
          { label: 'Sanguíneo (A)', score: detail.score_a, color: '#42A5F5' },
          { label: 'Colérico (B)', score: detail.score_b, color: '#EF5350' },
          { label: 'Melancólico (C)', score: detail.score_c, color: '#7E57C2' },
          { label: 'Flemático (D)', score: detail.score_d, color: '#66BB6A' },
        ].map(item => (
          <Box key={item.label} display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant="caption" sx={{ width: 110 }}>{item.label}</Typography>
            <LinearProgress variant="determinate" value={total > 0 ? (item.score / total) * 100 : 0}
              sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: '#E0E0E0', '& .MuiLinearProgress-bar': { bgcolor: item.color } }} />
            <Typography variant="caption" fontWeight={700} sx={{ width: 30, textAlign: 'right' }}>{item.score}</Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line', display: 'block', fontSize: 11 }}>
        {detail.conclusion}
      </Typography>
    </Box>
  );
}

function EventResponses({ event }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [consolidatedOpen, setConsolidatedOpen] = useState(false);
  const [annulling, setAnnulling] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/responses/event/${event.id}`)
      .then(({ data }) => { setResponses(data); setLoaded(true); })
      .finally(() => setLoading(false));
  };

  const handleAnnul = async (id) => {
    if (!window.confirm('¿Anular esta respuesta? No puede deshacerse.')) return;
    setAnnulling(id);
    try {
      await api.put(`/responses/${id}/annul`);
      load();
    } finally {
      setAnnulling(null);
    }
  };

  const handleDownloadIndividual = async (responseId, name) => {
    const token = localStorage.getItem('dei_token');
    const response = await fetch(`http://localhost:4000/api/reports/individual/${responseId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resultado_${name.replace(/\s+/g, '_')}.pdf`;
    link.click();
  };

  const domLabel = (t) => (t || '').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático');

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle2" color="text.secondary">
          {loaded ? `${responses.length} respuesta(s)` : 'Clic en el acordeón para cargar'}
        </Typography>
        <Box display="flex" gap={1}>
          {!loaded && <Button size="small" variant="outlined" onClick={load} disabled={loading}>Cargar respuestas</Button>}
          <Button size="small" variant="contained" startIcon={<PictureAsPdf />} onClick={() => setConsolidatedOpen(true)} color="secondary">
            PDF Consolidado
          </Button>
        </Box>
      </Box>

      {loading && <CircularProgress size={24} />}

      {loaded && responses.length === 0 && (
        <Typography color="text.secondary" variant="body2">Sin respuestas para este evento.</Typography>
      )}

      {loaded && responses.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                <TableCell><b>Participante</b></TableCell>
                <TableCell><b>Dominante</b></TableCell>
                <TableCell><b>Secundario</b></TableCell>
                <TableCell><b>Fecha</b></TableCell>
                <TableCell align="center"><b>Acciones</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {responses.map(r => (
                <React.Fragment key={r.id}>
                  <TableRow hover sx={{ cursor: 'pointer' }}>
                    <TableCell onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <Typography variant="body2" fontWeight={600}>{r.participant_full_name}</Typography>
                      {r.user_name && <Typography variant="caption" color="text.secondary">{r.user_name}</Typography>}
                    </TableCell>
                    <TableCell><Chip label={domLabel(r.dominant_temperament)} size="small" color="primary" /></TableCell>
                    <TableCell><Typography variant="caption">{r.secondary_temperament ? TEMP_LABELS[r.secondary_temperament] : '—'}</Typography></TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{new Date(r.submitted_at).toLocaleDateString('es-HN')}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver detalle">
                        <IconButton size="small" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Descargar PDF individual">
                        <IconButton size="small" color="primary" onClick={() => handleDownloadIndividual(r.id, r.participant_full_name)}>
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Anular respuesta">
                        <span>
                          <IconButton size="small" color="error" onClick={() => handleAnnul(r.id)} disabled={annulling === r.id}>
                            {annulling === r.id ? <CircularProgress size={14} /> : <span style={{ fontSize: 14 }}>✕</span>}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  {expanded === r.id && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ bgcolor: '#FAFAFA', p: 0 }}>
                        <Box sx={{ p: 2 }}>
                          <ResponseDetail responseId={r.id} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConsolidatedDialog open={consolidatedOpen} event={event} onClose={() => setConsolidatedOpen(false)} />
    </Box>
  );
}

export default function Reports() {
  const [events, setEvents] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  useEffect(() => {
    Promise.all([
      api.get('/events'),
      api.get('/entities'),
    ]).then(([evRes, entRes]) => {
      setEvents(evRes.data);
      setEntities(entRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const hasFilter = filterEntity !== '' || filterStatus !== 'todos';

  const filteredEvents = useMemo(() => {
    if (!hasFilter) return [];
    return events.filter(ev => {
      const matchEntity = !filterEntity || ev.entity_id === Number(filterEntity);
      const matchStatus = filterStatus === 'todos'
        ? true
        : filterStatus === 'activo' ? ev.active === 1 : ev.active === 0;
      return matchEntity && matchStatus;
    });
  }, [events, filterEntity, filterStatus, hasFilter]);

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700} color="primary.main">Reportes</Typography>
        <Typography variant="body2" color="text.secondary">Ver respuestas y descargar PDF por evento</Typography>
      </Box>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#F5F7FA' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <FilterList fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={700} color="primary.main">Filtros</Typography>
        </Box>
        <Box display="flex" gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Entidad</InputLabel>
            <Select
              value={filterEntity}
              label="Entidad"
              onChange={e => setFilterEntity(e.target.value)}
            >
              <MenuItem value=""><em>Todas las entidades</em></MenuItem>
              {entities.map(ent => (
                <MenuItem key={ent.id} value={ent.id}>{ent.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filterStatus}
              label="Estado"
              onChange={e => setFilterStatus(e.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="activo">Activos</MenuItem>
              <MenuItem value="inactivo">Inactivos</MenuItem>
            </Select>
          </FormControl>

          {(filterEntity || filterStatus !== 'todos') && (
            <Button size="small" variant="text" color="inherit"
              onClick={() => { setFilterEntity(''); setFilterStatus('todos'); }}
              sx={{ color: 'text.secondary' }}>
              Limpiar filtros
            </Button>
          )}
        </Box>
        {hasFilter && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''} encontrado{filteredEvents.length !== 1 ? 's' : ''}
          </Typography>
        )}
      </Paper>

      {loading && <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>}

      {!loading && !hasFilter && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Seleccione una entidad o un estado para ver los eventos.
        </Alert>
      )}

      {!loading && hasFilter && filteredEvents.length === 0 && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>No hay eventos que coincidan con los filtros seleccionados.</Alert>
      )}

      {filteredEvents.map(ev => (
        <Accordion key={ev.id} sx={{ mb: 1, borderRadius: '8px !important', boxShadow: 2, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: '#F5F7FA', borderRadius: 2 }}>
            <Box display="flex" alignItems="center" gap={2} flex={1}>
              <Event color="primary" />
              <Box flex={1}>
                <Typography fontWeight={700}>{ev.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ev.entity_name} · {ev.test_name} · {ev.start_date} → {ev.end_date}
                </Typography>
              </Box>
              <Box display="flex" gap={1} mr={1}>
                <Chip label={ev.active ? 'Activo' : 'Inactivo'} color={ev.active ? 'success' : 'default'} size="small" />
                {ev.key_value
                  ? <Chip label={`Licencia: ${ev.license_status}`} color={ev.license_status === 'activa' ? 'success' : 'warning'} size="small" />
                  : <Chip label="Sin licencia" color="error" size="small" />}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <EventResponses event={ev} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
