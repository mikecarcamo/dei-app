import React from 'react';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Chip, Divider, Stepper, Step, StepLabel, StepContent, Paper, Alert,
} from '@mui/material';
import { ExpandMore, MenuBook, VpnKey, People, Edit, QrCode, PictureAsPdf, History, FactCheck, Description, Link as LinkIcon } from '@mui/icons-material';
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

// Fila de campos tipo formulario, para mostrar qué llena el usuario
const Fields = ({ items }) => (
  <Paper variant="outlined" sx={{ p: 1.5, my: 1, bgcolor: '#F5F7FA', borderRadius: 2 }}>
    <Box display="flex" gap={1} flexWrap="wrap">
      {items.map((f, i) => (
        <Chip key={i} label={f} size="small" variant="outlined" color={f.endsWith('*') ? 'primary' : 'default'} sx={{ fontSize: 12 }} />
      ))}
    </Box>
  </Paper>
);

// Mini-muestra de una barra de acciones de pantalla
const ActionBar = ({ items }) => (
  <Paper variant="outlined" sx={{ p: 1.5, my: 1, bgcolor: '#F5F7FA', borderRadius: 2 }}>
    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Así se ve en pantalla — columna "Acciones":</Typography>
    <Box display="flex" gap={2} alignItems="center">
      {items.map((a, i) => (
        <Box key={i} display="flex" flexDirection="column" alignItems="center" sx={{ minWidth: 44 }}>
          {a.icon}
          <Typography variant="caption" sx={{ fontSize: 10, textAlign: 'center' }}>{a.label}</Typography>
        </Box>
      ))}
    </Box>
  </Paper>
);

const MenuPath = ({ children }) => (
  <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: '#E3F2FD', px: 1, py: 0.3, borderRadius: 1, display: 'inline-block', mb: 0.5 }}>
    {children}
  </Typography>
);

const Steps = ({ steps }) => (
  <Stepper orientation="vertical" sx={{ mt: 1 }}>
    {steps.map((s, i) => (
      <Step key={i} active expanded>
        <StepLabel><Typography variant="body2" fontWeight={700}>{s.label}</Typography></StepLabel>
        <StepContent><Typography variant="body2">{s.body}</Typography>{s.extra}</StepContent>
      </Step>
    ))}
  </Stepper>
);

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
        Instrucciones paso a paso según su rol. Rol actual: <Chip size="small" label={r} color="primary" />
      </Typography>

      <Section title="Acceso al sistema" defaultOpen>
        <Steps steps={[
          { label: 'Ingrese a la página web de DEI', body: 'Abra la dirección del sistema en su navegador.' },
          { label: 'Escriba su correo y contraseña y presione "Iniciar sesión"', body: 'Use el correo con que lo registraron. Si es su primer ingreso o el administrador lo marcó, el sistema le pedirá crear una contraseña nueva.' },
          { label: 'Verá su pantalla de inicio según su rol', body: 'El menú lateral izquierdo muestra solo las opciones de su rol. Siempre puede volver al manual desde "Manual de Usuario", junto a "Cerrar Sesión".' },
        ]} />
        <P mt={1}><b>¿Olvidó la contraseña?</b> En la pantalla de ingreso use "¿Olvidó su contraseña?"; llegará un correo con el enlace para restablecerla.</P>
      </Section>

      {r === 'ADMIN' && (
        <>
          <Section title="ADMIN · Crear una entidad" defaultOpen>
            <MenuPath>Menú: Entidades → botón "Nueva Entidad"</MenuPath>
            <Steps steps={[
              { label: 'Menú Entidades', body: 'En el menú lateral presione "Entidades". Se lista cada empresa/organización con su estado.' },
              { label: 'Presione "Nueva Entidad" (arriba a la derecha)', body: 'Se abre el formulario.', extra: <Fields items={['Nombre *', 'Descripción']} /> },
              { label: 'Escriba el nombre y guarde', body: 'Nombre es obligatorio; la descripción es opcional. Presione "Guardar".' },
              { label: 'Editar o desactivar', body: 'En la tabla, el lápiz abre "Editar Entidad"; ahí puede desactivarla con el interruptor "Estado".' },
            ]} />
          </Section>

          <Section title="ADMIN · Crear un usuario">
            <MenuPath>Menú: Usuarios → botón "Nuevo Usuario"</MenuPath>
            <Steps steps={[
              { label: 'Menú Usuarios', body: 'Presione "Nuevo Usuario".' },
              { label: 'Complete el formulario', body: 'Nombre completo, correo electrónico y contraseña (mínimo 8 caracteres; el botón de recarga genera una segura). Elija el Rol y, si aplica, la Entidad.', extra: <Fields items={['Nombre completo *', 'Correo electrónico *', 'Contraseña *', 'Rol *', 'Entidad']} /> },
              { label: 'Roles disponibles', body: 'ADMIN = administrador total · EMPRESA = ve solo su entidad (asigna usuarios a eventos y descarga consolidados) · USUARIO = responde tests · TERAPEUTA = módulo de tamizaje.' },
              { label: 'Si elige rol TERAPEUTA', body: 'Aparecen los campos "Licencia desde / Licencia hasta" — es la vigencia del módulo de tamizaje; son obligatorios y la licencia se crea automáticamente al guardar.' },
              { label: 'Forzar cambio al primer login', body: 'Deje encendido el interruptor si quiere que el usuario defina su propia contraseña al entrar por primera vez. Presione "Guardar".' },
              { label: 'Cambiar el rol de alguien existente', body: 'Use el lápiz (Editar). Si pasa a TERAPEUTA, también le pedirá las fechas de licencia. Si ya era terapeuta, no se duplica la licencia.' },
            ]} />
          </Section>

          <Section title="ADMIN · Test y licencias">
            <MenuPath>Menú: Tests</MenuPath>
            <P>El catálogo (Personalidad/Temperamento, Burnout MBI, Clima Laboral) ya viene creado. "Nuevo Test" solo crea la ficha del test — las preguntas de los instrumentos estándar son fijas. Con la flecha de cada fila puede ver las preguntas de un test.</P>
            <Divider sx={{ my: 1.5 }} />
            <MenuPath>Menú: Licencias → botón "Nueva Licencia"</MenuPath>
            <Steps steps={[
              { label: 'Presione "Nueva Licencia"', body: 'Elija la pestaña "Generar automáticamente" (el sistema crea la key) o "Ingresar manualmente" (usted escribe la key).', extra: <Fields items={['Entidad *', 'Key (solo manual)', 'Válida desde *', 'Válida hasta *']} /> },
              { label: 'Guarde', body: 'La licencia queda "activa" y sin asignar; se amarra a un evento al crearlo.' },
              { label: 'Anular', body: 'En la tabla, el botón rojo anula una licencia activa. Los eventos con licencia vencida o anulada dejan de mostrar los tests a los usuarios.' },
            ]} />
          </Section>

          <Section title="ADMIN · Crear un evento de evaluación">
            <MenuPath>Menú: Eventos → botón "Nuevo Evento"</MenuPath>
            <Steps steps={[
              { label: 'Presione "Nuevo Evento"', body: '', extra: <Fields items={['Nombre del evento *', 'Entidad *', 'Test *', 'Licencia *']} /> },
              { label: 'Nombre y entidad', body: 'Escriba el nombre del evento y elija la Entidad.' },
              { label: 'Elija el Test', body: 'Personalidad/Temperamento, Burnout o Clima Laboral.' },
              { label: 'Campos extra si es Clima Laboral', body: 'Aparece "Dirigido a", "Cantidad de códigos a generar" (un código = un participante anónimo), "Precio por código (Q)" y "Monto del evento (Q)" — se calculan entre sí al escribir dos de ellos.', extra: <Fields items={['Dirigido a *', 'Cantidad de códigos *', 'Precio por código', 'Monto del evento']} /> },
              { label: 'Elija la Licencia', body: 'Se listan las licencias activas de esa entidad. Si no hay, presione "Crear licencia para <entidad>" y se genera desde el mismo formulario. Las fechas del evento se toman de la vigencia de la licencia.' },
              { label: 'Guarde', body: 'El evento queda creado.' },
              { label: 'Asigne participantes', body: 'En la tabla, según el tipo de test:', extra: (
                <ActionBar items={[
                  { icon: <Edit fontSize="small" />, label: 'Editar' },
                  { icon: <People fontSize="small" />, label: 'Asignar usuarios (tests normales)' },
                  { icon: <QrCode fontSize="small" />, label: 'Ver códigos (solo Clima)' },
                ]} />
              )},
              { label: 'En Clima Laboral', body: 'El icono QR muestra los códigos; con "Agregar códigos" + "Generar" puede crear más después. Los códigos se asignan solos cuando cada usuario presiona "Iniciar Test".' },
            ]} />
          </Section>

          <Section title="ADMIN · Reportes y PDF">
            <MenuPath>Menú: Reportes → filtre por Entidad y/o Estado</MenuPath>
            <Steps steps={[
              { label: 'Seleccione una entidad o un estado', body: 'Los eventos aparecen como acordeones; ábralos para cargar las respuestas.' },
              { label: 'PDF individual', body: 'En cada respuesta, el icono de descarga genera el PDF individual de esa persona (con análisis de IA). El ojo muestra el detalle en pantalla y la ✕ anula una respuesta.' },
              { label: 'PDF Consolidado', body: 'Botón morado dentro del evento. Tres opciones: resumen general (tabla de participantes), con conclusión por persona, o con detalle completo de respuestas. Funciona aunque el evento esté inactivo.' },
              { label: 'PDF Comparativo', body: 'Aparece solo en el evento más reciente cuando la entidad tiene 2+ eventos del mismo test: compara los últimos 3 con tabla, gráfica y análisis de evolución de la IA.' },
            ]} />
            <P mt={1}>Los PDF tardan unos segundos porque el análisis de IA se genera en ese momento.</P>
          </Section>

          <Section title="ADMIN · Terapeutas y recursos de crisis">
            <MenuPath>Menú: Entidades → Terapeutas</MenuPath>
            <Steps steps={[
              { label: '"Nuevo Terapeuta"', body: 'Crea el usuario con rol TERAPEUTA y su licencia en un solo paso.', extra: <Fields items={['Nombre completo *', 'Correo *', 'Contraseña inicial *', 'Entidad (opcional)', 'Vigente desde/hasta *']} /> },
              { label: 'Licencias', body: 'El icono de llave abre el historial de licencias del terapeuta: anular (rojo), reactivar (verde) o "Crear licencia" para renovar con nuevas fechas.' },
              { label: 'Recursos y protocolo de crisis', body: 'Al final de la página hay un cuadro de texto: es lo que se muestra en la alerta roja de riesgo suicida/homicida. Verifique que los números sean correctos para su país y presione "Guardar".' },
            ]} />
          </Section>
        </>
      )}

      {r === 'EMPRESA' && (
        <>
          <Section title="EMPRESA · Crear usuarios" defaultOpen>
            <MenuPath>Menú: Usuarios → botón "Nuevo Usuario"</MenuPath>
            <Steps steps={[
              { label: 'Presione "Nuevo Usuario"', body: 'Complete nombre, correo y contraseña (el botón de recarga genera una segura). El usuario se crea con rol USUARIO dentro de su empresa — no puede elegir otro rol.' },
              { label: 'Comparta las credenciales', body: 'El usuario entrará con su correo y esa contraseña; si dejó encendido "Forzar cambio al primer login", él definirá la suya al entrar.' },
            ]} />
          </Section>
          <Section title="EMPRESA · Eventos y reportes">
            <MenuPath>Menú: Eventos</MenuPath>
            <Steps steps={[
              { label: 'Asignar participantes', body: 'En el evento activo, el icono de personas abre "Asignar Usuarios": marque con checkbox quiénes responderán y presione "Guardar asignación". Solo esos usuarios verán el test.' },
              { label: 'Clima Laboral', body: 'El icono QR muestra los códigos usados/disponibles. No se asignan usuarios manualmente: cada trabajador al presionar "Iniciar Test" recibe un código anónimo.' },
              { label: 'Descargar resultados', body: 'El icono PDF morado abre "PDF Consolidado" con tres opciones: resumen general, conclusión por persona o detalle de respuestas. Disponible también en eventos inactivos. Si hay 2+ eventos del mismo test, aparece además el botón "PDF Comparativo".' },
            ]} />
            <ActionBar items={[
              { icon: <QrCode fontSize="small" />, label: 'Códigos (Clima)' },
              { icon: <People fontSize="small" />, label: 'Asignar usuarios' },
              { icon: <PictureAsPdf fontSize="small" color="secondary" />, label: 'PDF Consolidado' },
            ]} />
          </Section>
        </>
      )}

      {r === 'USUARIO' && (
        <Section title="USUARIO · Responder un test" defaultOpen>
          <MenuPath>Menú: Mis Test</MenuPath>
          <Steps steps={[
            { label: 'Verá tarjetas con los tests disponibles', body: 'Solo aparecen si el evento está activo, dentro de fechas y con licencia válida. Cada tarjeta indica el nombre del test, la entidad y el período.' },
            { label: 'Presione "Iniciar Test"', body: 'En tests normales se abre el formulario. En Clima Laboral se le asigna un código anónimo de participación — sus respuestas no llevan su nombre.' },
            { label: 'Responda todo y envíe', body: 'Conteste todas las preguntas; al presionar enviar, sus respuestas quedan registradas. No puede editarse después.' },
            { label: 'Cuando termine', body: 'En Clima la tarjeta mostrará "Encuesta completada"; en otros tests el test desaparecerá de la lista al vencer el evento.' },
          ]} />
        </Section>
      )}

      {r === 'TERAPEUTA' && (
        <>
          <Section title="TERAPEUTA · Registrar un paciente" defaultOpen>
            <MenuPath>Menú: Pacientes → botón "Nuevo paciente"</MenuPath>
            <Steps steps={[
              { label: 'Presione "Nuevo paciente"', body: 'El código PAC-XXXXXX se genera solo al guardar.', extra: <Fields items={['Nombre completo *', 'Fecha de nacimiento', 'Sexo', 'Teléfono', 'Correo', 'Motivo de consulta', 'Antecedentes', 'Medicación actual', 'Consentimiento informado *']} /> },
              { label: 'Marque el consentimiento informado', body: 'Es obligatorio; sin él no deja guardar.' },
              { label: 'Guarde', body: 'Se abre directo la ficha del paciente. Desde la lista también puede editar sus datos después.' },
            ]} />
            <P mt={1}><b>Sin licencia vigente</b> el botón se deshabilita: puede consultar historial pero no registrar nada (aviso rojo en pantalla).</P>
          </Section>

          <Section title="TERAPEUTA · Aplicar un tamizaje">
            <MenuPath>Pacientes → icono de clipboard (Nuevo tamizaje)</MenuPath>
            <Steps steps={[
              { label: 'Seleccione el paciente y los instrumentos', body: 'PHQ-9 (depresión), GAD-7 (ansiedad), PCL-5 (estrés postraumático) y C-SSRS (riesgo suicida) — puede combinar varios.' },
              { label: 'Responda cada ítem', body: 'Marque la opción de cada pregunta. En C-SSRS algunas preguntas solo aparecen si la anterior fue "Sí".' },
              { label: 'Complete la información adicional', body: 'Síntomas físicos/emocionales, duración, funcionamiento, consumo de sustancias, riesgo suicida/homicida observado y observaciones.' },
              { label: 'Presione "Guardar Tamizaje"', body: 'El sistema calcula puntaje y severidad de cada instrumento y la alerta de riesgo (ítem 9 del PHQ-9 &gt; 0, C-SSRS positivo o riesgo marcado = alerta roja con los recursos de crisis). Después la IA genera el panorama clínico e hipótesis.' },
              { label: 'Revise el resultado', body: 'Verá tarjetas por instrumento, la conclusión de la IA, hipótesis con nivel de apoyo, criterios y recomendaciones. Puede "Regenerar análisis" o descargar el PDF.' },
            ]} />
          </Section>

          <Section title="TERAPEUTA · Enviar link para que el paciente responda solo">
            <MenuPath>Pacientes → icono de eslabón</MenuPath>
            <Steps steps={[
              { label: 'Presione el icono de link del paciente', body: 'Marque los instrumentos que responderá el paciente y presione "Generar link".' },
              { label: 'Copie y comparta el link', body: 'Botón "Copiar link" — envíelo por WhatsApp, correo, etc.' },
              { label: 'Qué ve el paciente', body: 'Abre el link sin login, ve solo su nombre y los instrumentos elegidos; responde y presiona enviar. Nunca ve resultados y el link muere al usarse.' },
              { label: 'Qué pasa al enviar', body: 'El tamizaje se guarda solo en la ficha del paciente, aparece un pill azul "Nuevo" en su lista y usted recibe un correo de aviso. Al abrir el registro, el pill desaparece.' },
            ]} />
          </Section>

          <Section title="TERAPEUTA · Ficha y acciones por paciente">
            <MenuPath>Pacientes → columna Acciones</MenuPath>
            <ActionBar items={[
              { icon: <Description fontSize="small" />, label: 'Ficha (PDF)' },
              { icon: <History fontSize="small" />, label: 'Historial' },
              { icon: <FactCheck fontSize="small" color="primary" />, label: 'Nuevo tamizaje' },
              { icon: <LinkIcon fontSize="small" />, label: 'Generar link' },
            ]} />
            <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
              <Li><b>Ficha:</b> PDF con datos del paciente y el resumen de todos sus tamizajes (fechas, puntajes, riesgo).</Li>
              <Li><b>Historial:</b> abre el expediente: datos + cada tamizaje con su resultado y PDF individual.</Li>
              <Li><b>Nuevo tamizaje:</b> el formulario que usted llena (ver sección anterior).</Li>
              <Li><b>Link:</b> genera el link de un solo uso para que el paciente responda solo.</Li>
            </ul>
          </Section>

          <Section title="TERAPEUTA · Citas (agenda)">
            <MenuPath>Menú: Citas</MenuPath>
            <Steps steps={[
              { label: 'Vista de calendario', body: 'Botones superiores "Mes / Semana / Día" para cambiar la vista, y las flechas para navegar. También puede presionar un espacio vacío del calendario para crear una cita en ese horario.' },
              { label: '"Nueva cita"', body: 'Seleccione el paciente de la lista o "+ Nuevo paciente…" para registrarlo ahí mismo. Elija la Categoría (Presencial — MENTAL Zona 9, Presencial — DEI Zona 1, Virtual o Llamada telefónica) e indique "Fecha y hora" — la cita dura 1 hora automáticamente y queda en estado "Agendada". El sistema rechaza la cita si se traslapa con otra cita suya o con un horario bloqueado.' },
              { label: '"Bloquear horario"', body: 'Marque el rango "Desde / Hasta" (fechas y horas) y un motivo opcional (vacaciones, congreso…). En ese rango no se pueden agendar citas. El bloqueo aparece en gris en el calendario; para quitarlo presiónelo y elija "Quitar bloqueo".' },
              { label: 'Presione una cita para ver su detalle', body: 'Se muestran paciente, horario, estado y notas. Si está "Agendada" también puede reprogramarla escribiendo la nueva fecha y hora en "Reprogramar" y presionando "Mover" (mismas reglas de traslape).' },
              { label: '"Registrar atención"', body: 'En el detalle de una cita agendada. Elija el cierre:', extra: (
                <Paper variant="outlined" sx={{ p: 1.5, my: 1, bgcolor: '#F5F7FA', borderRadius: 2 }}>
                  <Typography variant="caption" display="block" fontWeight={700}>Celebrada</Typography>
                  <Typography variant="caption" display="block">Requiere completar: Situación actual, Desarrollo, Plan de trabajo y Observaciones.</Typography>
                  <Typography variant="caption" display="block" fontWeight={700} mt={0.5}>Cancelada por paciente · Cancelada por terapeuta · Anulada</Typography>
                  <Typography variant="caption" display="block">Solo se piden las Observaciones (motivo).</Typography>
                </Paper>
              ) },
              { label: 'Colores', body: 'Azul = Agendada · Verde = Celebrada · Naranja = Cancelada · Gris = Anulada · Gris rayado = horario bloqueado.' },
            ]} />
            <P mt={1}>Sin licencia vigente los botones "Nueva cita" y "Bloquear horario" se deshabilitan.</P>
          </Section>

          <Section title="TERAPEUTA · Firma y sello">
            <MenuPath>Menú: Firma y Sello</MenuPath>
            <Steps steps={[
              { label: 'Presione "Seleccionar imagen"', body: 'Cualquier formato de imagen (JPG, PNG, etc.), aunque sea grande — se comprimirá sola a 280×84.' },
              { label: 'Revise la vista previa', body: 'Se muestran la original y el resultado sobre fondo cuadriculado.' },
              { label: '"Quitar fondo"', body: 'Viene activado: convierte el blanco/papel en transparente. Si queda residuo, suba la sensibilidad con el control deslizante; si la imagen ya viene transparente, desactívelo.' },
              { label: 'Presione "Guardar firma"', body: 'A partir de ahí, la firma con sello aparece montada sobre su nombre al final de los PDF de tamizaje y de la ficha del paciente.' },
            ]} />
          </Section>

          <Section title="TERAPEUTA · Avisos importantes">
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Este tamizaje es una herramienta de apoyo y NO constituye un diagnóstico. Requiere evaluación y criterio de un profesional de salud mental.
            </Alert>
            <P mt={1}>La alerta roja de riesgo (suicida u homicida) incluye las líneas de crisis configuradas por el administrador — actúe según su protocolo profesional.</P>
          </Section>
        </>
      )}

      <Section title="Cambiar contraseña y cerrar sesión">
        <ul style={{ margin: '4px 0', paddingLeft: 8 }}>
          <Li><b>Cambiar Contraseña:</b> opción en el menú lateral, abajo. Escriba la actual y la nueva (mínimo 8 caracteres).</Li>
          <Li><b>Cerrar Sesión:</b> última opción del menú, o el icono de salida en la barra superior.</Li>
          <Li><b>Panel Admin/Usuario:</b> si su usuario es ADMIN, en el menú inferior puede alternar entre el panel de administración y el panel de usuario para probar la vista de participante.</Li>
        </ul>
      </Section>
    </Box>
  );
}
