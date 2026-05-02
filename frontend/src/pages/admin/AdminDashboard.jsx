import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardContent, CardActionArea,
  CircularProgress, Chip,
} from '@mui/material';
import { Business, People, Assignment, Event, VpnKey, Assessment, BarChart, EmojiPeople } from '@mui/icons-material';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const adminCards = [
  { label: 'Entidades', icon: <Business sx={{ fontSize: 36 }} />, path: '/admin/entities', color: '#1565C0', key: 'entities' },
  { label: 'Usuarios', icon: <People sx={{ fontSize: 36 }} />, path: '/admin/users', color: '#2E7D32', key: 'users' },
  { label: 'Tests', icon: <Assignment sx={{ fontSize: 36 }} />, path: '/admin/tests', color: '#6A1B9A', key: 'tests' },
  { label: 'Eventos', icon: <Event sx={{ fontSize: 36 }} />, path: '/admin/events', color: '#E65100', key: 'events' },
  { label: 'Licencias', icon: <VpnKey sx={{ fontSize: 36 }} />, path: '/admin/licenses', color: '#00695C', key: 'licenses' },
  { label: 'Reportes', icon: <Assessment sx={{ fontSize: 36 }} />, path: '/admin/reports', color: '#AD1457', key: 'reports' },
];

function StatCard({ label, icon, path, color, value, navigate }) {
  return (
    <Card sx={{ borderRadius: 3, boxShadow: 3, transition: 'transform 0.15s, box-shadow 0.15s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 8 } }}>
      <CardActionArea onClick={() => navigate(path)} sx={{ p: 0 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ bgcolor: color, p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ color: 'white', opacity: 0.9 }}>{icon}</Box>
            <Box>
              <Typography variant="h4" fontWeight={700} color="white" lineHeight={1}>{value ?? '—'}</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>{label}</Typography>
            </Box>
          </Box>
          <Box sx={{ p: 1.5, bgcolor: 'white' }}>
            <Typography variant="caption" color="text.secondary">Ver y gestionar {label.toLowerCase()}</Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function EmpresaDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/responses/my-events')
      .then(({ data }) => setEvents(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress size={48} /></Box>;

  const totalParticipantes = events.reduce((acc, e) => acc + (e.total_responses || 0), 0);

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          Bienvenido/a, {user?.full_name}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {user?.entity_name} · Panel de empresa
        </Typography>
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6}>
          <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
            <Box sx={{ bgcolor: '#1565C0', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Event sx={{ fontSize: 36, color: 'white', opacity: 0.9 }} />
              <Box>
                <Typography variant="h4" fontWeight={700} color="white" lineHeight={1}>{events.length}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>Eventos activos</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: 'white' }}>
              <Typography variant="caption" color="text.secondary">Tests asignados a su entidad</Typography>
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
            <Box sx={{ bgcolor: '#2E7D32', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <EmojiPeople sx={{ fontSize: 36, color: 'white', opacity: 0.9 }} />
              <Box>
                <Typography variant="h4" fontWeight={700} color="white" lineHeight={1}>{totalParticipantes}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>Participantes registrados</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: 'white' }}>
              <Typography variant="caption" color="text.secondary">Total de formularios completados</Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={700} color="primary.main" mb={2}>Mis Eventos</Typography>
      {events.length === 0 ? (
        <Typography color="text.secondary">No hay eventos disponibles.</Typography>
      ) : (
        <Grid container spacing={2}>
          {events.map(ev => (
            <Grid item xs={12} sm={6} key={ev.id}>
              <Card sx={{ borderRadius: 2, boxShadow: 1, border: '1px solid #E3F2FD', cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                onClick={() => navigate('/my-results')}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Typography fontWeight={700} variant="body1">{ev.name}</Typography>
                    <Chip label={`${ev.total_responses} resp.`} size="small" color="primary" variant="outlined" />
                  </Box>
                  <Typography variant="caption" color="text.secondary">{ev.test_name}</Typography>
                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary">{ev.start_date} → {ev.end_date}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const isEmpresa = user?.role === 'EMPRESA';

  useEffect(() => {
    if (isEmpresa) return;
    Promise.allSettled([
      api.get('/entities'),
      api.get('/users'),
      api.get('/tests'),
      api.get('/events'),
      api.get('/licenses'),
    ]).then(([entities, users, tests, events, licenses]) => {
      setStats({
        entities: entities.value?.data?.length || 0,
        users: users.value?.data?.length || 0,
        tests: tests.value?.data?.length || 0,
        events: events.value?.data?.length || 0,
        licenses: licenses.value?.data?.length || 0,
        reports: '—',
      });
    }).finally(() => setLoading(false));
  }, [isEmpresa]);

  if (isEmpresa) return <EmpresaDashboard />;

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress size={48} /></Box>;

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h5" fontWeight={700} color="primary.main">Panel de Administración</Typography>
        <Typography color="text.secondary" variant="body2">Gestión general del sistema DEI</Typography>
      </Box>
      <Grid container spacing={3}>
        {adminCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.key}>
            <StatCard {...card} value={stats[card.key]} navigate={navigate} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
