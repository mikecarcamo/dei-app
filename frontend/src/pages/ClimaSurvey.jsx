import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, Alert, CircularProgress,
  LinearProgress, Paper, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Radio,
} from '@mui/material';
import { CheckCircle, Send, Lock } from '@mui/icons-material';
import api from '../api/axios';

const STEPS_PER_PAGE = 10;
const SCALE = [
  { value: 5, label: 'Totalmente de acuerdo' },
  { value: 4, label: 'De acuerdo' },
  { value: 3, label: 'Ni de acuerdo ni en desacuerdo' },
  { value: 2, label: 'En desacuerdo' },
  { value: 1, label: 'Totalmente en desacuerdo' },
];

export default function ClimaSurvey() {
  const { code } = useParams();
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get(`/surveys/${code}`)
      .then(({ data }) => setSurvey(data))
      .catch(e => setError(e.response?.data?.message || 'No se pudo cargar la encuesta'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" p={2}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>{error}</Alert>
      </Box>
    );
  }

  if (done) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" p={2} bgcolor="#F5F7FA">
        <Card sx={{ maxWidth: 520, borderRadius: 3 }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <CheckCircle color="success" sx={{ fontSize: 56, mb: 2 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>¡Gracias por participar!</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Su respuesta fue registrada de forma anónima. Su código de participación es:
            </Typography>
            <Chip label={done.code} color="primary" sx={{ fontFamily: 'monospace', fontSize: 16, px: 2 }} />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
              Guarde este código si desea consultar su comprobante de participación.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const questions = survey.questions;
  const currentPageQuestions = questions.slice(page * STEPS_PER_PAGE, (page + 1) * STEPS_PER_PAGE);
  const totalPages = Math.ceil(questions.length / STEPS_PER_PAGE);
  const answered = Object.keys(answers).length;
  const progress = (answered / questions.length) * 100;
  const pageAnswered = currentPageQuestions.every(q => Object.prototype.hasOwnProperty.call(answers, q.id));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const answersArray = questions.map(q => ({ question_id: q.id, numeric_value: answers[q.id] }));
      const { data } = await api.post(`/surveys/${code}`, { answers: answersArray });
      setDone(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Error al enviar la encuesta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box minHeight="100vh" bgcolor="#F5F7FA" py={4}>
      <Box maxWidth={900} mx="auto" px={2}>
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Lock fontSize="small" color="success" />
            <Typography variant="caption" color="success.main" fontWeight={700}>ENCUESTA ANÓNIMA</Typography>
          </Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">{survey.test_name}</Typography>
          <Typography variant="body2" color="text.secondary">{survey.entity_name} · {survey.event_name}</Typography>
          {survey.target_audience && (
            <Typography variant="body1" sx={{ mt: 1.5 }}>
              Dirigido a: <b>{survey.target_audience}</b>
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Su código de participación: <b style={{ fontFamily: 'monospace' }}>{survey.code}</b> — no se solicita su nombre ni ningún dato que lo identifique.
          </Typography>
        </Paper>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2" fontWeight={700}>Progreso general</Typography>
            <Typography variant="body2" color="text.secondary">{answered}/{questions.length} respondidas</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Card sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#E3F2FD' }}>
                  <TableCell width={40}><b>#</b></TableCell>
                  <TableCell><b>Afirmación</b></TableCell>
                  {SCALE.map(s => (
                    <TableCell key={s.value} align="center" sx={{ fontSize: 11, width: 80 }}>
                      <b>{s.value}</b><br />{s.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentPageQuestions.map(q => (
                  <TableRow key={q.id} hover>
                    <TableCell>{q.number}</TableCell>
                    <TableCell sx={{ fontSize: 14 }}>{q.text}</TableCell>
                    {SCALE.map(s => (
                      <TableCell key={s.value} align="center">
                        <Radio
                          size="small"
                          checked={answers[q.id] === s.value}
                          onChange={() => setAnswers(a => ({ ...a, [q.id]: s.value }))}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Box display="flex" justifyContent="space-between" mt={3} mb={6}>
          <Button variant="outlined" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          {page < totalPages - 1 ? (
            <Button variant="contained" disabled={!pageAnswered} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          ) : (
            <Button
              variant="contained" color="success" startIcon={<Send />}
              disabled={submitting || answered < questions.length}
              onClick={handleSubmit}
            >
              {submitting ? <CircularProgress size={20} /> : 'Enviar encuesta'}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
