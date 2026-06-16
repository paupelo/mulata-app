'use strict';

// Capa de acceso a datos compartida: una ÚNICA vía de inserción para ventas,
// gastos y clientes, usada tanto por los endpoints de entrada manual
// (routes/sales, routes/expenses, routes/clients) como por el importador de
// Excel (routes/import). Así no se duplica la lógica de inserción.
//
// Todas las funciones aceptan un ejecutor opcional `exec(text, params)` que por
// defecto es el `query` del pool, pero puede ser un `client.query` para correr
// dentro de una transacción.

const { query } = require('./db');

/**
 * Resuelve el id de una unidad de negocio a partir de su `code`
 * (megapolis, casco, distribucion).
 */
async function resolveUnitIdByCode(code, exec = query) {
  if (!code) return null;
  const { rows } = await exec('SELECT id FROM business_units WHERE code = $1', [code]);
  return rows[0]?.id || null;
}

/**
 * Inserta una venta. Misma sentencia que usa la entrada manual.
 * @returns {Promise<number>} id de la venta creada.
 */
async function insertSale(
  { business_unit_id, client_id = null, sale_date, amount, note = null },
  exec = query
) {
  const { rows } = await exec(
    `INSERT INTO sales (business_unit_id, client_id, sale_date, amount, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
    [business_unit_id, client_id, sale_date, amount, note]
  );
  return rows[0].id;
}

/**
 * Inserta un gasto. Misma sentencia que usa la entrada manual.
 * @returns {Promise<number>} id del gasto creado.
 */
async function insertExpense(
  {
    business_unit_id = null,
    category_id = null,
    expense_date,
    amount,
    concept = null,
    supplier = null,
    kind,
    note = null,
  },
  exec = query
) {
  const { rows } = await exec(
    `INSERT INTO expenses (business_unit_id, category_id, expense_date, amount, concept, supplier, kind, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`,
    [business_unit_id, category_id, expense_date, amount, concept, supplier, kind, note]
  );
  return rows[0].id;
}

/**
 * Busca un cliente de distribución por nombre (sin distinguir mayúsculas) y, si
 * no existe, lo crea. Devuelve { id, created }.
 */
async function findOrCreateClient(name, exec = query) {
  const trimmed = String(name == null ? '' : name).trim();
  if (!trimmed) throw new Error('Nombre de cliente vacío.');
  const existing = await exec(
    'SELECT id FROM distribution_clients WHERE LOWER(name) = LOWER($1) ORDER BY id ASC LIMIT 1',
    [trimmed]
  );
  if (existing.rows.length > 0) return { id: existing.rows[0].id, created: false };
  const { rows } = await exec(
    'INSERT INTO distribution_clients (name, contact) VALUES ($1, $2) RETURNING id;',
    [trimmed, null]
  );
  return { id: rows[0].id, created: true };
}

module.exports = {
  resolveUnitIdByCode,
  insertSale,
  insertExpense,
  findOrCreateClient,
};
