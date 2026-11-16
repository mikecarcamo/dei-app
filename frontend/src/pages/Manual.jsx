import React from 'react';
import {
  Box, Typography, Card, CardContent, Accordion, AccordionSummary, AccordionDetails,
  Chip, Divider, Table, TableBody, TableCell, TableRow,
} from '@mui/material';
import { ExpandMore, MenuBook } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

function Section({ title, children, defaultOpen = false }) {
  return (
    <Accordion defaultExpanded={defaultOpen} sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography fontWeight={700} color="primary.main">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

const P = ({ children, mt = 0 }) => <Typography variant="body2" mt={mt} sx={{ textAlign: 'justify' }}>{children}</Typography>;
const Li = ({ children }) => <Typography variant="body2" component="li" sx={{ ml: 2, mb: 0.5 }}>{children}</Typography>;

export default function Manual() {
  const { user } = useAuth();
  const r = user?.role;

  return (
    <Box maxWidth={900}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <MenuBook color="primary" />
        <Typography variant="h5" fontWeight={700} color="primary.main">Manual de Usuario</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Guía de uso del sistema DEI según su rol. Su rol actual: <Chip size="small" label={r} color="primary" />
      </Typography>

      <Section title="Conceptos generales" defaultOpen>
        <P>DEI es una plataforma de evaluación psicológica con dos grandes módulos:</P>
        <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
          <Li><b>Evaluaciones organizacionales:</b> tests de Personalidad/Temperamento, Burnout (MBI) y Clima Laboral, aplicados a las empresas por medio de eventos con licencia.</Li>
          <Li><b>Tamizaje clínico:</b> herramienta de apoyo para terapeutas (PHQ-9, GAD-7, PCL-5, C-SSRS) con historia clínica por paciente.</Li>
        </ul>
        <P mt={1}>Las fechas se manejan en hora de Guatemala (UTC-6). Los reportes PDF pueden incluir un análisis generado por inteligencia artificial, de uso orientativo, nunca diagnóstico.</P>
      </Section>

      {(r === 'ADMIN' || r === 'EMPRESA' || r === 'USUARIO') && (
        <Section title="Evaluaciones organizacionales (cómo funciona)">
          <ol style={{ margin: '4px 0', paddingLeft: 16 }}>
            <Li><b>Plantilla:</b> el catálogo de tests (Personalidad, Burnout MBI, Clima Laboral) se crea una sola vez y se reutiliza.</Li>
            <Li><b>Evento:</b> se asigna un test a una entidad con fechas de vigencia, usuarios participantes y licencia. En Clima Laboral las respuestas son anónimas mediante códigos de participación (CLI-XXXXXX).</Li>
            <Li><b>Respuesta:</b> cada usuario asignado ve el test en "Mis Test" mientras el evento y su licencia estén vigentes. En Clima, cada "Iniciar Test" reclama un código único hasta agotarlos.</Li>
            <Li><b>Reportes:</b> desde Reportes (admin) o Eventos (empresa) se genera el PDF consolidado con tres modos: resumen general, conclusión por persona o detalle de respuestas. Incluye análisis de IA con enfoque clínico-organizacional, firma y sello.</Li>
            <Li><b>Reporte comparativo:</b> cuando una entidad tiene 2 o más eventos del mismo tipo de test, en el evento más reciente aparece el botón "PDF Comparativo" que combina hasta los últimos 3 eventos: tabla, gráfica comparativa y análisis de evolución (qué mejoró o empeoró).</Li>
          </ol>
        </Section>
      )}

      {r === 'ADMIN' && (
        <Section title="Rol Administrador" defaultOpen>
          <Table size="small">
            <TableBody>
              {[
                ['Dashboard', 'Resumen general del sistema.'],
                ['Entidades', 'Alta de empresas/organizaciones. El submenú Terapeutas permite crear usuarios TERAPEUTA con su licencia de tamizaje y configurar los recursos de crisis por país.'],
                ['Usuarios', 'Crear/editar usuarios de cualquier rol (ADMIN, EMPRESA, USUARIO, TERAPEUTA). Al elegir TERAPEUTA se piden las fechas de la licencia.'],
                ['Tests', 'Catálogo de plantillas de evaluación y sus preguntas.'],
                ['Eventos', 'Crear eventos: test + entidad + fechas + usuarios asignados + licencia. En Clima se definen códigos y precio por código; en otros tests el monto del evento es fijo.'],
                ['Licencias', 'Licencias de uso por usuario/evento con vigencia.'],
                ['Reportes', 'PDF individuales, consolidados y comparativos de todos los eventos.'],
              ].map(([k, v]) => (
                <TableRow key={k}><TableCell sx={{ fontWeight: 700, width: 160 }}>{k}</TableCell><TableCell sx={{ fontSize: 13 }}>{v}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      {r === 'EMPRESA' && (
        <Section title="Rol Empresa" defaultOpen>
          <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
            <Li><b>Usuarios:</b> crea y administra los usuarios de su entidad (siempre rol USUARIO).</Li>
            <Li><b>Eventos:</b> ve los eventos asignados a su empresa y descarga el PDF Consolidado en cualquiera de ellos, activos o inactivos.</Li>
            <Li><b>Resultados Empresa:</b> consulta los resultados agregados.</Li>
          </ul>
        </Section>
      )}

      {r === 'USUARIO' && (
        <Section title="Rol Usuario" defaultOpen>
          <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
            <Li><b>Mis Test:</b> lista los tests asignados que están vigentes (evento y licencia activos).</Li>
            <Li><b>Responder:</b> presione el test y conteste todas las preguntas. En Clima Laboral su respuesta es anónima: se registra con un código de participación, no con su nombre.</Li>
            <Li>Una vez enviado, el test no puede editarse.</Li>
          </ul>
        </Section>
      )}

      {r === 'TERAPEUTA' && (
        <Section title="Rol Terapeuta — Tamizaje clínico" defaultOpen>
          <P><b>Licencia:</b> el administrador le asigna una licencia con vigencia. Sin licencia vigente solo puede consultar el historial; no puede crear pacientes ni tamizajes.</P>
          <Divider sx={{ my: 1 }} />
          <P><b>Pacientes</b></P>
          <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
            <Li><b>Nuevo paciente:</b> registre nombre, datos básicos y consentimiento informado (obligatorio). El sistema genera el código PAC-XXXXXX.</Li>
            <Li><b>Ficha:</b> icono de documento — genera un PDF con los datos del paciente y el resumen de todos sus tamizajes.</Li>
            <Li><b>Historial:</b> abre el detalle del paciente con su lista de tamizajes.</Li>
            <Li><b>Nuevo tamizaje:</b> el terapeuta llena los instrumentos y parámetros básicos él mismo; al guardar se genera puntaje, severidad, alerta de riesgo y análisis de IA.</Li>
            <Li><b>Pill "Nuevo":</b> marca los tamizajes enviados por el paciente por link que aún no revisa.</Li>
          </ul>
          <P mt={1}><b>Link para el paciente (un solo uso)</b></P>
          <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
            <Li>Icono de eslabón: seleccione los instrumentos, genere el link y compártalo (copiar).</Li>
            <Li>El paciente abre el link sin login, ve su nombre y solo responde las preguntas e información adicional; no ve resultados.</Li>
            <Li>Al enviarse, el link queda inutilizado, el tamizaje se guarda en la ficha del paciente y usted recibe un correo de aviso.</Li>
          </ul>
          <P mt={1}><b>Instrumentos y riesgo</b></P>
          <P mt={0.5}>PHQ-9 (depresión), GAD-7 (ansiedad), PCL-5 (estrés postraumático) y C-SSRS (riesgo suicida). El puntaje, la severidad y la alerta de riesgo los calcula el sistema — nunca la IA. La IA solo sugiere hipótesis diagnósticas validadas contra una lista permitida, como apoyo a su criterio profesional.</P>
          <P mt={1}><b>Firma y Sello:</b> suba su imagen de firma con sello; el sistema le quita el fondo (sensibilidad ajustable), la comprime a 280×84 y la coloca montada sobre su nombre al final de los PDF.</P>
          <P mt={1}><b>Aviso importante:</b> el tamizaje es una herramienta de apoyo y NO constituye un diagnóstico. Requiere evaluación y criterio de un profesional de salud mental.</P>
        </Section>
      )}

      <Section title="Preguntas frecuentes">
        <P><b>¿Por qué no veo un test en "Mis Test"?</b> El evento o su licencia vencieron. Los eventos vencen a medianoche hora de Guatemala del último día.</P>
        <P mt={1}><b>¿Por qué un PDF tarda varios segundos?</b> Al descargar se genera el análisis con IA en ese momento (5-15 segundos).</P>
        <P mt={1}><b>¿Qué pasa si la IA no responde?</b> El PDF se genera igual, sin la página de análisis.</P>
        <P mt={1}><b>¿Las respuestas de Clima Laboral son realmente anónimas?</b> Sí: se guardan con el código de participación, sin datos del trabajador.</P>
      </Section>
    </Box>
  );
}
