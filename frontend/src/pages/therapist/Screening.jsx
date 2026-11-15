import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Alert, CircularProgress, Autocomplete, TextField,
  FormControlLabel, Checkbox, Radio, RadioGroup, FormControl, InputLabel, Select, MenuItem, Grid, Divider,
} from '@mui/material';
import { PersonAdd, Save, Add } from '@mui/icons-material';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { PatientDialog, ScreeningResult, LicenseBanner, useTherapistLicense, DISCLAIMER } from './common';

const DEFAULT_SELECTED = { PHQ9: true, GAD7: true, PCL5: false, CSSRS: true };

const blankParams = {
  sintomas_fisicos: '', sintomas_emocionales: '', duracion: '', funcionamiento: '',
  consumo_sustancias: '', consumo_detalle: '', riesgo_suicida: '', riesgo_homicida: '', observaciones: '',
};

// C-SSRS: preguntas 3-5 solo si la 2 es "Sí"; la 7 solo si la 6 es "Sí".
function cssrsVisible(index, answers) {
  if (index >= 2 && index <= 4) return answers[1] === 1;
  if (index === 6) return answers[5] === 1;
  return true;
}

function InstrumentForm({ inst, answers, onChange }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} color="primary.main">{inst.name}</Typography>
        <Typography variant="body2" color="text.secondary" mb={1.5}>{inst.instructions}</Typography>
        {inst.questions.map((q, i) => {
          if (inst.code === 'CSSRS' && !cssrsVisible(i, answers)) return null;
          return (
            <Box key={i} sx={{ py: 1, borderTop: i ? '1px solid #EEE' : 'none' }}>
              <Typography variant="body2" fontWeight={500}>{i + 1}. {q}</Typography>
              <RadioGroup row value={answers[i] ?? ''} onChange={e => onChange(i, Number(e.target.value))}>
                {inst.scale.map(s => (
                  <FormControlLabel key={s.value} value={s.value} control={<Radio size="small" />}
                    label={<Typography variant="caption">{inst.code === 'CSSRS' ? s.label : `${s.value} · ${s.label}`}</Typography>} />
                ))}
              </RadioGroup>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function Screening() {
  const { user } = useAuth();
  const license = useTherapistLicense();
  const [searchParams] = useSearchParams();
  const [instruments, setInstruments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);
  const [answers, setAnswers] = useState({});
  const [params, setParams] = useState(blankParams);
  const [notes, setNotes] = useState('');
  const [patientDialog, setPatientDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const loadPatients = () => api.get('/therapy/patients').then(({ data }) => { setPatients(data); return data; });

  useEffect(() => {
    api.get('/therapy/instruments').then(({ data }) => setInstruments(data.instruments));
    loadPatients().then(data => {
      const pid = Number(searchParams.get('patient'));
      if (pid) setPatient(data.find(p => p.id === pid) || null);
    });
  }, []);

  const activeInstruments = useMemo(() => instruments.filter(i => selected[i.code]), [instruments, selected]);
  const canWrite = license?.active;
  const today = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

  const setAnswer = (code) => (index, value) => setAnswers(a => {
    const arr = [...(a[code] || [])];
    arr[index] = value;
    return { ...a, [code]: arr };
  });

  const setParam = (k) => (e) => setParams(p => ({ ...p, [k]: e.target.value }));

  const buildPayload = () => {
    const out = {};
    for (const inst of activeInstruments) {
      const arr = inst.questions.map((_, i) => {
        if (inst.code === 'CSSRS' && !cssrsVisible(i, answers[inst.code] || [])) return 0;
        return answers[inst.code]?.[i];
      });
      const missing = arr.findIndex(v => v === undefined || v === null);
      if (missing !== -1) throw new Error(`${inst.name}: falta responder la pregunta ${missing + 1}`);
      out[inst.code] = arr;
    }
    return out;
  };

  const handleSave = async () => {
    setError('');
    if (!patient) { setError('Seleccione o registre un paciente'); return; }
    if (activeInstruments.length === 0) { setError('Seleccione al menos un instrumento'); return; }
    let payload;
    try { payload = buildPayload(); } catch (e) { setError(e.message); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/therapy/screenings', { patient_id: patient.id, instruments: payload, params, notes }, { timeout: 90000 });
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar el tamizaje');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setResult(null);
    setAnswers({});
    setParams(blankParams);
    setNotes('');
    setSelected(DEFAULT_SELECTED);
  };

  if (result) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
          <Typography variant="h5" fontWeight={700} color="primary.main">Tamizaje registrado</Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={reset}>Nuevo tamizaje</Button>
        </Box>
        <ScreeningResult screening={result} onUpdated={setResult} />
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={2}>
        <Typography variant="h5" fontWeight={700} color="primary.main">Tamizaje</Typography>
        <Typography variant="body2" color="text.secondary">Diagnóstico rápido y preventivo — panorama inicial del paciente</Typography>
      </Box>

      <LicenseBanner license={license} />
      <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{DISCLAIMER}</Alert>

      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={1.5}>1. Paciente</Typography>
          <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
            <Autocomplete
              sx={{ flex: 1, minWidth: 260 }}
              options={patients}
              value={patient}
              onChange={(_, v) => setPatient(v)}
              getOptionLabel={(p) => `${p.code} — ${p.full_name}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText="Sin coincidencias — registre un nuevo paciente"
              renderInput={(p) => <TextField {...p} label="Buscar paciente por código o nombre" />}
            />
            <Button variant="outlined" startIcon={<PersonAdd />} onClick={() => setPatientDialog(true)} disabled={!canWrite}>
              Nuevo paciente
            </Button>
          </Box>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={4}><Typography variant="body2"><b>Código de paciente:</b> {patient?.code || '—'}</Typography></Grid>
            <Grid item xs={12} sm={4}><Typography variant="body2"><b>Terapeuta:</b> {user?.full_name}</Typography></Grid>
            <Grid item xs={12} sm={4}><Typography variant="body2"><b>Fecha del tamizaje:</b> {today}</Typography></Grid>
          </Grid>
          {patient?.consultation_reason && (
            <Typography variant="body2" color="text.secondary" mt={1}><b>Motivo de consulta:</b> {patient.consultation_reason}</Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>2. Instrumentos</Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {instruments.map(i => (
              <FormControlLabel key={i.code} label={i.name}
                control={<Checkbox checked={!!selected[i.code]} onChange={e => setSelected(s => ({ ...s, [i.code]: e.target.checked }))} />} />
            ))}
          </Box>
          {activeInstruments.map(inst => (
            <InstrumentForm key={inst.code} inst={inst} answers={answers[inst.code] || []} onChange={setAnswer(inst.code)} />
          ))}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={1.5}>3. Parámetros básicos</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField label="Síntomas físicos" fullWidth multiline minRows={2} value={params.sintomas_fisicos} onChange={setParam('sintomas_fisicos')} /></Grid>
            <Grid item xs={12} md={6}><TextField label="Síntomas emocionales" fullWidth multiline minRows={2} value={params.sintomas_emocionales} onChange={setParam('sintomas_emocionales')} /></Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Duración de los síntomas</InputLabel>
                <Select value={params.duracion} label="Duración de los síntomas" onChange={setParam('duracion')}>
                  {['Menos de 2 semanas', '2 a 4 semanas', '1 a 6 meses', 'Más de 6 meses'].map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Afectación del funcionamiento</InputLabel>
                <Select value={params.funcionamiento} label="Afectación del funcionamiento" onChange={setParam('funcionamiento')}>
                  {['Sin afectación', 'Leve', 'Moderada', 'Grave'].map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Consumo de sustancias</InputLabel>
                <Select value={params.consumo_sustancias} label="Consumo de sustancias" onChange={setParam('consumo_sustancias')}>
                  {['No', 'Ocasional', 'Frecuente', 'Diario'].map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Sustancia / detalle" fullWidth value={params.consumo_detalle} onChange={setParam('consumo_detalle')}
                disabled={!params.consumo_sustancias || params.consumo_sustancias === 'No'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Riesgo suicida observado</InputLabel>
                <Select value={params.riesgo_suicida} label="Riesgo suicida observado" onChange={setParam('riesgo_suicida')}>
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="si">Sí</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Riesgo homicida observado</InputLabel>
                <Select value={params.riesgo_homicida} label="Riesgo homicida observado" onChange={setParam('riesgo_homicida')}>
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="si">Sí</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}><TextField label="Observaciones" fullWidth multiline minRows={2} value={params.observaciones} onChange={setParam('observaciones')} /></Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <TextField label="Notas del profesional (no se envían a la IA)" fullWidth multiline minRows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box textAlign="right" mb={4}>
        <Button variant="contained" size="large" startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
          onClick={handleSave} disabled={saving || !canWrite}>
          {saving ? 'Guardando y analizando…' : 'Guardar tamizaje y generar conclusión'}
        </Button>
      </Box>

      <PatientDialog open={patientDialog} onClose={() => setPatientDialog(false)}
        onSaved={async (p) => { setPatientDialog(false); await loadPatients(); setPatient(p); }} />
    </Box>
  );
}
