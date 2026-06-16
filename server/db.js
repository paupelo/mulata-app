'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    '\n[Mulata] Falta la variable de entorno DATABASE_URL.\n' +
      'Configura tu PostgreSQL (ver .env.example) antes de arrancar.\n'
  );
}

// SSL obligatorio en producción / proveedores gestionados (Render).
// rejectUnauthorized:false es lo que Render recomienda para su certificado.
const useSsl = process.env.NODE_ENV === 'production' || /render\.com|amazonaws/.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[Mulata] Error inesperado en el pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta parametrizada contra el pool.
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Ejecuta una función dentro de una transacción, con commit/rollback automático.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
