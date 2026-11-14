import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tooltip, Switch,
  MenuItem, Select, FormControl, InputLabel, Divider, List, ListItem,
  ListItemText, ListItemSecondaryAction, Checkbox,
} from '@mui/material';
import { Add, Edit, People, VpnKey, Lock, QrCode } from '@mui/icons-material';
import api from '../../api/axios';

function LicenseDialog({ open, entityId, entityName, onClose, onCreated }) {
  const [form, setForm] = useState({ valid_from: '', valid_to: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm({ valid_from: '', valid_to: '' }); setError(''); }, [open]);

  const handleSave = async () => {
    if (!form.valid_from || !form.valid_to) { setError('Indique las fechas de vigencia'); return; }
    if (form.valid_to < form.valid_from) { setError('La fecha fin no puede ser anterior a la fecha inicio'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/licenses/generate', {
        entity_id: entityId,
        valid_from: form.valid_from,
        valid_to: form.valid_to,
      });
      onCreated(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Error al crear la licencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nueva Licencia — {entityName}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          La vigencia de la licencia definirá las fechas del evento.
        </Typography>
        <TextField label="Válida desde *" type="date" fullWidth margin="normal" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} InputLabelProps={{ shrink: true }} />
        <TextField label="Válida hasta *" type="date" fullWidth margin="normal" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} InputLabelProps={{ shrink: true }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Generar licencia'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CodesDialog({ open, event, onClose }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addCount, setAddCount] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const loadCodes = () => {
    setLoading(true);
    api.get(`/events/${event.id}/codes`)
      .then(({ data }) => setCodes(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !event) return;
    setError('');
    setAddCount('');
    loadCodes();
  }, [open, event]);

  const handleAdd = async () => {
    const count = parseInt(addCount);
    if (!count || count < 1) { setError('Indique cuántos códigos adicionales generar'); return; }
    setAdding(true);
    setError('');
    try {
      const { data } = await api.post(`/events/${event.id}/codes`, { count });
      setCodes(data.codes);
      setAddCount('');
    } catch (e) {
      setError(e.response?.data?.message || 'Error al generar códigos');
    } finally {
      setAdding(false);
    }
  };

  const pricePerCode = parseFloat(event?.price_per_code) || 0;
  const used = codes.filter(c => c.used).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Códigos de acceso — {event?.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Los códigos se asignan automáticamente al presionar «Iniciar Test» en la sesión del usuario asignado. Cada código solo puede usarse una vez.
        </Alert>
        <Box display="flex" gap={1} alignItems="center" mb={2}>
          <TextField
            label="Agregar códigos" type="number" size="small" sx={{ width: 180 }}
            value={addCount} onChange={e => setAddCount(e.target.value)}
            inputProps={{ min: 1, max: 1000 }}
          />
          <Button variant="contained" size="small" onClick={handleAdd} disabled={adding}>
            {adding ? <CircularProgress size={18} /> : 'Generar'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {used}/{codes.length} usados
          </Typography>
        </Box>
        {pricePerCode > 0 && (
          <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
            Precio por código: <b>Q{pricePerCode.toFixed(2)}</b> · Monto del evento: <b>Q{(codes.length * pricePerCode).toFixed(2)}</b> ({codes.length} códigos)
          </Alert>
        )}
        {loading ? <CircularProgress /> : (
          <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
            {codes.map(c => (
              <ListItem key={c.id} disablePadding>
                <ListItemText
                  primary={<Typography sx={{ fontFamily: 'monospace', fontSize: 14 }}>{c.code}</Typography>}
                />
                <Chip label={c.used ? 'Usado' : 'Disponible'} size="small" color={c.used ? 'default' : 'success'} />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function EventDialog({ open, event, entities, tests, licenses, onClose, onSaved }) {
  const blank = { entity_id: '', test_id: '', name: '', active: true, license_key_id: '', target_audience: '', codes_count: '', price_per_code: '' };
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [createdLicenses, setCreatedLicenses] = useState([]);

  useEffect(() => {
    if (event) {
      setForm({
        entity_id: event.entity_id || '',
        test_id: event.test_id || '',
        name: event.name || '',
        active: event.active === 1,
        license_key_id: event.license_key_id || '',
        target_audience: event.target_audience || '',
        codes_count: event.codes_count || '',
        price_per_code: event.price_per_code || '',
      });
    } else {
      setForm(blank);
    }
    setError('');
    setCreatedLicenses([]);
  }, [event, open]);

  const allLicenses = [...licenses, ...createdLicenses];
  const availableLicenses = allLicenses.filter(lk =>
    lk.status === 'activa'
    && lk.entity_id === form.entity_id
    && (!lk.event_id || (event && lk.event_id === event.id))
  );
  const selectedLicense = allLicenses.find(lk => lk.id === form.license_key_id);
  const selectedEntityName = entities.find(e => e.id === form.entity_id)?.name || '';
  const isClima = tests.find(t => t.id === form.test_id)?.test_type === 'CLIMA';

  const handleLicenseCreated = (license) => {
    setCreatedLicenses(prev => [...prev, license]);
    setForm(f => ({ ...f, license_key_id: license.id }));
    setLicenseDialogOpen(false);
  };

  const handleSave = async () => {
    if (!form.entity_id || !form.test_id || !form.name.trim() || !form.license_key_id) {
      setError('Todos los campos obligatorios deben completarse');
      return;
    }
    if (isClima && !event && (!form.target_audience.trim() || !form.codes_count || form.codes_count < 1)) {
      setError('Para Clima Laboral indique la audiencia y la cantidad de códigos a generar');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        license_key_id: form.license_key_id,
        codes_count: isClima ? parseInt(form.codes_count) : undefined,
        price_per_code: isClima ? parseFloat(form.price_per_code) || 0 : undefined,
      };
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
          <Select value={form.entity_id} label="Entidad *" onChange={e => setForm(f => ({ ...f, entity_id: e.target.value, license_key_id: '' }))} disabled={!!event}>
            {entities.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Test *</InputLabel>
          <Select value={form.test_id} label="Test *" onChange={e => setForm(f => ({ ...f, test_id: e.target.value }))}>
            {tests.filter(t => t.active).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </Select>
        </FormControl>
        {isClima && (
          <Alert severity="info" sx={{ mt: 1 }} icon={<Lock fontSize="small" />}>
            Encuesta anónima: los participantes responderán con un código único, sin identificarse.
          </Alert>
        )}
        {isClima && (
          <TextField
            label="Dirigido a *" fullWidth margin="normal"
            value={form.target_audience}
            onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
            placeholder="Ej: Gerencia, Jefes de Taller, Personal administrativo"
            helperText="Se mostrará en la parte superior de la encuesta"
          />
        )}
        {isClima && !event && (
          <TextField
            label="Cantidad de códigos a generar *" type="number" fullWidth margin="normal"
            value={form.codes_count}
            onChange={e => setForm(f => ({ ...f, codes_count: e.target.value }))}
            inputProps={{ min: 1, max: 1000 }}
            helperText="Un código por participante; cada uno solo puede usarse una vez. Luego puede agregar más desde «Ver códigos»."
          />
        )}
        {isClima && (
          <TextField
            label="Precio por código (Q)" type="number" fullWidth margin="normal"
            value={form.price_per_code}
            onChange={e => setForm(f => ({ ...f, price_per_code: e.target.value }))}
            inputProps={{ min: 0, step: '0.01' }}
            helperText={
              event
                ? `Monto del evento: Q${((event.codes_count || 0) * (parseFloat(form.price_per_code) || 0)).toFixed(2)} (${event.codes_count || 0} códigos generados)`
                : form.codes_count && form.price_per_code
                  ? `Monto estimado del evento: Q${(parseInt(form.codes_count) * parseFloat(form.price_per_code)).toFixed(2)}`
                  : 'Opcional. El monto del evento se calcula como códigos × precio.'
            }
          />
        )}
        {form.entity_id ? (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel>Licencia *</InputLabel>
              <Select value={form.license_key_id} label="Licencia *" onChange={e => setForm(f => ({ ...f, license_key_id: e.target.value }))}>
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
            {availableLicenses.length === 0 && (
              <Alert severity="info" sx={{ mb: 1 }}>
                No hay licencias activas disponibles para esta entidad.
              </Alert>
            )}
            <Button size="small" startIcon={<VpnKey />} onClick={() => setLicenseDialogOpen(true)} sx={{ mb: 1 }}>
              Crear licencia para {selectedEntityName}
            </Button>
            {selectedLicense && (
              <Alert severity="success" variant="outlined">
                Fechas del evento: <b>{selectedLicense.valid_from} → {selectedLicense.valid_to}</b> (tomadas de la licencia)
              </Alert>
            )}
          </>
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>Seleccione primero una entidad para ver sus licencias.</Alert>
        )}
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
      <LicenseDialog
        open={licenseDialogOpen}
        entityId={form.entity_id}
        entityName={selectedEntityName}
        onClose={() => setLicenseDialogOpen(false)}
        onCreated={handleLicenseCreated}
      />
    </Dialog>
  );
}

export function AssignUsersDialog({ open, event, onClose, onSaved }) {
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
  const [codesDialogOpen, setCodesDialogOpen] = useState(false);
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
                    <TableCell sx={{ fontSize: 13 }}>
                      {ev.test_name}
                      {ev.target_audience && <Typography variant="caption" display="block" color="text.secondary">→ {ev.target_audience}</Typography>}
                    </TableCell>
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
                      {ev.test_type === 'CLIMA' ? (
                        <Tooltip title="Ver códigos de acceso">
                          <IconButton size="small" onClick={() => { setSelected(ev); setCodesDialogOpen(true); }}><QrCode fontSize="small" /></IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Asignar usuarios">
                          <IconButton size="small" onClick={() => { setSelected(ev); setUsersDialogOpen(true); }}><People fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
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
      <CodesDialog
        open={codesDialogOpen} event={selected}
        onClose={() => setCodesDialogOpen(false)}
      />
    </Box>
  );
}
