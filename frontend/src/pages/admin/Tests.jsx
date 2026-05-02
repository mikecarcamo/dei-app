import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tooltip, Collapse,
  Switch,
} from '@mui/material';
import { Add, Edit, ExpandMore, ExpandLess, Assignment } from '@mui/icons-material';
import api from '../../api/axios';

function TestDialog({ open, test, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(test ? { name: test.name, description: test.description || '', active: test.active === 1 } : { name: '', description: '', active: true });
    setError('');
  }, [test, open]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setLoading(true);
    try {
      test ? await api.put(`/tests/${test.id}`, form) : await api.post('/tests', form);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{test ? 'Editar Test' : 'Nuevo Test'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Nombre *" fullWidth margin="normal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        <TextField label="Descripción" fullWidth margin="normal" multiline rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        {test && (
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <Typography variant="body2">Activo:</Typography>
            <Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function TestRow({ test, onEdit }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleExpand = async () => {
    if (!open && !detail) {
      setLoadingDetail(true);
      try {
        const { data } = await api.get(`/tests/${test.id}`);
        setDetail(data);
      } finally {
        setLoadingDetail(false);
      }
    }
    setOpen(o => !o);
  };

  return (
    <>
      <TableRow hover>
        <TableCell>{test.id}</TableCell>
        <TableCell><Box display="flex" alignItems="center" gap={1}><Assignment color="primary" fontSize="small" />{test.name}</Box></TableCell>
        <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{test.description || '—'}</TableCell>
        <TableCell><Chip label={test.active ? 'Activo' : 'Inactivo'} color={test.active ? 'success' : 'default'} size="small" /></TableCell>
        <TableCell sx={{ fontSize: 13 }}>{new Date(test.created_at).toLocaleDateString('es-HN')}</TableCell>
        <TableCell align="center">
          <Tooltip title="Editar"><IconButton size="small" onClick={() => onEdit(test)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={open ? 'Ocultar preguntas' : 'Ver preguntas'}>
            <IconButton size="small" onClick={handleExpand}>{open ? <ExpandLess /> : <ExpandMore />}</IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 2, bgcolor: '#F5F7FA', borderRadius: 2, p: 2 }}>
              {loadingDetail ? <CircularProgress size={20} /> : (
                detail?.questions?.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 50 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Pregunta</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Sección</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detail.questions.map(q => (
                        <TableRow key={q.id}>
                          <TableCell>{q.number}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{q.text}</TableCell>
                          <TableCell><Chip label={q.section} size="small" color={q.section === 'FORTALEZAS' ? 'success' : 'warning'} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <Typography variant="body2" color="text.secondary">Sin preguntas</Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function Tests() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/tests').then(({ data }) => setTests(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Tests</Typography>
          <Typography variant="body2" color="text.secondary">Gestión de test psicológicos</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelected(null); setDialogOpen(true); }} sx={{ borderRadius: 2 }}>Nuevo Test</Button>
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
                  <TableCell><b>Creado</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tests.map(t => (
                  <TestRow key={t.id} test={t} onEdit={t => { setSelected(t); setDialogOpen(true); }} />
                ))}
                {tests.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay tests registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <TestDialog open={dialogOpen} test={selected} onClose={() => setDialogOpen(false)} onSaved={() => { setDialogOpen(false); load(); }} />
    </Box>
  );
}
