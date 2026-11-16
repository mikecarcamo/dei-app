import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, FormControl, InputLabel, Select, MenuItem,
  Chip, Radio, RadioGroup, FormControlLabel, Divider, Tooltip, IconButton,
} from '@mui/material';
import { Add, Block, EventAvailable, Delete } from '@mui/icons-material';
import { Calendar, dayjsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import api from '../../api/axios';
import { PatientDialog, LicenseBanner, useTherapistLicense } from './common';

dayjs.locale('es');
const localizer = dayjsLocalizer(dayjs);

const STATUS_LABELS = {
  agendada: 'Agendada', celebrada: 'Celebrada',
  cancelada_paciente: 'Cancelada por paciente', cancelada_terapeuta: 'Cancelada por terapeuta',
  anulada: 'Anulada',
};
const STATUS_COLORS = {
  agendada: '#1565C0', celebrada: '#2E7D32',
  cancelada_paciente: '#EF6C00', cancelada_terapeuta: '#EF6C00', anulada: '#757575',
};
const CATEGORIES = [
  { value: 'PRESENCIAL_MENTAL_Z9', label: 'Presencial — MENTAL Zona 9' },
  { value: 'PRESENCIAL_DEI_Z1', label: 'Presencial — DEI Zona 1' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'LLAMADA', label: 'Llamada telefónica' },
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const CAL_MESSAGES = {
  today: 'Hoy', previous: 'Anterior', next: 'Siguiente', month: 'Mes', week: 'Semana', day: 'Día',
  agenda: 'Agenda', date: 'Fecha', time: 'Hora', event: 'Cita', noEventsInRange: 'No hay citas en este período',
  showMore: (total) => `+${total} más`,
};

const parseDT = (s) => dayjs(s, 'YYYY-MM-DD HH:mm').toDate();
const fmtDT = (s) => dayjs(s, 'YYYY-MM-DD HH:mm').format('DD/MM/YYYY HH:mm');

function NewAppointmentDialog({ open, patients, initialSlot, onClose, onSaved }) {
  const [patientId, setPatientId] = useState('');
  const [category, setCategory] = useState('PRESENCIAL_MENTAL_Z9');
  const [start, setStart] = useState('');
  const [obs, setObs] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPatientId(''); setCategory('PRESENCIAL_MENTAL_Z9'); setObs(''); setError('');
      setStart(initialSlot ? dayjs(initialSlot).format('YYYY-MM-DDTHH:mm') : '');
    }
  }, [open, initialSlot]);

  const end = start ? dayjs(start).add(1, 'hour').format('HH:mm') : '';

  const handleSave = async () => {
    if (!patientId) { setError('Seleccione el paciente'); return; }
    if (!start) { setError('Indique la fecha y hora de la cita'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/therapy/appointments', { patient_id: patientId, starts_at: start, category, observaciones: obs || undefined });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al crear la cita');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva cita</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <FormControl fullWidth margin="normal">
            <InputLabel>Paciente *</InputLabel>
            <Select value={patientId} label="Paciente *" onChange={e => {
              if (e.target.value === '__new__') { setNewPatientOpen(true); return; }
              setPatientId(e.target.value);
            }}>
              {patients.map(p => <MenuItem key={p.id} value={p.id}>{p.code} — {p.full_name}</MenuItem>)}
              <MenuItem value="__new__"><em>+ Nuevo paciente…</em></MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Categoría *</InputLabel>
            <Select value={category} label="Categoría *" onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box display="flex" gap={2} alignItems="flex-start">
            <TextField
              label="Fecha y hora *" type="datetime-local" fullWidth margin="normal"
              InputLabelProps={{ shrink: true }} value={start} onChange={e => setStart(e.target.value)}
              helperText={end ? `La cita dura 1 hora: termina a las ${end}` : 'Cada cita dura 1 hora automáticamente'}
            />
          </Box>
          <TextField label="Observaciones (opcional)" fullWidth margin="normal" multiline minRows={2}
            value={obs} onChange={e => setObs(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Agendar'}
          </Button>
        </DialogActions>
      </Dialog>
      <PatientDialog open={newPatientOpen} onClose={() => setNewPatientOpen(false)}
        onSaved={(p) => { setNewPatientOpen(false); onSaved(false, p); setPatientId(p.id); }} />
    </>
  );
}

function CloseAppointmentDialog({ open, appt, onClose, onSaved }) {
  const [outcome, setOutcome] = useState('celebrada');
  const [form, setForm] = useState({ situacion_actual: '', desarrollo: '', plan_trabajo: '', observaciones: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setOutcome('celebrada'); setForm({ situacion_actual: '', desarrollo: '', plan_trabajo: '', observaciones: '' }); setError(''); }
  }, [open]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      await api.put(`/therapy/appointments/${appt.id}/close`, { outcome, ...form });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al cerrar la cita');
    } finally {
      setLoading(false);
    }
  };

  if (!appt) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Registrar atención — {appt.patient_name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Cita #{appt.id} · {fmtDT(appt.starts_at)} a {fmtDT(appt.ends_at)}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <FormControl component="fieldset" sx={{ mb: 1 }}>
          <RadioGroup row value={outcome} onChange={e => setOutcome(e.target.value)}>
            <FormControlLabel value="celebrada" control={<Radio size="small" />} label="Celebrada" />
            <FormControlLabel value="cancelada_paciente" control={<Radio size="small" />} label="Cancelada por paciente" />
            <FormControlLabel value="cancelada_terapeuta" control={<Radio size="small" />} label="Cancelada por terapeuta" />
            <FormControlLabel value="anulada" control={<Radio size="small" />} label="Anulada" />
          </RadioGroup>
        </FormControl>
        {outcome === 'celebrada' ? (
          <>
            <TextField label="Situación actual *" fullWidth margin="dense" multiline minRows={2} value={form.situacion_actual} onChange={set('situacion_actual')} />
            <TextField label="Desarrollo *" fullWidth margin="dense" multiline minRows={2} value={form.desarrollo} onChange={set('desarrollo')} />
            <TextField label="Plan de trabajo *" fullWidth margin="dense" multiline minRows={2} value={form.plan_trabajo} onChange={set('plan_trabajo')} />
          </>
        ) : (
          <Alert severity="info" sx={{ mb: 1 }}>Solo se requiere indicar el motivo en Observaciones.</Alert>
        )}
        <TextField label="Observaciones *" fullWidth margin="dense" multiline minRows={2} value={form.observaciones} onChange={set('observaciones')} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Volver</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : `Concluir como "${STATUS_LABELS[outcome]}"`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BlockDialog({ open, onClose, onSaved }) {
  const [type, setType] = useState('daily');
  const [form, setForm] = useState({ starts_at: '', ends_at: '', date_from: '', date_to: '', time_from: '', time_to: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(null);

  useEffect(() => { if (open) { setType('daily'); setForm({ starts_at: '', ends_at: '', date_from: '', date_to: '', time_from: '', time_to: '', reason: '' }); setError(''); setWarning(null); } }, [open]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (type === 'single' && (!form.starts_at || !form.ends_at)) { setError('Indique el rango de fechas y horas'); return; }
    if (type !== 'single' && (!form.date_from || !form.date_to)) { setError('Indique el rango de fechas'); return; }
    if (type === 'daily' && (!form.time_from || !form.time_to)) { setError('Indique el rango de horas'); return; }
    setLoading(true); setError(''); setWarning(null);
    try {
      const { data } = await api.post('/therapy/blocks', { type, ...form });
      if (data.conflicts?.length) {
        setWarning(data.conflicts);
        onSaved(false);
      } else {
        onSaved();
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Error al crear el bloqueo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bloquear horario</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={1}>
          En el horario bloqueado no se podrán agendar citas que se traslapen.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {warning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bloqueo creado, pero <b>{warning.length} cita(s)</b> quedan agendadas dentro del rango bloqueado:
            {warning.map(c => (
              <Typography key={c.id} variant="caption" display="block">• #{c.id} {c.patient_name} — {c.starts_at}</Typography>
            ))}
            Cancele o reprograme esas citas.
          </Alert>
        )}
        <FormControl fullWidth margin="normal">
          <InputLabel>Tipo de bloqueo *</InputLabel>
          <Select value={type} label="Tipo de bloqueo *" onChange={e => setType(e.target.value)}>
            <MenuItem value="daily">Horario recurrente (rango de fechas + rango de horas)</MenuItem>
            <MenuItem value="vacation">Vacaciones (días completos)</MenuItem>
            <MenuItem value="single">Rango exacto (una sola vez)</MenuItem>
          </Select>
        </FormControl>
        {type === 'single' ? (
          <Box display="flex" gap={2}>
            <TextField label="Desde *" type="datetime-local" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.starts_at} onChange={set('starts_at')} />
            <TextField label="Hasta *" type="datetime-local" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.ends_at} onChange={set('ends_at')} />
          </Box>
        ) : (
          <>
            <Box display="flex" gap={2}>
              <TextField label="Desde fecha *" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.date_from} onChange={set('date_from')} />
              <TextField label="Hasta fecha *" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.date_to} onChange={set('date_to')} />
            </Box>
            {type === 'daily' && (
              <Box display="flex" gap={2}>
                <TextField label="Desde hora *" type="time" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.time_from} onChange={set('time_from')} />
                <TextField label="Hasta hora *" type="time" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.time_to} onChange={set('time_to')} helperText="Se repite ese horario cada día del rango" />
              </Box>
            )}
            {type === 'vacation' && (
              <Alert severity="info" sx={{ mt: 1 }}>Se bloquean todos los días del rango, de 00:00 a 23:59.</Alert>
            )}
          </>
        )}
        <TextField label="Motivo (opcional)" fullWidth margin="normal" value={form.reason} onChange={set('reason')}
          placeholder={type === 'vacation' ? 'Ej: Vacaciones' : 'Ej: Congreso, permiso, almuerzo'} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{warning ? 'Cerrar' : 'Cancelar'}</Button>
        {!warning && (
          <Button variant="contained" color="error" onClick={handleSave} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Bloquear'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function DetailDialog({ open, item, onClose, onClose_appt, onReschedule, onDeleteBlock }) {
  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setMoveTo(''); setError(''); } }, [open, item]);
  if (!item) return null;

  if (item.type === 'block') {
    const b = item.block;
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Horario bloqueado</DialogTitle>
        <DialogContent>
          <Typography variant="body2"><b>Desde:</b> {fmtDT(b.starts_at)}</Typography>
          <Typography variant="body2"><b>Hasta:</b> {fmtDT(b.ends_at)}</Typography>
          {b.reason && <Typography variant="body2"><b>Motivo:</b> {b.reason}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cerrar</Button>
          <Button color="error" startIcon={<Delete />} onClick={() => onDeleteBlock(b)}>Quitar bloqueo</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const a = item.appt;
  const handleMove = async () => {
    if (!moveTo) { setError('Indique la nueva fecha y hora'); return; }
    setLoading(true); setError('');
    try {
      await api.put(`/therapy/appointments/${a.id}/reschedule`, { starts_at: moveTo });
      onReschedule();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al reprogramar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cita #{a.id} — {a.patient_name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2"><b>Paciente:</b> {a.patient_name} ({a.patient_code})</Typography>
        <Typography variant="body2"><b>Categoría:</b> {CATEGORY_LABELS[a.category] || a.category || '—'}</Typography>
        <Typography variant="body2"><b>Fecha y hora:</b> {fmtDT(a.starts_at)} — {fmtDT(a.ends_at)}</Typography>
        <Typography variant="body2"><b>Estado:</b> <Chip size="small" label={STATUS_LABELS[a.status]} sx={{ bgcolor: STATUS_COLORS[a.status], color: 'white' }} /></Typography>
        {a.situacion_actual && <Typography variant="body2" mt={1}><b>Situación actual:</b> {a.situacion_actual}</Typography>}
        {a.desarrollo && <Typography variant="body2" mt={0.5}><b>Desarrollo:</b> {a.desarrollo}</Typography>}
        {a.plan_trabajo && <Typography variant="body2" mt={0.5}><b>Plan de trabajo:</b> {a.plan_trabajo}</Typography>}
        {a.observaciones && <Typography variant="body2" mt={0.5}><b>Observaciones:</b> {a.observaciones}</Typography>}
        {a.status === 'agendada' && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Reprogramar</Typography>
            <Box display="flex" gap={1} alignItems="center">
              <TextField type="datetime-local" size="small" fullWidth InputLabelProps={{ shrink: true }}
                label="Nueva fecha y hora" value={moveTo} onChange={e => setMoveTo(e.target.value)}
                helperText="La cita sigue durando 1 hora" />
              <Button variant="outlined" onClick={handleMove} disabled={loading}>Mover</Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        {a.status === 'agendada' && (
          <Button variant="contained" startIcon={<EventAvailable />} onClick={() => onClose_appt(a)}>
            Registrar atención
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function Appointments() {
  const license = useTherapistLicense();
  const [appointments, setAppointments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState({ from: dayjs().startOf('month').subtract(7, 'day'), to: dayjs().endOf('month').add(7, 'day') });
  const [newOpen, setNewOpen] = useState(false);
  const [slot, setSlot] = useState(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [closing, setClosing] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/therapy/appointments', { params: { from: range.from.format('YYYY-MM-DD'), to: range.to.format('YYYY-MM-DD') } }),
      api.get('/therapy/patients'),
    ]).then(([a, p]) => {
      setAppointments(a.data.appointments);
      setBlocks(a.data.blocks);
      setPatients(p.data);
    }).catch(() => setError('Error al cargar las citas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [range]);

  const events = useMemo(() => [
    ...appointments.map(a => ({
      id: `a${a.id}`, type: 'appt', appt: a,
      title: `${a.patient_name} · ${CATEGORY_LABELS[a.category] || ''}`,
      start: parseDT(a.starts_at), end: parseDT(a.ends_at),
    })),
    ...blocks.map(b => ({
      id: `b${b.id}`, type: 'block', block: b,
      title: `Bloqueado${b.reason ? `: ${b.reason}` : ''}`,
      start: parseDT(b.starts_at), end: parseDT(b.ends_at),
    })),
  ], [appointments, blocks]);

  const handleRangeChange = (r) => {
    const dates = Array.isArray(r) ? r : [r.start, r.end];
    const from = dayjs.min(dates.map(d => dayjs(d)));
    const to = dayjs.max(dates.map(d => dayjs(d)));
    setRange({ from, to });
  };

  const refresh = (close = true) => { if (close) { setNewOpen(false); setBlockOpen(false); setSelected(null); setClosing(null); } load(); };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Citas</Typography>
          <Typography variant="body2" color="text.secondary">Agenda de citas por paciente · cada cita dura 1 hora</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" color="error" startIcon={<Block />} onClick={() => setBlockOpen(true)} disabled={!license?.active}>
            Bloquear horario
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setSlot(null); setNewOpen(true); }} disabled={!license?.active}>
            Nueva cita
          </Button>
        </Box>
      </Box>

      <LicenseBanner license={license} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 3, boxShadow: 2, p: 2 }}>
        {loading && <Box display="flex" justifyContent="center" p={1}><CircularProgress size={24} /></Box>}
        <Calendar
          localizer={localizer}
          events={events}
          style={{ height: 650 }}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultView={Views.MONTH}
          messages={CAL_MESSAGES}
          culture="es"
          selectable
          onSelectSlot={(s) => { if (license?.active) { setSlot(s.start); setNewOpen(true); } }}
          onSelectEvent={(e) => setSelected(e.type === 'block' ? { type: 'block', block: e.block } : { type: 'appt', appt: e.appt })}
          onRangeChange={handleRangeChange}
          eventPropGetter={(e) => ({
            style: {
              backgroundColor: e.type === 'block' ? '#9E9E9E' : STATUS_COLORS[e.appt.status] || '#1565C0',
              borderRadius: 6, fontSize: 12,
              ...(e.type === 'block' ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,.25) 6px, rgba(255,255,255,.25) 12px)' } : {}),
            },
          })}
        />
        <Box display="flex" gap={1.5} mt={1.5} flexWrap="wrap">
          <Chip size="small" label="Agendada" sx={{ bgcolor: STATUS_COLORS.agendada, color: 'white' }} />
          <Chip size="small" label="Celebrada" sx={{ bgcolor: STATUS_COLORS.celebrada, color: 'white' }} />
          <Chip size="small" label="Cancelada" sx={{ bgcolor: STATUS_COLORS.cancelada_paciente, color: 'white' }} />
          <Chip size="small" label="Anulada" sx={{ bgcolor: STATUS_COLORS.anulada, color: 'white' }} />
          <Chip size="small" label="Horario bloqueado" sx={{ bgcolor: '#9E9E9E', color: 'white' }} />
        </Box>
      </Card>

      <NewAppointmentDialog open={newOpen} patients={patients} initialSlot={slot}
        onClose={() => setNewOpen(false)} onSaved={(closeIt, newPatient) => { if (newPatient) setPatients(ps => [...ps, newPatient]); if (closeIt !== false) refresh(); else load(); }} />
      <BlockDialog open={blockOpen} onClose={() => setBlockOpen(false)}
        onSaved={(closeIt) => { if (closeIt === false) load(); else refresh(); }} />
      <DetailDialog open={!!selected} item={selected}
        onClose={() => setSelected(null)}
        onClose_appt={(a) => { setSelected(null); setClosing(a); }}
        onReschedule={() => refresh()}
        onDeleteBlock={async (b) => { await api.delete(`/therapy/blocks/${b.id}`); refresh(); }} />
      <CloseAppointmentDialog open={!!closing} appt={closing}
        onClose={() => setClosing(null)} onSaved={() => refresh()} />
    </Box>
  );
}
