import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, AlertTitle, CircularProgress, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Checkbox, Grid, Divider, Accordion, AccordionSummary, AccordionDetails,
  Radio, RadioGroup,
} from '@mui/material';
import { ExpandMore, PictureAsPdf, AutoAwesome, WarningAmber } from '@mui/icons-material';
import api from '../../api/axios';
import PdfViewerModal, { openOrDownloadPdf } from '../../components/PdfViewerModal';

export const DISCLAIMER = 'Este tamizaje es una herramienta de apoyo y NO constituye un diagnóstico. Requiere evaluación y criterio de un profesional de salud mental.';

export function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str.replace(' ', 'T')).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
}

export function severityColor(label = '') {
  const l = label.toLowerCase();
  if (l.includes('mínima') || l.includes('sin riesgo') || l.includes('debajo')) return 'success';
  if (l.includes('severa') || l.includes('alto') || l.includes('encima') || l.includes('moderado')) return 'error';
  if (l.includes('moderada') || l.includes('zona')) return 'warning';
  return 'info';
}

export function useTherapistLicense() {
  const [license, setLicense] = useState(null);
  useEffect(() => { api.get('/therapy/me/license').then(({ data }) => setLicense(data)).catch(() => setLicense({ active: false })); }, []);
  return license;
}

export const blankParams = {
  sintomas_fisicos: '', sintomas_emocionales: '', duracion: '', funcionamiento: '',
  consumo_sustancias: '', consumo_detalle: '', riesgo_suicida: '', riesgo_homicida: '', observaciones: '',
};

// C-SSRS: preguntas 3-5 solo si la 2 es "Sí"; la 7 solo si la 6 es "Sí".
export function cssrsVisible(index, answers) {
  if (index >= 2 && index <= 4) return answers[1] === 1;
  if (index === 6) return answers[5] === 1;
  return true;
}

export function InstrumentForm({ inst, answers, onChange }) {
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

// Bloque de parámetros básicos, reutilizado por el terapeuta y por el link del paciente.
export function BasicParamsForm({ params, setParam }) {
  return (
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
  );
}

export function LicenseBanner({ license }) {
  if (!license || license.active) return null;
  return (
    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
      Su licencia de terapeuta no está vigente{license.license ? ` (venció o no inicia: ${license.license.valid_from} → ${license.license.valid_to})` : ''}.
      Puede consultar el historial, pero no registrar pacientes ni tamizajes. Contacte al administrador.
    </Alert>
  );
}

const blankPatient = {
  full_name: '', birth_date: '', sex: '', phone: '', email: '',
  consultation_reason: '', background: '', medication: '', consent: false,
};

export function PatientDialog({ open, patient, onClose, onSaved }) {
  const [form, setForm] = useState(blankPatient);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(patient ? {
      ...blankPatient,
      ...Object.fromEntries(Object.keys(blankPatient).map(k => [k, patient[k] ?? blankPatient[k]])),
      consent: patient.consent === 1,
    } : blankPatient);
  }, [open, patient]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('El nombre es requerido'); return; }
    if (!form.consent) { setError('Debe registrar el consentimiento informado del paciente'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = patient
        ? await api.put(`/therapy/patients/${patient.id}`, form)
        : await api.post('/therapy/patients', form);
      onSaved(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{patient ? `Editar paciente ${patient.code}` : 'Nuevo paciente'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!patient && <Typography variant="caption" color="text.secondary">El código de paciente se genera automáticamente al guardar.</Typography>}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} md={6}><TextField label="Nombre completo *" fullWidth value={form.full_name} onChange={set('full_name')} autoFocus /></Grid>
          <Grid item xs={6} md={3}><TextField label="Fecha de nacimiento" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.birth_date} onChange={set('birth_date')} /></Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Sexo</InputLabel>
              <Select value={form.sex} label="Sexo" onChange={set('sex')}>
                <MenuItem value=""><em>No indicado</em></MenuItem>
                <MenuItem value="F">Femenino</MenuItem>
                <MenuItem value="M">Masculino</MenuItem>
                <MenuItem value="O">Otro</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}><TextField label="Teléfono" fullWidth value={form.phone} onChange={set('phone')} /></Grid>
          <Grid item xs={12} md={6}><TextField label="Correo" fullWidth value={form.email} onChange={set('email')} /></Grid>
          <Grid item xs={12}><TextField label="Motivo de consulta" fullWidth multiline minRows={2} value={form.consultation_reason} onChange={set('consultation_reason')} /></Grid>
          <Grid item xs={12} md={6}><TextField label="Antecedentes relevantes" fullWidth multiline minRows={2} value={form.background} onChange={set('background')} /></Grid>
          <Grid item xs={12} md={6}><TextField label="Medicación actual" fullWidth multiline minRows={2} value={form.medication} onChange={set('medication')} /></Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={form.consent} onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))} />}
              label="El paciente otorgó su consentimiento informado para la evaluación y el registro de sus datos *"
            />
            {patient?.consent_date && <Typography variant="caption" color="text.secondary" display="block">Consentimiento registrado el {patient.consent_date}</Typography>}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ListBlock({ title, items }) {
  if (!items?.length) return null;
  return (
    <Box mb={1}>
      <Typography variant="caption" fontWeight={700} color="text.secondary">{title}</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {items.map((it, i) => <li key={i}><Typography variant="body2">{it}</Typography></li>)}
      </Box>
    </Box>
  );
}

const SUPPORT_COLOR = { alto: 'error', medio: 'warning', bajo: 'default' };

export function ScreeningResult({ screening, onUpdated, canRegenerate = true }) {
  const [pdfViewer, setPdfViewer] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const ai = screening.ai_result;

  const openPdf = async () => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const url = `${baseURL}/therapy/screenings/${screening.id}/pdf`;
    const token = localStorage.getItem('dei_token');
    const filename = `tamizaje_${screening.patient_code}_${screening.id}.pdf`;
    const viewUrl = await openOrDownloadPdf({ url, filename, token });
    if (viewUrl) setPdfViewer({ url, title: `Tamizaje #${screening.id} — ${screening.patient_code}`, filename, token });
  };

  const regenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      const { data } = await api.post(`/therapy/screenings/${screening.id}/analysis`, {}, { timeout: 90000 });
      onUpdated?.(data);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo generar el análisis');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Box>
      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={700} color="primary.main">Tamizaje #{screening.id}</Typography>
              <Typography variant="body2"><b>Código de paciente:</b> {screening.patient_code}</Typography>
              <Typography variant="body2"><b>Terapeuta:</b> {screening.therapist_name}</Typography>
              <Typography variant="body2"><b>Fecha del tamizaje:</b> {fmtDateTime(screening.screened_at)}</Typography>
            </Box>
            <Button variant="contained" color="secondary" startIcon={<PictureAsPdf />} onClick={openPdf}>PDF</Button>
          </Box>
        </CardContent>
      </Card>

      <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{DISCLAIMER}</Alert>

      {screening.risk_alert === 1 && (
        <Alert severity="error" variant="filled" icon={<WarningAmber />} sx={{ mb: 2, borderRadius: 2 }}>
          <AlertTitle>ALERTA DE RIESGO — nivel {screening.risk_level}</AlertTitle>
          {screening.risk_reasons.map((r, i) => <Typography key={i} variant="body2">• {r}</Typography>)}
          {screening.crisis_resources && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 1 }}>{screening.crisis_resources}</Typography>
          )}
        </Alert>
      )}

      <Typography variant="subtitle1" fontWeight={700} color="primary.main" mb={1}>Resultados de instrumentos</Typography>
      <Grid container spacing={2} mb={2}>
        {screening.results.map(r => (
          <Grid item xs={12} sm={6} md={3} key={r.code}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{r.name}</Typography>
                {r.code !== 'CSSRS' && <Typography variant="h5" fontWeight={700}>{r.score}<Typography component="span" color="text.secondary">/{r.max}</Typography></Typography>}
                <Chip label={r.severity} color={severityColor(r.severity)} size="small" sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" gap={1}>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Conclusión y panorama inicial (IA)</Typography>
            {canRegenerate && (
              <Button size="small" startIcon={regenerating ? <CircularProgress size={16} /> : <AutoAwesome />} onClick={regenerate} disabled={regenerating}>
                {ai ? 'Regenerar análisis' : 'Generar análisis'}
              </Button>
            )}
          </Box>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          {!ai ? (
            <Alert severity="info">El análisis de IA no está disponible para este tamizaje. Puede intentar generarlo nuevamente.</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', textAlign: 'justify' }} mb={1}>{ai.resumen}</Typography>
              {ai.conclusion && <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'justify' }} mb={2}>{ai.conclusion}</Typography>}

              <Typography variant="subtitle2" fontWeight={700} mb={1}>Hipótesis para revisión profesional</Typography>
              {ai.hipotesis.length === 0 && <Typography variant="body2" color="text.secondary" mb={1}>No se sugieren hipótesis con la información disponible.</Typography>}
              {ai.hipotesis.map((h, i) => (
                <Accordion key={i} disableGutters sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Chip label={h.codigo_cie10} size="small" color="primary" variant="outlined" />
                      <Typography variant="body2" fontWeight={600}>{h.nombre}</Typography>
                      <Chip label={`Apoyo ${h.nivel_de_apoyo}`} size="small" color={SUPPORT_COLOR[h.nivel_de_apoyo] || 'default'} />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <ListBlock title="Criterios que se cumplen" items={h.criterios_que_se_cumplen} />
                    <ListBlock title="Criterios que faltan" items={h.criterios_que_faltan} />
                    <ListBlock title="Diagnósticos diferenciales" items={h.diagnosticos_diferenciales} />
                    <ListBlock title="Preguntas sugeridas para aclarar" items={h.preguntas_sugeridas_para_aclarar} />
                  </AccordionDetails>
                </Accordion>
              ))}

              {ai.recomendaciones?.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" fontWeight={700}>Recomendaciones</Typography>
                  <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                    {ai.recomendaciones.map((r, i) => <li key={i}><Typography variant="body2">{r}</Typography></li>)}
                  </Box>
                </>
              )}
              {ai.limitaciones && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" fontWeight={700}>Limitaciones</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'justify' }}>{ai.limitaciones}</Typography>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {pdfViewer && (
        <PdfViewerModal open={!!pdfViewer} url={pdfViewer.url} title={pdfViewer.title}
          token={pdfViewer.token} filename={pdfViewer.filename} onClose={() => setPdfViewer(null)} />
      )}
    </Box>
  );
}
