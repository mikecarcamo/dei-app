import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  Alert, CircularProgress, LinearProgress, Paper, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { CheckCircle, ArrowBack, ArrowForward, Send } from '@mui/icons-material';
import api from '../../api/axios';

const STEPS_PER_PAGE = 10;

const TEMP_LABELS = { SANGUINEO: 'Sanguíneo', COLERICO: 'Colérico', MELANCOLICO: 'Melancólico', FLEMATICO: 'Flemático' };

export default function TestForm() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('name');
  const [participantName, setParticipantName] = useState('');
  const [nameError, setNameError] = useState('');
  const [checkingName, setCheckingName] = useState(false);

  const [test, setTest] = useState(null);
  const [event, setEvent] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/events/user/available`),
      api.get(`/tests/${1}`),
    ]);
    api.get('/events/user/available').then(({ data }) => {
      const ev = data.find(e => e.id === parseInt(eventId));
      if (!ev) { navigate('/'); return; }
      setEvent(ev);
      return api.get(`/tests/${ev.test_id}`);
    }).then((res) => {
      if (!res) return;
      const testData = res.data;
      setTest(testData);
      setQuestions(testData.questions || []);
    }).catch(() => setError('Error al cargar el test'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleCheckName = async () => {
    if (!participantName.trim()) { setNameError('Ingrese su nombre completo'); return; }
    setCheckingName(true);
    setNameError('');
    try {
      const { data } = await api.get(`/responses/event/${eventId}/check-name`, { params: { name: participantName.trim() } });
      if (data.exists) {
        setNameError('Ya existe un formulario registrado para este evento con ese nombre completo.');
      } else {
        setPhase('test');
      }
    } catch {
      setNameError('Error al verificar el nombre. Intente de nuevo.');
    } finally {
      setCheckingName(false);
    }
  };

  const isBurnout = test?.test_type === 'BURNOUT';

  const handleAnswer = (questionId, optionId) => {
    setAnswers(a => ({ ...a, [questionId]: optionId }));
  };

  const currentPageQuestions = questions.slice(page * STEPS_PER_PAGE, (page + 1) * STEPS_PER_PAGE);
  const totalPages = Math.ceil(questions.length / STEPS_PER_PAGE);
  const answered = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answered / questions.length) * 100 : 0;

  const pageAnswered = currentPageQuestions.every(q => Object.prototype.hasOwnProperty.call(answers, q.id));

  const handleSubmit = async () => {
    if (answered < questions.length) {
      setError(`Debe responder todas las preguntas. Faltan ${questions.length - answered}.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const answersArray = isBurnout
        ? questions.map(q => ({ question_id: q.id, numeric_value: answers[q.id] ?? 0 }))
        : questions.map(q => ({ question_id: q.id, selected_option_id: answers[q.id] }));
      const { data } = await api.post('/responses', {
        event_id: parseInt(eventId),
        participant_full_name: participantName.trim(),
        answers: answersArray,
      });
      setResult(data);
      setPhase('result');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar respuestas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress size={48} /></Box>;
  if (error && !result) return <Box mt={4}><Alert severity="error">{error}</Alert><Button sx={{ mt: 2 }} onClick={() => navigate('/')}>Volver</Button></Box>;

  if (phase === 'result' && result) {
    if (result.test_type === 'BURNOUT') {
      const nivelColor = { BAJO: '#66BB6A', MEDIO: '#FFA726', ALTO: '#EF5350' };
      const subescalas = [
        { key: 'CE', label: 'Cansancio Emocional', score: result.burnout_ce, nivel: result.burnout_ce_nivel, max: 54, indicio: result.burnout_ce_nivel === 'ALTO' },
        { key: 'DP', label: 'Despersonalización',  score: result.burnout_dp, nivel: result.burnout_dp_nivel, max: 30, indicio: result.burnout_dp_nivel === 'ALTO' },
        { key: 'RP', label: 'Realización Personal', score: result.burnout_rp, nivel: result.burnout_rp_nivel, max: 48, indicio: result.burnout_rp_nivel === 'BAJO', invertColor: true },
      ];
      return (
        <Box maxWidth={700} mx="auto">
          <Box textAlign="center" mb={4}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={700} color="success.main">¡Cuestionario completado!</Typography>
            <Typography color="text.secondary">Gracias, {participantName}</Typography>
          </Box>
          <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3 }}>
            <Box sx={{ bgcolor: '#BF360C', p: 2.5 }}>
              <Typography variant="h6" color="white" fontWeight={700}>Resultado Burnout (MBI)</Typography>
            </Box>
            <CardContent>
              {subescalas.map(s => (
                <Box key={s.key} mb={2.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="body2" fontWeight={600}>{s.label}</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={700}>{s.score} / {s.max}</Typography>
                      <Chip label={s.nivel} size="small" sx={{ bgcolor: s.invertColor ? nivelColor[s.nivel === 'BAJO' ? 'ALTO' : s.nivel === 'ALTO' ? 'BAJO' : 'MEDIO'] : nivelColor[s.nivel], color: 'white', fontWeight: 700 }} />
                      {s.indicio && <Chip label="Indicio Burnout" size="small" color="error" variant="outlined" />}
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={(s.score / s.max) * 100} sx={{ height: 12, borderRadius: 6, bgcolor: '#F5F5F5', '& .MuiLinearProgress-bar': { bgcolor: s.invertColor ? nivelColor[s.nivel === 'BAJO' ? 'ALTO' : s.nivel === 'ALTO' ? 'BAJO' : 'MEDIO'] : nivelColor[s.nivel], borderRadius: 6 } }} />
                </Box>
              ))}
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="error.main" gutterBottom>Diagnóstico</Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>{result.burnout_diagnostico}</Typography>
            </CardContent>
          </Card>
          <Alert severity="warning" sx={{ mb: 3 }}>⚠️ Este resultado es orientativo y no constituye diagnóstico psicológico clínico.</Alert>
          <Button variant="contained" onClick={() => navigate('/')} sx={{ borderRadius: 2 }}>Volver al inicio</Button>
        </Box>
      );
    }

    const domLabel = (result.dominant_temperament || '').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático');
    const secLabel = result.secondary_temperament ? (TEMP_LABELS[result.secondary_temperament] || result.secondary_temperament) : null;
    const total = result.score_a + result.score_b + result.score_c + result.score_d;

    return (
      <Box maxWidth={700} mx="auto">
        <Box textAlign="center" mb={4}>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
          <Typography variant="h5" fontWeight={700} color="success.main">¡Test completado!</Typography>
          <Typography color="text.secondary">Gracias, {participantName}</Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3 }}>
          <Box sx={{ bgcolor: '#1565C0', p: 2.5 }}>
            <Typography variant="h6" color="white" fontWeight={700}>Resultado de Temperamento</Typography>
          </Box>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
              <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: '#E3F2FD', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">Temperamento Dominante</Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">{domLabel}</Typography>
              </Paper>
              {secLabel && (
                <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: '#F3E5F5', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Temperamento Secundario</Typography>
                  <Typography variant="h6" fontWeight={700} color="secondary.main">{secLabel}</Typography>
                </Paper>
              )}
            </Box>

            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Puntuación por temperamento</Typography>
            {[
              { label: 'Sanguíneo (A)', score: result.score_a, color: '#42A5F5' },
              { label: 'Colérico (B)', score: result.score_b, color: '#EF5350' },
              { label: 'Melancólico (C)', score: result.score_c, color: '#7E57C2' },
              { label: 'Flemático (D)', score: result.score_d, color: '#66BB6A' },
            ].map(item => (
              <Box key={item.label} mb={1.5}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2">{item.label}</Typography>
                  <Typography variant="body2" fontWeight={700}>{item.score} ({total > 0 ? ((item.score / total) * 100).toFixed(1) : 0}%)</Typography>
                </Box>
                <LinearProgress variant="determinate" value={total > 0 ? (item.score / total) * 100 : 0} sx={{ height: 10, borderRadius: 5, bgcolor: '#F5F5F5', '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 5 } }} />
              </Box>
            ))}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom color="primary.main">Conclusión</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{result.conclusion}</Typography>
          </CardContent>
        </Card>

        <Alert severity="warning" sx={{ mb: 3 }}>
          ⚠️ Este resultado es orientativo y no constituye diagnóstico psicológico clínico.
        </Alert>

        <Button variant="contained" onClick={() => navigate('/')} sx={{ borderRadius: 2 }}>
          Volver al inicio
        </Button>
      </Box>
    );
  }

  if (phase === 'name') {
    return (
      <Box maxWidth={500} mx="auto" mt={4}>
        <Card sx={{ borderRadius: 3, boxShadow: 4 }}>
          <Box sx={{ bgcolor: '#1565C0', p: 2.5 }}>
            <Typography variant="h6" color="white" fontWeight={700}>{event?.test_name}</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>{event?.name}</Typography>
          </Box>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Para registrar su participación, ingrese su nombre completo tal como aparece en su documento de identidad.
            </Typography>
            <TextField
              label="Nombre completo"
              fullWidth
              value={participantName}
              onChange={e => setParticipantName(e.target.value)}
              error={!!nameError}
              helperText={nameError}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCheckName()}
            />
            <Button
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, borderRadius: 2, fontWeight: 700 }}
              onClick={handleCheckName}
              disabled={checkingName || !participantName.trim()}
            >
              {checkingName ? <CircularProgress size={24} color="inherit" /> : 'Continuar al test'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const section = currentPageQuestions[0]?.section;

  return (
    <Box maxWidth={800} mx="auto">
      <Box mb={3}>
        <Typography variant="h6" fontWeight={700}>{event?.test_name}</Typography>
        <Typography variant="body2" color="text.secondary">{participantName} · {event?.name}</Typography>
        <Box mt={1.5}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary">Progreso general</Typography>
            <Typography variant="caption" fontWeight={700}>{answered}/{questions.length} respondidas</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
        </Box>
      </Box>

      {!isBurnout && section && (
        <Box mb={2}>
          <Chip
            label={section === 'FORTALEZAS' ? '💪 Fortalezas (Preguntas 1-20)' : '⚠️ Debilidades (Preguntas 21-40)'}
            color={section === 'FORTALEZAS' ? 'success' : 'warning'}
            sx={{ fontWeight: 700 }}
          />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {isBurnout ? (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2, mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#BF360C' }}>
                <TableCell sx={{ color: 'white', fontWeight: 700, width: 40 }}>#</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Afirmación</TableCell>
                {[0,1,2,3,4,5,6].map(v => (
                  <TableCell key={v} align="center" sx={{ color: 'white', fontWeight: 700, px: 0.5, minWidth: 36 }}>{v}</TableCell>
                ))}
              </TableRow>
              <TableRow sx={{ bgcolor: '#E8E8E8' }}>
                <TableCell colSpan={2} />
                {['Nunca','P.veces año','1x mes','P.veces mes','1x semana','P.veces semana','Todos días'].map((l, i) => (
                  <TableCell key={i} align="center" sx={{ fontSize: 9, px: 0.5, lineHeight: 1.2, color: '#555' }}>{l}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {currentPageQuestions.map((q, idx) => (
                <TableRow key={q.id} sx={{ bgcolor: idx % 2 === 0 ? 'white' : '#FFF8E1', '&:hover': { bgcolor: '#FFF3E0' } }}>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>{q.number}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{q.text}</TableCell>
                  {[0,1,2,3,4,5,6].map(v => {
                    const isSelected = answers[q.id] === v;
                    return (
                      <TableCell key={v} align="center" padding="none" sx={{ py: 0.5 }}>
                        <Box
                          onClick={() => handleAnswer(q.id, v)}
                          sx={{
                            width: 28, height: 28, borderRadius: '50%', mx: 'auto',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontWeight: isSelected ? 700 : 400,
                            fontSize: 13,
                            bgcolor: isSelected ? '#BF360C' : 'transparent',
                            color: isSelected ? 'white' : 'text.primary',
                            border: isSelected ? '2px solid #BF360C' : '2px solid #E0E0E0',
                            '&:hover': { bgcolor: isSelected ? '#BF360C' : '#FFE0B2', borderColor: '#BF360C' },
                            transition: 'all 0.12s',
                          }}
                        >
                          {v}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {!isBurnout && currentPageQuestions.map((question) => {
        const selectedId = answers[question.id];
        return (
          <Card key={question.id} sx={{ mb: 1.5, borderRadius: 2, boxShadow: 1, border: selectedId ? '1.5px solid #1565C0' : '1.5px solid #E0E0E0', transition: 'border 0.15s' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                  {question.number}.
                </Typography>
                <Box display="flex" flex={1} gap={1} flexWrap="wrap">
                  {question.options?.map((opt) => {
                    const isSelected = selectedId === opt.id;
                    return (
                      <Box
                        key={opt.id}
                        onClick={() => handleAnswer(question.id, opt.id)}
                        sx={{
                          flex: '1 1 0',
                          minWidth: 100,
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #1565C0' : '2px solid #E0E0E0',
                          borderRadius: 2,
                          px: 1.5,
                          py: 1,
                          textAlign: 'center',
                          bgcolor: isSelected ? '#E3F2FD' : 'white',
                          transition: 'all 0.15s',
                          userSelect: 'none',
                          '&:hover': { bgcolor: isSelected ? '#BBDEFB' : '#F5F5F5', borderColor: '#1565C0' },
                        }}
                      >
                        <Typography variant="body2" fontWeight={isSelected ? 700 : 400} color={isSelected ? 'primary.main' : 'text.primary'} lineHeight={1.3}>
                          {opt.text}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>
        );
      })}

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
          disabled={page === 0}
          sx={{ borderRadius: 2 }}
        >
          Anterior
        </Button>

        <Typography variant="body2" color="text.secondary">
          Página {page + 1} de {totalPages}
        </Typography>

        {page < totalPages - 1 ? (
          <Tooltip title={!pageAnswered ? 'Debes responder todas las preguntas de esta página' : ''} arrow>
            <span>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
                disabled={!pageAnswered}
                sx={{ borderRadius: 2 }}
              >
                Siguiente
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title={answered < questions.length ? `Faltan ${questions.length - answered} pregunta${questions.length - answered !== 1 ? 's' : ''} por responder` : ''} arrow>
            <span>
              <Button
                variant="contained"
                color="success"
                startIcon={<Send />}
                onClick={handleSubmit}
                disabled={submitting || answered < questions.length}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                {submitting ? <CircularProgress size={20} color="inherit" /> : 'Enviar Test'}
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
