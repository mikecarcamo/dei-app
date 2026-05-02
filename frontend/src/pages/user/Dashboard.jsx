import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  Chip, Alert, CircularProgress, Avatar,
} from '@mui/material';
import { Psychology, CalendarToday, VpnKey, PlayArrow } from '@mui/icons-material';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const TEMP_COLORS = { SANGUINEO: '#42A5F5', COLERICO: '#EF5350', MELANCOLICO: '#7E57C2', FLEMATICO: '#66BB6A' };

const TEST_PALETTE = {
  TEMPERAMENTO: {
    header:  '#1565C0',
    border:  '#E3F2FD',
    button:  '#1565C0',
    avatar:  'rgba(255,255,255,0.2)',
  },
  BURNOUT: {
    header:  '#BF360C',
    border:  '#FBE9E7',
    button:  '#BF360C',
    avatar:  'rgba(255,255,255,0.2)',
  },
  DEFAULT: {
    header:  '#2E7D32',
    border:  '#E8F5E9',
    button:  '#2E7D32',
    avatar:  'rgba(255,255,255,0.2)',
  },
};

function getPalette(testType) {
  return TEST_PALETTE[testType] || TEST_PALETTE.DEFAULT;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/events/user/available')
      .then(({ data }) => setEvents(data))
      .catch(() => setError('Error al cargar los test disponibles'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress size={48} /></Box>;

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          Bienvenido/a, {user?.full_name}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {user?.entity_name && `Entidad: ${user.entity_name} · `}
          Test activos y autorizados para usted
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {events.length === 0 && !error && (
        <Box textAlign="center" py={8}>
          <Psychology sx={{ fontSize: 72, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No hay test disponibles en este momento</Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            Los test aparecerán aquí cuando estén activos, dentro del rango de fechas y con licencia válida.
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {events.map((event) => (
          <Grid item xs={12} sm={6} md={4} key={event.id}>
            <Card sx={{ borderRadius: 3, boxShadow: 3, height: '100%', display: 'flex', flexDirection: 'column', border: `1px solid ${getPalette(event.test_type).border}`, transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 } }}>
              <Box sx={{ bgcolor: getPalette(event.test_type).header, p: 2.5, borderRadius: '12px 12px 0 0' }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 44, height: 44 }}>
                    <Psychology sx={{ color: 'white' }} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" color="white" fontWeight={700} lineHeight={1.2}>
                      {event.test_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {event.entity_name}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <CardContent sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>{event.name}</Typography>
                {event.test_description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {event.test_description}
                  </Typography>
                )}
                <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                  <Chip icon={<CalendarToday fontSize="small" />} label={`${formatDate(event.start_date)} — ${formatDate(event.end_date)}`} size="small" variant="outlined" color="primary" />
                  <Chip icon={<VpnKey fontSize="small" />} label="Licencia válida" size="small" color="success" variant="outlined" />
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => navigate(`/test/${event.id}`)}
                  sx={{ borderRadius: 2, fontWeight: 700, bgcolor: getPalette(event.test_type).button, '&:hover': { bgcolor: getPalette(event.test_type).button, filter: 'brightness(1.1)' } }}
                >
                  Iniciar Test
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
