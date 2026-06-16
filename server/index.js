'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const { migrate } = require('./migrate');
const { router: authRouter, requireAuth } = require('./auth');
const salesRouter = require('./routes/sales');
const expensesRouter = require('./routes/expenses');
const categoriesRouter = require('./routes/categories');
const clientsRouter = require('./routes/clients');
const analyticsRouter = require('./routes/analytics');
const { router: dataRouter } = require('./routes/data');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' })); // 25mb para permitir importaciones grandes.

// Salud (usada por el health check de Render).
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Autenticación (pública).
app.use('/api/auth', authRouter);

// El resto de la API está protegida por JWT.
app.use('/api/sales', requireAuth, salesRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/categories', requireAuth, categoriesRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/analytics', requireAuth, analyticsRouter);
app.use('/api/data', requireAuth, dataRouter);
app.use('/api/import', requireAuth, importRouter);

// Unidades de negocio (lista fija; útil para los selectores del cliente).
const { query } = require('./db');
app.get('/api/business-units', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, code, name FROM business_units ORDER BY id;');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// En producción servimos el build de React.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: cualquier ruta no-API devuelve index.html.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Manejador de errores centralizado.
app.use((err, req, res, next) => {
  console.error('[Mulata] Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

/**
 * Arranca el servidor tras ejecutar las migraciones idempotentes.
 */
async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error('[Mulata] No se pudo migrar la base de datos:', err.message);
    // Seguimos arrancando para no dejar la app caída; las rutas devolverán error si la BD falla.
  }
  app.listen(PORT, () => {
    console.log(`[Mulata] Servidor escuchando en el puerto ${PORT}`);
  });
}

start();
