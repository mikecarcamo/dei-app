import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tooltip, Switch,
} from '@mui/material';
import { Add, Edit, Business } from '@mui/icons-material';
import api from '../../api/axios';

function EntityDialog({ open, entity, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entity) setForm({ name: entity.name, description: entity.description || '', active: entity.active === 1 });
    else setForm({ name: '', description: '', active: true });
    setError('');
  }, [entity, open]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setLoading(true);
    try {
      if (entity) {
        await api.put(`/entities/${entity.id}`, form);
      } else {
        await api.post('/entities', form);
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
      <DialogTitle>{entity ? 'Editar Entidad' : 'Nueva Entidad'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Nombre *" fullWidth margin="normal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        <TextField label="Descripción" fullWidth margin="normal" multiline rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        {entity && (
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <Typography variant="body2">Estado:</Typography>
            <Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <Typography variant="body2" color={form.active ? 'success.main' : 'error.main'}>{form.active ? 'Activa' : 'Inactiva'}</Typography>
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

export default function Entities() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/entities').then(({ data }) => setEntities(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (e) => { setSelected(e); setDialogOpen(true); };
  const handleNew = () => { setSelected(null); setDialogOpen(true); };
  const handleSaved = () => { setDialogOpen(false); load(); };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Entidades</Typography>
          <Typography variant="body2" color="text.secondary">Gestión de empresas/entidades del sistema</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleNew} sx={{ borderRadius: 2 }}>Nueva Entidad</Button>
      </Box>

      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                  <TableCell><b>ID</b></TableCell>
                  <TableCell><b>Nombre</b></TableCell>
                  <TableCell><b>Descripción</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell><b>Creada</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entities.map(e => (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.id}</TableCell>
                    <TableCell><Box display="flex" alignItems="center" gap={1}><Business color="primary" fontSize="small" />{e.name}</Box></TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{e.description || '—'}</TableCell>
                    <TableCell><Chip label={e.active ? 'Activa' : 'Inactiva'} color={e.active ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{new Date(e.created_at).toLocaleDateString('es-HN')}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => handleEdit(e)}><Edit fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {entities.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay entidades registradas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <EntityDialog open={dialogOpen} entity={selected} onClose={() => setDialogOpen(false)} onSaved={handleSaved} />
    </Box>
  );
}
