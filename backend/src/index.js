require('dotenv').config();
process.env.TZ = process.env.TZ || 'America/Guatemala';
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

require('./db/migrate');

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

const authRoutes = require('./routes/auth');
const entityRoutes = require('./routes/entities');
const userRoutes = require('./routes/users');
const testRoutes = require('./routes/tests');
const licenseRoutes = require('./routes/licenses');
const eventRoutes = require('./routes/events');
const responseRoutes = require('./routes/responses');
const reportRoutes = require('./routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  next(new Error(`Ruta no encontrada: ${req.method} ${req.url}`));
});

app.use((err, req, res, next) => {
  console.error('=== ERROR ===', err.message);
  console.error(err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Error interno del servidor', error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 DEI Backend corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Acceso intranet: http://<TU_IP_LOCAL>:${PORT}\n`);
});
