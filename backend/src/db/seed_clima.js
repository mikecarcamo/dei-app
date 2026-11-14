require('dotenv').config();
const db = require('./database');

console.log('Insertando test Clima Laboral...');

const TEST_NAME = 'Encuesta de Clima Laboral';
const existing = db.prepare(`SELECT id FROM tests WHERE name = ?`).get(TEST_NAME);

let climaTestId;
if (!existing) {
  const result = db.prepare(`
    INSERT INTO tests (name, description, active, test_type) VALUES (?, ?, 1, 'CLIMA')
  `).run(
    TEST_NAME,
    'Encuesta anónima de clima laboral. Mide la percepción del personal en 11 factores: Satisfacción General, Compromiso, Motivación, Servicio al Usuario, Desarrollo Personal, Ambiente Físico, Comunicación, Trabajo en Equipo, Liderazgo, Compañerismo y Procedimientos Internos. Escala: 1=Totalmente en desacuerdo, 5=Totalmente de acuerdo.'
  );
  climaTestId = result.lastInsertRowid;
} else {
  climaTestId = existing.id;
  db.prepare(`UPDATE tests SET test_type = 'CLIMA' WHERE id = ?`).run(climaTestId);
}
console.log('Test Clima Laboral id:', climaTestId);

// section = factor del instrumento; is_external marca los indicadores
// externos que se clasifican como "Amenazas" (vs "Debilidades" internas)
const questions = [
  // SATISFACCIÓN GENERAL
  { number: 1,  section: 'SATISFACCION GENERAL', text: 'Estoy satisfecho/a con el trabajo que realizo.' },
  { number: 2,  section: 'SATISFACCION GENERAL', text: 'Se toman en cuenta las iniciativas y sugerencias personales y se nos da el crédito por ello.' },
  { number: 3,  section: 'SATISFACCION GENERAL', text: 'En mi área de trabajo se trabaja con paz laboral, sin intimidaciones ni amenazas.' },
  { number: 4,  section: 'SATISFACCION GENERAL', text: 'Me siento satisfecho/a con los beneficios que me otorga la empresa/institución.' },
  { number: 5,  section: 'SATISFACCION GENERAL', text: 'Me siento satisfecho/a de trabajar en la empresa.' },
  { number: 6,  section: 'SATISFACCION GENERAL', text: 'Existe equidad en la distribución del trabajo.' },
  // COMPROMISO LABORAL
  { number: 7,  section: 'COMPROMISO LABORAL', text: 'Mi trabajo contribuye al logro de los objetivos de la empresa.' },
  { number: 8,  section: 'COMPROMISO LABORAL', text: 'Tengo la justa libertad en la toma de decisiones en mi trabajo.' },
  { number: 9,  section: 'COMPROMISO LABORAL', text: 'Me siento comprometido/a con la visión y misión de la empresa.' },
  { number: 10, section: 'COMPROMISO LABORAL', text: 'En mi área de trabajo puedo ver el compromiso de mi jefe y compañeros hacia el logro de objetivos.' },
  { number: 11, section: 'COMPROMISO LABORAL', text: 'Existe apoyo por parte de mis compañeros cuando hay necesidad de trabajar tiempo extra.' },
  // MOTIVACIÓN LABORAL
  { number: 12, section: 'MOTIVACION LABORAL', text: 'Actualmente aprovecho mis habilidades en el trabajo.' },
  { number: 13, section: 'MOTIVACION LABORAL', text: 'El trabajo que realizo es valorado por mi jefe.' },
  { number: 14, section: 'MOTIVACION LABORAL', text: 'Mis compañeros realizan su trabajo no solo por su salario, sino con iniciativa propia.' },
  { number: 15, section: 'MOTIVACION LABORAL', text: 'Trabajando en la empresa creo que puedo lograr mis objetivos personales.' },
  { number: 16, section: 'MOTIVACION LABORAL', text: 'Me siento estimulado/a para aportar nuevas y mejores formas de realizar mi trabajo.' },
  { number: 17, section: 'MOTIVACION LABORAL', text: 'Prefiero laborar en mi área de trabajo que trasladarme a otra con igual remuneración.' },
  // SERVICIO AL USUARIO
  { number: 18, section: 'SERVICIO AL USUARIO', text: 'Mis compañeros buscan dar solución inmediata a las necesidades de los usuarios.' },
  { number: 19, section: 'SERVICIO AL USUARIO', text: 'En nuestra área de trabajo existe una cultura enfocada a prestar un buen servicio.' },
  { number: 20, section: 'SERVICIO AL USUARIO', text: 'Mis compañeros muestran un trato amable y cortés con los usuarios.' },
  // DESARROLLO PERSONAL
  { number: 21, section: 'DESARROLLO PERSONAL', text: 'En mi área de trabajo, cuando existe una plaza vacante, la primera opción es promover al personal interno.' },
  { number: 22, section: 'DESARROLLO PERSONAL', text: 'Existen oportunidades dentro de la empresa para desarrollarme laboralmente.', external: 1 },
  { number: 23, section: 'DESARROLLO PERSONAL', text: 'El personal que sobresale laboralmente es identificado y apoyado para su superación.' },
  { number: 24, section: 'DESARROLLO PERSONAL', text: 'Los cursos de capacitación durante el último año han mejorado mis conocimientos y habilidades en el puesto que desempeño.', external: 1 },
  { number: 25, section: 'DESARROLLO PERSONAL', text: 'La empresa se ocupa por investigar las necesidades de capacitación en nuestra área de trabajo.', external: 1 },
  // AMBIENTE FÍSICO
  { number: 26, section: 'AMBIENTE FISICO', text: 'En mi trabajo la limpieza y el orden es satisfactorio.', external: 1 },
  { number: 27, section: 'AMBIENTE FISICO', text: 'Considero que la distribución física de mi área me permite realizar mi trabajo cómoda y eficientemente.', external: 1 },
  { number: 28, section: 'AMBIENTE FISICO', text: 'Cuando requiero de algún equipo o material para realizar mis labores, me lo proporcionan lo más pronto posible.', external: 1 },
  { number: 29, section: 'AMBIENTE FISICO', text: 'En mi lugar de trabajo la temperatura ambiente es adecuada.', external: 1 },
  { number: 30, section: 'AMBIENTE FISICO', text: 'La posibilidad de que en mi área de trabajo exista una amenaza de desastre es mínima.', external: 1 },
  // COMUNICACIÓN
  { number: 31, section: 'COMUNICACION', text: 'Mi jefe se reúne regularmente con el personal para tratar puntos de interés común.' },
  { number: 32, section: 'COMUNICACION', text: 'Mi jefe me presta atención cuando me dirijo a él.' },
  { number: 33, section: 'COMUNICACION', text: 'La información de interés común llega de manera oportuna y clara.' },
  { number: 34, section: 'COMUNICACION', text: 'Las instrucciones que recibo por parte de mis jefes son afines y en la misma línea.' },
  { number: 35, section: 'COMUNICACION', text: 'En mi área de trabajo se toman en cuenta las opiniones de mis compañeros.' },
  { number: 36, section: 'COMUNICACION', text: 'Mi jefe es una persona con la que se puede hablar respetuosa y abiertamente.' },
  // TRABAJO EN EQUIPO
  { number: 37, section: 'TRABAJO EN EQUIPO', text: 'Existe sana competencia entre mis compañeros de trabajo.' },
  { number: 38, section: 'TRABAJO EN EQUIPO', text: 'Existe ayuda y cooperación entre mis compañeros de trabajo.' },
  { number: 39, section: 'TRABAJO EN EQUIPO', text: 'En mi área de trabajo, se me instruye sobre la forma correcta de hacer el trabajo.' },
  { number: 40, section: 'TRABAJO EN EQUIPO', text: 'Mi jefe y mis compañeros trabajan en equipo.' },
  { number: 41, section: 'TRABAJO EN EQUIPO', text: 'Con mis compañeros de trabajo compartimos logros y fracasos.' },
  { number: 42, section: 'TRABAJO EN EQUIPO', text: 'En mi área de trabajo tenemos metas en común que tratamos de alcanzar en forma coordinada.' },
  { number: 43, section: 'TRABAJO EN EQUIPO', text: 'En mi área de trabajo compartimos los conocimientos y la información abiertamente.' },
  // LIDERAZGO
  { number: 44, section: 'LIDERAZGO', text: 'Mi jefe está disponible cuando se le necesita.' },
  { number: 45, section: 'LIDERAZGO', text: 'En mi área de trabajo, mi jefe resuelve los conflictos de relaciones interpersonales adecuadamente.' },
  { number: 46, section: 'LIDERAZGO', text: 'Mi jefe se ocupa por crear y mantener un ambiente laboral agradable.' },
  { number: 47, section: 'LIDERAZGO', text: 'Tengo un trato amable por parte de mi jefe.' },
  { number: 48, section: 'LIDERAZGO', text: 'Mi jefe demuestra tener interés en mí, como persona.' },
  { number: 49, section: 'LIDERAZGO', text: 'Mi jefe vela para que en el ambiente laboral exista unidad, evitando con esto las preferencias.' },
  { number: 50, section: 'LIDERAZGO', text: 'Cuando lo amerita, mi jefe me corrige con respeto, en privado e individualmente.' },
  { number: 51, section: 'LIDERAZGO', text: 'Mi jefe reconoce los logros laborales de cada uno de mis compañeros.' },
  { number: 52, section: 'LIDERAZGO', text: 'Mi jefe reconoce los logros del equipo de trabajo.' },
  // COMPAÑERISMO
  { number: 53, section: 'COMPAÑERISMO', text: 'Existe respeto mutuo entre mis compañeros.' },
  { number: 54, section: 'COMPAÑERISMO', text: 'Mis compañeros de trabajo se interesan y me apoyan en mis problemas laborales y personales.' },
  { number: 55, section: 'COMPAÑERISMO', text: 'En mi área de trabajo celebramos los cumpleaños y se organiza convivio de fin de año para compartir amigablemente.' },
  { number: 56, section: 'COMPAÑERISMO', text: 'Existe respeto mutuo entre mi jefe y yo.' },
  { number: 57, section: 'COMPAÑERISMO', text: 'La buena relación laboral con mis compañeros me permite realizar un mejor trabajo.' },
  // PROCEDIMIENTOS INTERNOS
  { number: 58, section: 'PROCEDIMIENTOS INTERNOS', text: 'Existen formas o métodos internos de evaluar el trabajo que realizo.' },
  { number: 59, section: 'PROCEDIMIENTOS INTERNOS', text: 'Conozco las tareas y funciones específicas que debo realizar.' },
  { number: 60, section: 'PROCEDIMIENTOS INTERNOS', text: 'Las tareas que desempeño corresponden a mi puesto de trabajo.' },
  { number: 61, section: 'PROCEDIMIENTOS INTERNOS', text: 'En mi área de trabajo los procesos y procedimientos a seguir se encuentran bien definidos.' },
];

const count = db.prepare(`SELECT COUNT(*) AS c FROM questions WHERE test_id = ?`).get(climaTestId).c;
if (count === 0) {
  const insertQ = db.prepare(`INSERT INTO questions (test_id, number, section, text, active, is_external) VALUES (?, ?, ?, ?, 1, ?)`);
  for (const q of questions) {
    insertQ.run(climaTestId, q.number, q.section, q.text, q.external || 0);
  }
  console.log(`${questions.length} preguntas de Clima Laboral insertadas.`);
} else {
  console.log(`Clima Laboral ya tiene ${count} preguntas, omitiendo.`);
}
