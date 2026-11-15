import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, CircularProgress, Tooltip,
} from '@mui/material';
import { People, VpnKey, QrCode, PictureAsPdf } from '@mui/icons-material';
import api from '../../api/axios';
import { AssignUsersDialog, CodesDialog } from './Events';
import { ConsolidatedDialog } from './Reports';

export default function EmpresaEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [codesDialogOpen, setCodesDialogOpen] = useState(false);
  const [consolidatedEvent, setConsolidatedEvent] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/events')
      .then(({ data }) => setEvents(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700} color="primary.main">Eventos</Typography>
        <Typography variant="body2" color="text.secondary">
          Asigne los usuarios de su empresa que participarán en cada evento
        </Typography>
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
                  <TableCell><b>Test</b></TableCell>
                  <TableCell><b>Fechas</b></TableCell>
                  <TableCell><b>Licencia</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell align="center"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map(ev => (
                  <TableRow key={ev.id} hover>
                    <TableCell fontWeight={600}>{ev.name}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {ev.test_name}
                      {ev.target_audience && <Typography variant="caption" display="block" color="text.secondary">→ {ev.target_audience}</Typography>}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{ev.start_date} → {ev.end_date}</TableCell>
                    <TableCell>
                      {ev.key_value
                        ? <Chip icon={<VpnKey fontSize="small" />} label={ev.license_status} color={ev.license_status === 'activa' ? 'success' : 'warning'} size="small" />
                        : <Chip label="Sin licencia" color="error" size="small" />}
                    </TableCell>
                    <TableCell><Chip label={ev.active ? 'Activo' : 'Inactivo'} color={ev.active ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell align="center">
                      {ev.test_type === 'CLIMA' && (
                        <Tooltip title="Ver códigos de acceso">
                          <IconButton size="small" onClick={() => { setSelected(ev); setCodesDialogOpen(true); }}><QrCode fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {ev.active === 1 && (
                        <Tooltip title="Asignar usuarios">
                          <IconButton size="small" onClick={() => { setSelected(ev); setDialogOpen(true); }}><People fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="PDF Consolidado">
                        <IconButton size="small" color="secondary" onClick={() => setConsolidatedEvent(ev)}><PictureAsPdf fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay eventos registrados para su empresa</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <AssignUsersDialog
        open={dialogOpen} event={selected}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); load(); }}
      />
      <CodesDialog
        open={codesDialogOpen} event={selected}
        onClose={() => setCodesDialogOpen(false)}
      />
      <ConsolidatedDialog
        open={!!consolidatedEvent} event={consolidatedEvent || {}}
        onClose={() => setConsolidatedEvent(null)}
      />
    </Box>
  );
}
