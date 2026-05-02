import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tooltip, Switch,
  MenuItem, Select, FormControl, InputLabel, Divider, List, ListItem,
  ListItemText, ListItemSecondaryAction, Checkbox,
} from '@mui/material';
import { Add, Edit, People, VpnKey } from '@mui/icons-material';
import api from '../../api/axios';

function EventDialog({ open, event, entities, tests, licenses, onClose, onSaved }) {
  const blank = { entity_id: '', test_id: '', name: '', start_date: '', end_date: '', active: true, license_key_id: '' };
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (event) {
      setForm({
        entity_id: event.entity_id || '',
        test_id: event.test_id || '',
        name: event.name || '',
        start_date: event.start_date || '',
        end_date: event.end_date || '',
        active: event.active === 1,
        license_key_id: event.license_key_id || '',
      });
    } else {
      setForm(blank);
    }
    setError('');
  }, [event, open]);

  const availableLicenses = licenses.filter(lk =>
    lk.status === 'activa' && (!lk.event_id || (event && lk.event_id === event.id))
  );

  const handleSave = async () => {
    if (!form.entity_id || !form.test_id || !form.name.trim() || !form.start_date || !form.end_date) {
      setError('Todos los campos obligatorios deben completarse');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, license_key_id: form.license_key_id || null };
      if (event) {
        await api.put(`/events/${event.id}`, payload);
      } else {
        await api.post('/events', payload);
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
      <DialogTitle>{event ? 'Editar Evento' : 'Nuevo Evento'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Nombre del evento *" fullWidth margin="normal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        <FormControl fullWidth margin="normal">
          <InputLabel>Entidad *</InputLabel>
          <Select value={form.entity_id} label="Entidad *" onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}>
            {entities.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Test *</InputLabel>
          <Select value={form.test_id} label="Test *" onChange={e => setForm(f => ({ ...f, test_id: e.target.value }))}>
            {tests.filter(t => t.active).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Fecha inicio *" type="date" fullWidth margin="normal" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
        <TextField label="Fecha fin *" type="date" fullWidth margin="normal" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
        <FormControl fullWidth margin="normal">
          <InputLabel>Licencia</InputLabel>
          <Select value={form.license_key_id} label="Licencia" onChange={e => setForm(f => ({ ...f, license_key_id: e.target.value }))}>
            <MenuItem value=""><em>Sin licencia (evento deshabilitado)</em></MenuItem>
            {availableLicenses.map(lk => (
              <MenuItem key={lk.id} value={lk.id}>
                <Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{lk.key_value}</Typography>
                  <Typography variant="caption" color="text.secondary">{lk.entity_name} · {lk.valid_from} → {lk.valid_to}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {event && (
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <Typography variant="body2">Activo:</Typography>
            <Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <Typography variant="body2" color={form.active ? 'success.main' : 'error.main'}>{form.active ? 'Activo' : 'Inactivo'}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignUsersDialog({ open, event, onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !event) return;
    setLoading(true);
    Promise.all([api.get('/users'), api.get(`/events/${event.id}`)])
      .then(([u, ev]) => {
        const entityUsers = u.data.filter(usr => usr.entity_id === event.entity_id);
        setUsers(entityUsers);
        setAssigned(ev.data.assigned_users?.map(u => u.user_id) || []);
      })
      .catch(() => setError('Error al cargar usuarios'))
      .finally(() => setLoading(false));
  }, [open, event]);

  const toggle = (uid) => {
    setAssigned(a => a.includes(uid) ? a.filter(x => x !== uid) : [...a, uid]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (assigned.length > 0) {
        await api.post(`/events/${event.id}/users`, { user_ids: assigned });
      }
      const eventDetail = await api.get(`/events/${event.id}`);
      const currentAssigned = eventDetail.data.assigned_users?.map(u => u.user_id) || [];
      for (const uid of currentAssigned) {
        if (!assigned.includes(uid)) {
          await api.delete(`/events/${event.id}/users/${uid}`);
        }
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Asignar Usuarios — {event?.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? <CircularProgress /> : (
          users.length === 0 ? (
            <Typography color="text.secondary">No hay usuarios en la entidad de este evento.</Typography>
          ) : (
            <List dense>
              {users.map(u => (
                <ListItem key={u.id} disablePadding>
                  <ListItemText primary={u.full_name} secondary={u.email} />
                  <ListItemSecondaryAction>
                    <Checkbox checked={assigned.includes(u.id)} onChange={() => toggle(u.id)} />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
          {saving ? <CircularProgress size={20} /> : 'Guardar asignación'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [entities, setEntities] = useState([]);
  const [tests, setTests] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/events'),
      api.get('/entities'),
      api.get('/tests'),
      api.get('/licenses'),
    ]).then(([ev, en, ts, lk]) => {
      setEvents(ev.data);
      setEntities(en.data);
      setTests(ts.data);
      setLicenses(lk.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Eventos</Typography>
          <Typography variant="body2" color="text.secondary">Gestión de eventos de aplicación de test</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelected(null); setDialogOpen(true); }} sx={{ borderRadius: 2 }}>
          Nuevo Evento
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
                  <TableCell><b>Nombre</b></TableCell>
                  <TableCell><b>Entidad</b></TableCell>
                  <TableCell><b>Test</b></TableCell>
                  <TableCell><b>Fechas</b></TableCell>
                  <TableCell><b>Licencia</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map(ev => (
                  <TableRow key={ev.id} hover>
                    <TableCell fontWeight={600}>{ev.name}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{ev.entity_name}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{ev.test_name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{ev.start_date} → {ev.end_date}</TableCell>
                    <TableCell>
                      {ev.key_value
                        ? <Chip icon={<VpnKey fontSize="small" />} label={ev.license_status} color={ev.license_status === 'activa' ? 'success' : 'warning'} size="small" />
                        : <Chip label="Sin licencia" color="error" size="small" />}
                    </TableCell>
                    <TableCell><Chip label={ev.active ? 'Activo' : 'Inactivo'} color={ev.active ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar evento">
                        <IconButton size="small" onClick={() => { setSelected(ev); setDialogOpen(true); }}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Asignar usuarios">
                        <IconButton size="small" onClick={() => { setSelected(ev); setUsersDialogOpen(true); }}><People fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay eventos registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <EventDialog
        open={dialogOpen} event={selected} entities={entities}
        tests={tests} licenses={licenses}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); load(); }}
      />
      <AssignUsersDialog
        open={usersDialogOpen} event={selected}
        onClose={() => setUsersDialogOpen(false)}
        onSaved={() => { setUsersDialogOpen(false); load(); }}
      />
    </Box>
  );
}
