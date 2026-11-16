import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import ClimaSurvey from './pages/ClimaSurvey';

import Dashboard from './pages/user/Dashboard';
import TestForm from './pages/user/TestForm';
import MyResults from './pages/user/MyResults';

import AdminDashboard from './pages/admin/AdminDashboard';
import Entities from './pages/admin/Entities';
import Users from './pages/admin/Users';
import Tests from './pages/admin/Tests';
import Events from './pages/admin/Events';
import Licenses from './pages/admin/Licenses';
import Reports from './pages/admin/Reports';
import EmpresaEvents from './pages/admin/EmpresaEvents';
import Therapists from './pages/admin/Therapists';

import PublicScreening from './pages/PublicScreening';
import Manual from './pages/Manual';
import Screening from './pages/therapist/Screening';
import Patients from './pages/therapist/Patients';
import PatientDetail from './pages/therapist/PatientDetail';
import Signature from './pages/therapist/Signature';

const theme = createTheme({
  palette: {
    primary: { main: '#1565C0' },
    secondary: { main: '#6A1B9A' },
    background: { default: '#F5F7FA' },
  },
  typography: {
    fontFamily: "'Roboto', sans-serif",
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

function UserLayout() {
  return <Layout isAdmin={false} />;
}

function AdminLayout() {
  return <Layout isAdmin={true} />;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'TERAPEUTA') return <Navigate to="/terapeuta/pacientes" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/encuesta/:code" element={<ClimaSurvey />} />
            <Route path="/tamizaje/:token" element={<PublicScreening />} />

            {/* Cambio de contraseña — cualquier usuario autenticado */}
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>

            {/* Panel de usuario */}
            <Route element={<ProtectedRoute />}>
              <Route element={<UserLayout />}>
                <Route path="/" element={<HomeRoute />} />
                <Route path="/test/:eventId" element={<TestForm />} />
                <Route path="/manual" element={<Manual />} />
              </Route>
            </Route>

            {/* Panel de administración */}
            <Route element={<ProtectedRoute roles={['ADMIN', 'EMPRESA']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<Users />} />
                <Route path="/admin/my-events" element={<EmpresaEvents />} />
                <Route path="/my-results" element={<MyResults />} />
                <Route path="/manual" element={<Manual />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/entities" element={<Entities />} />
                <Route path="/admin/tests" element={<Tests />} />
                <Route path="/admin/events" element={<Events />} />
                <Route path="/admin/licenses" element={<Licenses />} />
                <Route path="/admin/reports" element={<Reports />} />
                <Route path="/admin/therapists" element={<Therapists />} />
              </Route>
            </Route>

            {/* Módulo de terapeutas */}
            <Route element={<ProtectedRoute roles={['TERAPEUTA']} />}>
              <Route element={<UserLayout />}>
                <Route path="/terapeuta/tamizaje" element={<Screening />} />
                <Route path="/terapeuta/pacientes" element={<Patients />} />
                <Route path="/terapeuta/pacientes/:id" element={<PatientDetail />} />
                <Route path="/terapeuta/firma" element={<Signature />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
