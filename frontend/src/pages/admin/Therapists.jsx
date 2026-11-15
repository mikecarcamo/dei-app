import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Tooltip, Switch, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, VpnKey, Block, CheckCircle, HealthAndSafety, Save } from '@mui/icons-material';
import api from '../../api/axios';

const todayGT = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const plusYear = () => {
  const d = new Date(Date.now() - 6 * 3600 * 1000);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

function licenseState(lic, today) {
  if (!lic) return { label: 'Sin licencia', color: 'error' };
  if (lic.status === 'anulada') return { label: 'Anulada', color: 'default' };
  if (lic.valid_to < today) return { label: 'Vencida', color: 'error' };
  if (lic.valid_from > today) return { label: 'Pendiente', color: 'warning' };
  return { label: 'Vigente', color: 'success' };
}

function TherapistDialog({ open, therapist, entities, onClose, onSaved }) {
  const blank = { full_name: '', email: '', password: '', entity_id: '', valid_from: todayGT(), valid_to: plusYear(), active: true };
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(therapist
      ? { ...blank, full_name: therapist.full_name, email: therapist.email, entity_id: therapist.entity_id || '', active: therapist.active === 1 }
      : blank);
  }, [open, therapist]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      if (therapist) {
        await api.put(`/therapy/admin/therapists/${therapist.id}`, {
          full_name: form.full_name, email: form.email, entity_id: form.entity_id || null,
          active: form.active, ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.post('/therapy/admin/therapists', { ...form, entity_id: form.entity_id || null });
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{therapist ? 'Editar Terapeuta' : 'Nuevo Terapeuta'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Nombre completo *" fullWidth margin="normal" value={form.full_name} onChange={set('full_name')} autoFocus />
        <TextField label="Correo electrónico *" type="email" fullWidth margin="normal" value={form.email} onChange={set('email')} />
        <TextField
          label={therapist ? 'Nueva contraseña (opcional)' : 'Contraseña inicial *'} type="password" fullWidth margin="normal"
          value={form.password} onChange={set('password')} helperText="Mínimo 8 caracteres. Se pedirá cambiarla al ingresar."
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Entidad (opcional)</InputLabel>
          <Select value={form.entity_id} label="Entidad (opcional)" onChange={set('entity_id')}>
            <MenuItem value=""><em>Independiente</em></MenuItem>
            {entities.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </Select>
        </FormControl>
        {!therapist && (
          <>
            <Typography variant="subtitle2" color="primary.main" mt={2}>Licencia de uso</Typography>
            <Box display="flex" gap={2}>
              <TextField label="Vigente desde *" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.valid_from} onChange={set('valid_from')} />
              <TextField label="Vigente hasta *" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }} value={form.valid_to} onChange={set('valid_to')} />
            </Box>
          </>
        )}
        {therapist && (
          <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />}
            label={form.active ? 'Usuario activo' : 'Usuario inactivo'} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function LicensesDialog({ open, therapist, onClose, onChanged }) {
  const [form, setForm] = useState({ valid_from: todayGT(), valid_to: plusYear(), notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const today = todayGT();

  useEffect(() => {
    if (open) { setForm({ valid_from: todayGT(), valid_to: plusYear(), notes: '' }); setError(''); }
  }, [open]);

  const run = async (fn) => {
    setLoading(true);
    setError('');
    try { onChanged((await fn()).data); }
    catch (e) { setError(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  if (!therapist) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Licencias — {therapist.full_name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#F5F7FA' }}>
              <TableCell><b>Licencia</b></TableCell>
              <TableCell><b>Vigencia</b></TableCell>
              <TableCell><b>Estado</b></TableCell>
              <TableCell align="center"><b>Acción</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {therapist.licenses.map(l => {
              const st = licenseState(l, today);
              return (
                <TableRow key={l.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{l.key_value}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.valid_from} → {l.valid_to}</TableCell>
                  <TableCell><Chip label={st.label} color={st.color} size="small" /></TableCell>
                  <TableCell align="center">
                    {l.status === 'activa'
                      ? <Tooltip title="Anular licencia"><span><IconButton size="small" color="error" disabled={loading}
                          onClick={() => run(() => api.put(`/therapy/admin/licenses/${l.id}/status`, { status: 'anulada' }))}><Block fontSize="small" /></IconButton></span></Tooltip>
                      : <Tooltip title="Reactivar licencia"><span><IconButton size="small" color="success" disabled={loading}
                          onClick={() => run(() => api.put(`/therapy/admin/licenses/${l.id}/status`, { status: 'activa' }))}><CheckCircle fontSize="small" /></IconButton></span></Tooltip>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Typography variant="subtitle2" color="primary.main" mt={3}>Nueva licencia / renovación</Typography>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField label="Desde" type="date" size="small" margin="normal" InputLabelProps={{ shrink: true }} value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
          <TextField label="Hasta" type="date" size="small" margin="normal" InputLabelProps={{ shrink: true }} value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} />
          <TextField label="Nota" size="small" margin="normal" sx={{ flex: 1, minWidth: 160 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <Button variant="contained" startIcon={<VpnKey />} disabled={loading}
            onClick={() => run(() => api.post(`/therapy/admin/therapists/${therapist.id}/licenses`, form))}>
            Crear licencia
          </Button>
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}

function CrisisResourcesCard() {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { api.get('/therapy/admin/settings/crisis').then(({ data }) => setValue(data.value)); }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/therapy/admin/settings/crisis', { value });
      setMsg({ type: 'success', text: 'Recursos de crisis actualizados' });
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 2, mt: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} color="error.main">Recursos y protocolo de crisis</Typography>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Se muestran en la alerta roja cuando un tamizaje detecta riesgo suicida u homicida. Verifique que las líneas sean correctas para su país.
        </Typography>
        {msg && <Alert severity={msg.type} sx={{ mb: 1 }}>{msg.text}</Alert>}
        <TextField fullWidth multiline minRows={5} value={value} onChange={e => setValue(e.target.value)} />
        <Box textAlign="right" mt={1}>
          <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving || !value.trim()}>Guardar</Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Therapists() {
  const [rows, setRows] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [licensesFor, setLicensesFor] = useState(null);
  const today = todayGT();

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/therapy/admin/therapists'), api.get('/entities')])
      .then(([t, e]) => { setRows(t.data); setEntities(e.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Terapeutas</Typography>
          <Typography variant="body2" color="text.secondary">Usuarios terapeutas y sus licencias de uso del módulo de tamizaje</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelected(null); setEditOpen(true); }} sx={{ borderRadius: 2 }}>
          Nuevo Terapeuta
        </Button>
      </Box>

      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                  <TableCell><b>Terapeuta</b></TableCell>
                  <TableCell><b>Entidad</b></TableCell>
                  <TableCell><b>Licencia</b></TableCell>
                  <TableCell align="center"><b>Pacientes</b></TableCell>
                  <TableCell align="center"><b>Tamizajes</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(t => {
                  const lic = t.active_license || t.licenses[0];
                  const st = licenseState(lic, today);
                  return (
                    <TableRow key={t.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <HealthAndSafety color="success" fontSize="small" />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{t.full_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{t.entity_name || 'Independiente'}</TableCell>
                      <TableCell>
                        <Chip icon={<VpnKey fontSize="small" />} label={st.label} color={st.color} size="small" />
                        {lic && <Typography variant="caption" display="block" color="text.secondary">{lic.valid_from} → {lic.valid_to}</Typography>}
                      </TableCell>
                      <TableCell align="center">{t.patients_count}</TableCell>
                      <TableCell align="center">{t.screenings_count}</TableCell>
                      <TableCell><Chip label={t.active ? 'Activo' : 'Inactivo'} color={t.active ? 'success' : 'default'} size="small" /></TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar"><IconButton size="small" onClick={() => { setSelected(t); setEditOpen(true); }}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Licencias"><IconButton size="small" color="primary" onClick={() => setLicensesFor(t)}><VpnKey fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay terapeutas registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <CrisisResourcesCard />

      <TherapistDialog open={editOpen} therapist={selected} entities={entities}
        onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} />
      <LicensesDialog open={!!licensesFor} therapist={licensesFor}
        onClose={() => setLicensesFor(null)}
        onChanged={(updated) => { setLicensesFor(updated); setRows(rs => rs.map(r => r.id === updated.id ? updated : r)); }} />
    </Box>
  );
}
