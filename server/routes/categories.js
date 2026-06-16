'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * GET /api/categories
 * Filtros: unit (code), general=true. Devuelve conceptos de gasto.
 */
router.get('/', async (req, res, next) => {
  try {
    const { unit, general } = req.query;
    const where = [];
    const params = [];

    if (general === 'true') {
      where.push('c.business_unit_id IS NULL');
    } else if (unit) {
      params.push(unit);
      where.push(`bu.code = $${params.length}`);
    }

    const sql = `
      SELECT c.id, c.name, c.business_unit_id, bu.code AS unit_code,
             c.kind, c.is_default
      FROM expense_categories c
      LEFT JOIN business_units bu ON bu.id = c.business_unit_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.name ASC;
    `;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/categories — crea un concepto de gasto personalizado.
 * Body: { name, unit_code?|business_unit_id?, kind: 'fijo'|'extraordinario'|'general' }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, kind } = req.body || {};
    const unitId = await resolveUnitId(req.body);
    if (!name || !kind) {
      return res.status(400).json({ error: 'Nombre y tipo son obligatorios.' });
    }
    const { rows } = await query(
      `INSERT INTO expense_categories (name, business_unit_id, kind, is_default)
       VALUES ($1, $2, $3, FALSE) RETURNING id;`,
      [name, unitId, kind]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/categories/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, kind } = req.body || {};
    const { rowCount } = await query(
      `UPDATE expense_categories
       SET name = COALESCE($1, name), kind = COALESCE($2, kind)
       WHERE id = $3;`,
      [name || null, kind || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Concepto no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/categories/:id — no permite borrar conceptos por defecto.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT is_default FROM expense_categories WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Concepto no encontrado.' });
    if (rows[0].is_default) {
      return res.status(400).json({ error: 'No se pueden borrar los conceptos predefinidos.' });
    }
    await query('DELETE FROM expense_categories WHERE id = $1', [req.params.id]);
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
