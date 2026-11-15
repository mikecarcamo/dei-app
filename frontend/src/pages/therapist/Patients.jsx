import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, CircularProgress, TextField, InputAdornment,
} from '@mui/material';
import { PersonAdd, Search, History, FactCheck } from '@mui/icons-material';
import api from '../../api/axios';
import { PatientDialog, LicenseBanner, useTherapistLicense, fmtDateTime } from './common';

export default function Patients() {
  const navigate = useNavigate();
  const license = useTherapistLicense();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);

  const load = (query = q) => {
    setLoading(true);
    api.get('/therapy/patients', { params: { q: query } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">Pacientes</Typography>
          <Typography variant="body2" color="text.secondary">Registro de pacientes e historial de tamizajes</Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setDialog(true)} disabled={!license?.active}>Nuevo paciente</Button>
      </Box>

      <LicenseBanner license={license} />

      <TextField fullWidth size="small" placeholder="Buscar por código o nombre" value={q} onChange={e => setQ(e.target.value)} sx={{ mb: 2, bgcolor: 'white' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F7FA' }}>
                  <TableCell><b>Código</b></TableCell>
                  <TableCell><b>Paciente</b></TableCell>
                  <TableCell align="center"><b>Tamizajes</b></TableCell>
                  <TableCell><b>Último tamizaje</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(p => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/terapeuta/pacientes/${p.id}`)}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{p.code}</TableCell>
                    <TableCell>{p.full_name}</TableCell>
                    <TableCell align="center">{p.screenings_count}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{fmtDateTime(p.last_screening_at)}</TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <Tooltip title="Historial"><IconButton size="small" onClick={() => navigate(`/terapeuta/pacientes/${p.id}`)}><History fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Nuevo tamizaje"><span><IconButton size="small" color="primary" disabled={!license?.active}
                        onClick={() => navigate(`/terapeuta/tamizaje?patient=${p.id}`)}><FactCheck fontSize="small" /></IconButton></span></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay pacientes registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <PatientDialog open={dialog} onClose={() => setDialog(false)} onSaved={(p) => { setDialog(false); navigate(`/terapeuta/pacientes/${p.id}`); }} />
    </Box>
  );
}
