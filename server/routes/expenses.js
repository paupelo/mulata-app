'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * GET /api/expenses
 * Filtros: unit (code), general=true (gastos sin unidad), from, to, kind, category_id.
 */
router.get('/', async (req, res, next) => {
  try {
    const { unit, general, from, to, kind, category_id } = req.query;
    const where = [];
    const params = [];

    if (general === 'true') {
      where.push('e.business_unit_id IS NULL');
    } else if (unit) {
      params.push(unit);
      where.push(`bu.code = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`e.expense_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`e.expense_date <= $${params.length}`);
    }
    if (kind) {
      params.push(kind);
      where.push(`e.kind = $${params.length}`);
    }
    if (category_id) {
      params.push(category_id);
      where.push(`e.category_id = $${params.length}`);
    }

    const sql = `
      SELECT e.id, e.business_unit_id, bu.code AS unit_code, bu.name AS unit_name,
             e.category_id, c.name AS category_name,
             e.expense_date, e.amount::float8 AS amount, e.concept, e.supplier,
             e.kind, e.note, e.created_at
      FROM expenses e
      LEFT JOIN business_units bu ON bu.id = e.business_unit_id
      LEFT JOIN expense_categories c ON c.id = e.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.expense_date DESC, e.id DESC;
    `;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/expenses — crea un gasto.
 * Body: { unit_code?|business_unit_id?, category_id?, expense_date, amount,
 *         concept?, supplier?, kind, note? }
 * Si no se pasa unidad, el gasto se considera General/Común (business_unit_id NULL).
 */
router.post('/', async (req, res, next) => {
  try {
    const { category_id, expense_date, amount, concept, supplier, kind, note } = req.body || {};
    const unitId = await resolveUnitId(req.body);

    if (!expense_date || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ error: 'Faltan campos: fecha e importe son obligatorios.' });
    }

    const { rows } = await query(
      `INSERT INTO expenses (business_unit_id, category_id, expense_date, amount, concept, supplier, kind, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`,
      [
        unitId,
        category_id || null,
        expense_date,
        amount,
        concept || null,
        supplier || null,
        kind || (unitId ? 'extraordinario' : 'general'),
        note || null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/expenses/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { category_id, expense_date, amount, concept, supplier, kind, note } = req.body || {};
    const unitId = await resolveUnitId(req.body);
    const { rowCount } = await query(
      `UPDATE expenses
       SET business_unit_id = $1,
           category_id = $2,
           expense_date = COALESCE($3, expense_date),
           amount = COALESCE($4, amount),
           concept = $5,
           supplier = $6,
           kind = COALESCE($7, kind),
           note = $8
       WHERE id = $9;`,
      [
        unitId,
        category_id || null,
        expense_date || null,
        amount ?? null,
        concept ?? null,
        supplier ?? null,
        kind || null,
        note ?? null,
        req.params.id,
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Gasto no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/expenses/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Gasto no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function resolveUnitId(body = {}) {
  if (body.business_unit_id) return Number(body.business_unit_id);
  if (body.unit_code) {
    const { rows } = await query('SELECT id FROM business_units WHERE code = $1', [body.unit_code]);
    return rows[0]?.id || null;
  }
  return null;
}

module.exports = router;
