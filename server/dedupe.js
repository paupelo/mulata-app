'use strict';

// Lógica de anti-duplicados compartida por el importador de Excel y por la
// entrada rápida masiva (sales/bulk, expenses/bulk). Una sola definición de la
// "clave" de un registro para que todos detecten los duplicados igual.

const { query } = require('./db');

/** Normaliza texto: sin acentos, sin espacios sobrantes, minúsculas. */
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Importe canónico a 2 decimales. */
function amt(n) {
  return Number(n).toFixed(2);
}

/** Solo la parte de fecha 'YYYY-MM-DD' (acepta también timestamps ISO). */
function datePart(d) {
  return String(d).slice(0, 10);
}

/** Clave de una venta: fecha + unidad + cliente + importe. */
function saleKey({ sale_date, business_unit_id, client_id, amount }) {
  return `${datePart(sale_date)}|${business_unit_id}|${client_id ?? ''}|${amt(amount)}`;
}

/** Clave de un gasto: fecha + unidad + importe + concepto (normalizado). */
function expenseKey({ expense_date, business_unit_id, amount, concept }) {
  return `${datePart(expense_date)}|${business_unit_id ?? ''}|${amt(amount)}|${norm(concept)}`;
}

/** Carga en un Set las claves de todas las ventas existentes. */
async function loadSaleKeys(exec = query) {
  const { rows } = await exec(
    `SELECT to_char(sale_date,'YYYY-MM-DD') AS sale_date, business_unit_id, client_id, amount::float8 AS amount FROM sales;`
  );
  const set = new Set();
  for (const r of rows) set.add(saleKey(r));
  return set;
}

/** Carga en un Set las claves de todos los gastos existentes. */
async function loadExpenseKeys(exec = query) {
  const { rows } = await exec(
    `SELECT to_char(expense_date,'YYYY-MM-DD') AS expense_date, business_unit_id, amount::float8 AS amount, concept FROM expenses;`
  );
  const set = new Set();
  for (const r of rows) set.add(expenseKey(r));
  return set;
}

module.exports = { norm, amt, datePart, saleKey, expenseKey, loadSaleKeys, loadExpenseKeys };
