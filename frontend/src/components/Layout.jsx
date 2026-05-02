import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Divider, Avatar, Chip,
  Tooltip, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, People, Business, Assignment,
  Event, VpnKey, Assessment, Logout, Psychology, AdminPanelSettings,
  LockReset, BarChart,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 240;

const adminMenuItems = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/admin' },
  { label: 'Entidades', icon: <Business />, path: '/admin/entities' },
  { label: 'Usuarios', icon: <People />, path: '/admin/users' },
  { label: 'Tests', icon: <Assignment />, path: '/admin/tests' },
  { label: 'Eventos', icon: <Event />, path: '/admin/events' },
  { label: 'Licencias', icon: <VpnKey />, path: '/admin/licenses' },
  { label: 'Reportes', icon: <Assessment />, path: '/admin/reports' },
];

const empresaMenuItems = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/admin' },
  { label: 'Resultados Empresa', icon: <BarChart />, path: '/my-results' },
];

const userMenuItems = [
  { label: 'Mis Test', icon: <Psychology />, path: '/' },
];

export default function Layout({ isAdmin = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  const menuItems = isAdmin
    ? (user?.role === 'EMPRESA' ? empresaMenuItems : adminMenuItems)
    : userMenuItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleColor = { ADMIN: 'error', EMPRESA: 'warning', USUARIO: 'primary' };
  const roleLabel = { ADMIN: 'Administrador', EMPRESA: 'Empresa', USUARIO: 'Usuario' };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0D47A1' }}>
      <Box sx={{ height: 64, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <Box component="img" src="/Logo.png" alt="DEI" sx={{ maxHeight: 48, maxWidth: 120, width: 'auto', objectFit: 'contain' }} />
      </Box>

      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36, fontSize: 14 }}>
            {user?.full_name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" color="white" fontWeight={600} noWrap sx={{ maxWidth: 150 }}>
              {user?.full_name}
            </Typography>
            <Chip label={roleLabel[user?.role] || user?.role} size="small" color={roleColor[user?.role] || 'default'} sx={{ height: 18, fontSize: 10 }} />
          </Box>
        </Box>
      </Box>

      <List sx={{ flex: 1, py: 1 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/admin' && item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => { navigate(item.path); if (isMobile) setDrawerOpen(false); }}
                sx={{
                  mx: 1, mb: 0.5, borderRadius: 2,
                  bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ListItemIcon sx={{ color: active ? 'white' : 'rgba(255,255,255,0.7)', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? 'white' : 'rgba(255,255,255,0.85)' }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ py: 1 }}>
        {user?.role === 'ADMIN' && (
          <ListItem disablePadding>
            <ListItemButton onClick={() => navigate(isAdmin ? '/' : '/admin')} sx={{ mx: 1, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}>
                {isAdmin ? <Psychology /> : <AdminPanelSettings />}
              </ListItemIcon>
              <ListItemText primary={isAdmin ? 'Panel Usuario' : 'Panel Admin'} primaryTypographyProps={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }} />
            </ListItemButton>
          </ListItem>
        )}
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/change-password')} sx={{ mx: 1, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}><LockReset /></ListItemIcon>
            <ListItemText primary="Cambiar Contraseña" primaryTypographyProps={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ mx: 1, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}><Logout /></ListItemIcon>
            <ListItemText primary="Cerrar Sesión" primaryTypographyProps={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#1565C0' }} elevation={2}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(o => !o)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Box component="img" src="/Logo.png" alt="DEI" sx={{ height: 36, width: 'auto', mr: 1.5, filter: 'brightness(0) invert(1)' }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            DEI — Sistema de Test Psicológicos
          </Typography>
          <Tooltip title="Cerrar sesión">
            <IconButton color="inherit" onClick={handleLogout}><Logout /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px',
          ml: drawerOpen && !isMobile ? `${DRAWER_WIDTH}px` : 0,
          transition: 'margin 0.2s ease',
          p: 3,
          bgcolor: '#F5F7FA',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
