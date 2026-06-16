'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');

const router = express.Router();

const TABLES = ['business_units', 'distribution_clients', 'expense_categories', 'sales', 'expenses'];

/**
 * Reúne todos los datos en un único objeto.
 */
async function dumpAll() {
  const dump = { exported_at: new Date().toISOString(), version: 1, data: {} };
  for (const t of TABLES) {
    const { rows } = await query(`SELECT * FROM ${t} ORDER BY id ASC;`);
    dump.data[t] = rows;
  }
  return dump;
}

/**
 * GET /api/data/export/json — descarga un backup completo en JSON.
 */
router.get('/export/json', async (req, res, next) => {
  try {
    const dump = await dumpAll();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mulata-backup-${stamp}.json"`);
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/data/export/csv — descarga ventas y gastos combinados en CSV.
 */
router.get('/export/csv', async (req, res, next) => {
  try {
    const { rows: sales } = await query(`
      SELECT 'venta' AS tipo, s.sale_date AS fecha, bu.name AS unidad,
             dc.name AS cliente, NULL AS categoria, s.amount AS importe,
             s.note AS nota, NULL AS proveedor
      FROM sales s
      JOIN business_units bu ON bu.id = s.business_unit_id
      LEFT JOIN distribution_clients dc ON dc.id = s.client_id;
    `);
    const { rows: expenses } = await query(`
      SELECT 'gasto' AS tipo, e.expense_date AS fecha,
             COALESCE(bu.name, 'Gastos Generales') AS unidad,
             NULL AS cliente, c.name AS categoria, e.amount AS importe,
             COALESCE(e.concept, e.note) AS nota, e.supplier AS proveedor
      FROM expenses e
      LEFT JOIN business_units bu ON bu.id = e.business_unit_id
      LEFT JOIN expense_categories c ON c.id = e.category_id;
    `);

    const all = [...sales, ...expenses].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const headers = ['tipo', 'fecha', 'unidad', 'cliente', 'categoria', 'importe', 'nota', 'proveedor'];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(',')];
    for (const row of all) lines.push(headers.map((h) => esc(row[h])).join(','));

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mulata-backup-${stamp}.csv"`);
    res.send('﻿' + lines.join('\n')); // BOM para acentos en Excel.
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/data/import — restaura desde un JSON exportado.
 * Body: { data: { tabla: [filas...] }, mode?: 'replace' | 'merge' }
 * Por seguridad, 'replace' (por defecto) vacía y reinserta todo dentro de una transacción.
 */
router.post('/import', async (req, res, next) => {
  try {
    const payload = req.body;
    const data = payload?.data;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Formato de backup inválido (falta "data").' });
    }
    const mode = payload.mode === 'merge' ? 'merge' : 'replace';

    await withTransaction(async (client) => {
      if (mode === 'replace') {
        // Orden inverso por dependencias de FK.
        await client.query('TRUNCATE sales, expenses, expense_categories, distribution_clients, business_units RESTART IDENTITY CASCADE;');
      }
      for (const table of TABLES) {
        const rows = data[table];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const vals = cols.map((c) => row[c]);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
             ON CONFLICT (id) DO NOTHING;`,
            vals
          );
        }
        // Resincroniza la secuencia del id tras insertar ids explícitos.
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
                  COALESCE((SELECT MAX(id) FROM ${table}), 1), true);`
        );
      }
    });

    res.json({ ok: true, mode });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, dumpAll };
