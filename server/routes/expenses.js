'use strict';

const express = require('express');
const { query } = require('../db');
const { insertExpense } = require('../repository');
const { expenseKey, loadExpenseKeys } = require('../dedupe');

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

    const id = await insertExpense({
      business_unit_id: unitId,
      category_id: category_id || null,
      expense_date,
      amount,
      concept: concept || null,
      supplier: supplier || null,
      kind: kind || (unitId ? 'extraordinario' : 'general'),
      note: note || null,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/expenses/bulk — entrada rápida de varios gastos a la vez.
 * Body: { rows: [{ unit_code?|business_unit_id?, category_id?, expense_date, amount,
 *                  concept?, supplier?, kind?, note? }, ...] }
 * Sin unidad => gasto general (kind 'general'). Reutiliza insertExpense y el
 * mismo anti-duplicados que el importador (fecha+unidad+importe+concepto).
 * Devuelve { inserted, skipped, empty, errors:[{index,reason}] }.
 */
router.post('/bulk', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No hay filas para guardar.' });
    }

    const existing = await loadExpenseKeys();
    let inserted = 0;
    let skipped = 0;
    let empty = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      try {
        if (r.amount === '' || r.amount === null || r.amount === undefined) {
          empty += 1;
          continue;
        }
        const amount = Number(r.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          errors.push({ index: i, reason: 'Importe inválido.' });
          continue;
        }
        if (!r.expense_date) {
          errors.push({ index: i, reason: 'Falta la fecha.' });
          continue;
        }
        const unitId = await resolveUnitId(r);
        const concept = r.concept ? String(r.concept).trim() : null;

        const key = expenseKey({ expense_date: r.expense_date, business_unit_id: unitId, amount, concept });
        if (existing.has(key)) {
          skipped += 1;
          continue;
        }
        await insertExpense({
          business_unit_id: unitId,
          category_id: r.category_id ? Number(r.category_id) : null,
          expense_date: r.expense_date,
          amount,
          concept,
          supplier: r.supplier ? String(r.supplier).trim() : null,
          kind: r.kind || (unitId ? 'extraordinario' : 'general'),
          note: r.note ? String(r.note).trim() : null,
        });
        existing.add(key);
        inserted += 1;
      } catch (e) {
        errors.push({ index: i, reason: e.message || 'Error al guardar la fila.' });
      }
    }

    res.json({ ok: true, inserted, skipped, empty, errors });
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
