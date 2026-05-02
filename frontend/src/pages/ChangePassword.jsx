import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, RadioButtonUnchecked, LockReset } from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function generateSecurePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

const rules = [
  { label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Al menos una mayúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Al menos un número', test: (p) => /\d/.test(p) },
];

export default function ChangePassword() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSuggest = () => setNewPass(generateSecurePassword());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPass !== confirm) { setError('Las contraseñas no coinciden'); return; }
    if (!rules.every(r => r.test(newPass))) { setError('La nueva contraseña no cumple los requisitos'); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: newPass });
      setSuccess('Contraseña actualizada. Redirigiendo...');
      const user = await refreshUser();
      setTimeout(() => {
        if (user.role === 'ADMIN' || user.role === 'EMPRESA') navigate('/admin', { replace: true });
        else navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 460, width: '100%', borderRadius: 3, boxShadow: 24 }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <LockReset sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
            <Typography variant="h6" fontWeight={700}>Cambio de Contraseña Requerido</Typography>
            <Typography variant="body2" color="text.secondary">
              Debe establecer una nueva contraseña para continuar.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField label="Contraseña actual" type="password" fullWidth margin="normal" value={current} onChange={e => setCurrent(e.target.value)} required />
            <TextField
              label="Nueva contraseña"
              type={showNew ? 'text' : 'password'}
              fullWidth margin="normal"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNew(s => !s)}>{showNew ? <VisibilityOff /> : <Visibility />}</IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="outlined" size="small" onClick={handleSuggest} sx={{ mb: 1 }}>
              Sugerir contraseña segura
            </Button>

            <List dense sx={{ bgcolor: '#F5F5F5', borderRadius: 1, mb: 1 }}>
              {rules.map((r, i) => (
                <ListItem key={i} dense sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {r.test(newPass) ? <CheckCircle color="success" fontSize="small" /> : <RadioButtonUnchecked fontSize="small" color="disabled" />}
                  </ListItemIcon>
                  <ListItemText primary={<Typography variant="caption">{r.label}</Typography>} />
                </ListItem>
              ))}
            </List>

            <TextField label="Confirmar nueva contraseña" type="password" fullWidth margin="normal" value={confirm} onChange={e => setConfirm(e.target.value)} required
              error={confirm.length > 0 && newPass !== confirm}
              helperText={confirm.length > 0 && newPass !== confirm ? 'Las contraseñas no coinciden' : ''}
            />
            <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2, py: 1.5, borderRadius: 2, fontWeight: 700 }} disabled={loading}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Actualizar Contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
