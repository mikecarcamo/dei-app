import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Alert, CircularProgress, Container,
} from '@mui/material';
import { Send, CheckCircle } from '@mui/icons-material';
import api from '../api/axios';
import { InstrumentForm, BasicParamsForm, blankParams, cssrsVisible, DISCLAIMER } from './therapist/common';

// Página pública: el paciente responde el tamizaje desde el link enviado por su terapeuta.
// No muestra resultados; el registro queda en la ficha del paciente.
export default function PublicScreening() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState({});
  const [params, setParams] = useState(blankParams);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/screening-link/${token}`)
      .then(({ data }) => setInfo(data))
      .catch(e => {
        const d = e.response?.data;
        if (d?.completed) setCompleted(true);
        setError(d?.message || 'No se pudo cargar el tamizaje');
      });
  }, [token]);

  const instruments = useMemo(() => info?.instruments || [], [info]);
  const setAnswer = (code) => (index, value) => setAnswers(a => {
    const arr = [...(a[code] || [])];
    arr[index] = value;
    return { ...a, [code]: arr };
  });
  const setParam = (k) => (e) => setParams(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    const payload = {};
    for (const inst of instruments) {
      const arr = inst.questions.map((_, i) => {
        if (inst.code === 'CSSRS' && !cssrsVisible(i, answers[inst.code] || [])) return 0;
        return answers[inst.code]?.[i];
      });
      const missing = arr.findIndex(v => v === undefined || v === null);
      if (missing !== -1) { setError(`${inst.name}: falta responder la pregunta ${missing + 1}`); return; }
      payload[inst.code] = arr;
    }
    setSaving(true);
    try {
      await api.post(`/screening-link/${token}`, { answers: payload, params }, { timeout: 90000 });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      const d = e.response?.data;
      if (d?.completed) setCompleted(true);
      setError(d?.message || 'No se pudo enviar el tamizaje. Intente de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const shell = (children) => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box textAlign="center" mb={3}>
        <Typography variant="h5" fontWeight={700} color="primary.main">Tamizaje de salud emocional</Typography>
        <Typography variant="body2" color="text.secondary">Sistema de Evaluación DEI</Typography>
      </Box>
      {children}
    </Container>
  );

  if (done) return shell(
    <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        <CheckCircle color="success" sx={{ fontSize: 56, mb: 1 }} />
        <Typography variant="h6" fontWeight={700}>Gracias por responder</Typography>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Sus respuestas fueron enviadas a su profesional de salud mental, quien las revisará en su próxima consulta.
        </Typography>
      </CardContent>
    </Card>
  );

  if (error && !info) return shell(
    <Alert severity={completed ? 'info' : 'error'} sx={{ borderRadius: 2 }}>{error}</Alert>
  );

  if (!info) return shell(<Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>);

  return shell(
    <Box>
      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>Hola, {info.patient_name}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Su terapeuta le envió este cuestionario. Responda con honestidad; sus respuestas son confidenciales
            y serán revisadas únicamente por su profesional.
          </Typography>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>{DISCLAIMER}</Alert>

      {instruments.map(inst => (
        <InstrumentForm key={inst.code} inst={inst} answers={answers[inst.code] || []} onChange={setAnswer(inst.code)} />
      ))}

      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Información adicional</Typography>
          <BasicParamsForm params={params} setParam={setParam} />
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box textAlign="center" mb={6}>
        <Button variant="contained" size="large" startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Send />}
          onClick={handleSubmit} disabled={saving}>
          {saving ? 'Enviando…' : 'Enviar respuestas'}
        </Button>
      </Box>
    </Box>
  );
}
