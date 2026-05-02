import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tooltip, Switch,
  MenuItem, Select, FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import { Add, Edit, Visibility, VisibilityOff, Refresh } from '@mui/icons-material';
import api from '../../api/axios';

const ROLES = ['ADMIN', 'EMPRESA', 'USUARIO'];
const ROLE_COLORS = { ADMIN: 'error', EMPRESA: 'warning', USUARIO: 'primary' };

function generatePassword() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 12 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function UserDialog({ open, user, entities, onClose, onSaved }) {
  const blank = { full_name: '', email: '', password: '', role: 'USUARIO', entity_id: '', active: true, must_change_password: true };
  const [form, setForm] = useState(blank);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name, email: user.email, password: '', role: user.role, entity_id: user.entity_id || '', active: user.active === 1, must_change_password: user.must_change_password === 1 });
    } else {
      setForm(blank);
    }
    setError('');
  }, [user, open]);

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { setError('Nombre y correo son requeridos'); return; }
    if (!user && form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    setLoading(true);
    try {
      const payload = { ...form, entity_id: form.entity_id || null };
      if (user) {
        if (!payload.password) delete payload.password;
        await api.put(`/users/${user.id}`, payload);
      } else {
        await api.post('/users', payload);
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
      <DialogTitle>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Nombre completo *" fullWidth margin="normal" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} autoFocus />
        <TextField label="Correo electrónico *" type="email" fullWidth margin="normal" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <TextField
          label={user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
          type={showPass ? 'text' : 'password'}
          fullWidth margin="normal"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPass(s => !s)}>{showPass ? <VisibilityOff /> : <Visibility />}</IconButton>
                <Tooltip title="Generar contraseña segura">
                  <IconButton onClick={() => { const p = generatePassword(); setForm(f => ({ ...f, password: p })); setShowPass(true); }}><Refresh /></IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Rol *</InputLabel>
          <Select value={form.role} label="Rol *" onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Entidad</InputLabel>
          <Select value={form.entity_id} label="Entidad" onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}>
            <MenuItem value="">Sin entidad</MenuItem>
            {entities.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </Select>
        </FormControl>
        {user && (
          <Box display="flex" alignItems="center" gap={2} mt={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2">Activo:</Typography>
              <Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2">Forzar cambio contraseña:</Typography>
              <Switch checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} />
            </Box>
          </Box>
        )}
        {!user && (
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <Typography variant="body2">Forzar cambio al primer login:</Typography>
            <Switch checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} />
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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/entities')])
      .then(([u, e]) => { setUsers(u.data); setEntities(e.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Usuarios</Typography>
          <Typography variant="body2" color="text.secondary">Gestión de usuarios del sistema</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelected(null); setDialogOpen(true); }} sx={{ borderRadius: 2 }}>Nuevo Usuario</Button>
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
                  <TableCell><b>Correo</b></TableCell>
                  <TableCell><b>Rol</b></TableCell>
                  <TableCell><b>Entidad</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell><b>Cambio Pass.</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{u.email}</TableCell>
                    <TableCell><Chip label={u.role} color={ROLE_COLORS[u.role] || 'default'} size="small" /></TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{u.entity_name || '—'}</TableCell>
                    <TableCell><Chip label={u.active ? 'Activo' : 'Inactivo'} color={u.active ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell><Chip label={u.must_change_password ? 'Pendiente' : 'No'} color={u.must_change_password ? 'warning' : 'default'} size="small" /></TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar"><IconButton size="small" onClick={() => { setSelected(u); setDialogOpen(true); }}><Edit fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay usuarios registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <UserDialog open={dialogOpen} user={selected} entities={entities} onClose={() => setDialogOpen(false)} onSaved={() => { setDialogOpen(false); load(); }} />
    </Box>
  );
}
