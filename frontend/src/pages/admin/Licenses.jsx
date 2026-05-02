import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tooltip, MenuItem,
  Select, FormControl, InputLabel, Tabs, Tab,
} from '@mui/material';
import { Add, AutoFixHigh, VpnKey, Block } from '@mui/icons-material';
import api from '../../api/axios';

const STATUS_COLORS = { activa: 'success', usada: 'info', vencida: 'warning', anulada: 'error' };

function GenerateDialog({ open, entities, onClose, onSaved }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ entity_id: '', valid_from: '', valid_to: '', key_value: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm({ entity_id: '', valid_from: '', valid_to: '', key_value: '' }); setError(''); }, [open]);

  const handleSave = async () => {
    if (!form.entity_id || !form.valid_from || !form.valid_to) { setError('Todos los campos son requeridos'); return; }
    setLoading(true);
    try {
      if (tab === 0) {
        await api.post('/licenses/generate', { entity_id: form.entity_id, valid_from: form.valid_from, valid_to: form.valid_to });
      } else {
        if (!form.key_value.trim()) { setError('Ingrese la key'); setLoading(false); return; }
        await api.post('/licenses/manual', { key_value: form.key_value, entity_id: form.entity_id, valid_from: form.valid_from, valid_to: form.valid_to });
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
      <DialogTitle>Nueva Licencia</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Generar automáticamente" />
          <Tab label="Ingresar manualmente" />
        </Tabs>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <FormControl fullWidth margin="normal">
          <InputLabel>Entidad *</InputLabel>
          <Select value={form.entity_id} label="Entidad *" onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}>
            {entities.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </Select>
        </FormControl>
        {tab === 1 && (
          <TextField label="Key de licencia *" fullWidth margin="normal" value={form.key_value} onChange={e => setForm(f => ({ ...f, key_value: e.target.value }))} placeholder="Ej: DEI-XXXXXXXXXXXX" />
        )}
        <TextField label="Válida desde *" type="date" fullWidth margin="normal" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} InputLabelProps={{ shrink: true }} />
        <TextField label="Válida hasta *" type="date" fullWidth margin="normal" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} InputLabelProps={{ shrink: true }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Licenses() {
  const [licenses, setLicenses] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [annulLoading, setAnnulLoading] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/licenses'), api.get('/entities')])
      .then(([l, e]) => { setLicenses(l.data); setEntities(e.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAnnul = async (id) => {
    if (!window.confirm('¿Anular esta licencia?')) return;
    setAnnulLoading(id);
    try {
      await api.put(`/licenses/${id}/status`, { status: 'anulada' });
      load();
    } finally {
      setAnnulLoading(null);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Licencias</Typography>
          <Typography variant="body2" color="text.secondary">Control de keys de licencia por evento</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} sx={{ borderRadius: 2 }}>Nueva Licencia</Button>
      </Box>

      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                  <TableCell><b>Key</b></TableCell>
                  <TableCell><b>Entidad</b></TableCell>
                  <TableCell><b>Evento asignado</b></TableCell>
                  <TableCell><b>Válida desde</b></TableCell>
                  <TableCell><b>Válida hasta</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {licenses.map(lk => (
                  <TableRow key={lk.id} hover>
                    <TableCell><Box display="flex" alignItems="center" gap={1}><VpnKey fontSize="small" color="primary" /><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{lk.key_value}</Typography></Box></TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{lk.entity_name || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{lk.event_name || <Chip label="Sin asignar" size="small" />}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{lk.valid_from}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{lk.valid_to}</TableCell>
                    <TableCell><Chip label={lk.status} color={STATUS_COLORS[lk.status] || 'default'} size="small" /></TableCell>
                    <TableCell align="center">
                      {lk.status === 'activa' && (
                        <Tooltip title="Anular licencia">
                          <span>
                            <IconButton size="small" color="error" onClick={() => handleAnnul(lk.id)} disabled={annulLoading === lk.id}>
                              {annulLoading === lk.id ? <CircularProgress size={16} /> : <Block fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {licenses.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay licencias registradas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <GenerateDialog open={dialogOpen} entities={entities} onClose={() => setDialogOpen(false)} onSaved={() => { setDialogOpen(false); load(); }} />
    </Box>
  );
}
