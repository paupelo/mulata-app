'use strict';

const express = require('express');
const { query } = require('../db');
const { insertSale } = require('../repository');

const router = express.Router();

/**
 * GET /api/sales
 * Filtros opcionales: unit (code de unidad), from, to (YYYY-MM-DD), client_id.
 */
router.get('/', async (req, res, next) => {
  try {
    const { unit, from, to, client_id } = req.query;
    const where = [];
    const params = [];

    if (unit) {
      params.push(unit);
      where.push(`bu.code = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`s.sale_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`s.sale_date <= $${params.length}`);
    }
    if (client_id) {
      params.push(client_id);
      where.push(`s.client_id = $${params.length}`);
    }

    const sql = `
      SELECT s.id, s.business_unit_id, bu.code AS unit_code, bu.name AS unit_name,
             s.client_id, dc.name AS client_name,
             s.sale_date, s.amount::float8 AS amount, s.note, s.created_at
      FROM sales s
      JOIN business_units bu ON bu.id = s.business_unit_id
      LEFT JOIN distribution_clients dc ON dc.id = s.client_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY s.sale_date DESC, s.id DESC;
    `;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sales — crea una venta.
 * Body: { unit_code | business_unit_id, sale_date, amount, note?, client_id? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { sale_date, amount, note, client_id } = req.body || {};
    const unitId = await resolveUnitId(req.body);

    if (!unitId || !sale_date || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ error: 'Faltan campos: unidad, fecha e importe son obligatorios.' });
    }

    const id = await insertSale({
      business_unit_id: unitId,
      client_id: client_id || null,
      sale_date,
      amount,
      note: note || null,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/sales/:id — edita una venta.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { sale_date, amount, note, client_id } = req.body || {};
    const unitId = await resolveUnitId(req.body);
    const { rowCount } = await query(
      `UPDATE sales
       SET business_unit_id = COALESCE($1, business_unit_id),
           client_id = $2,
           sale_date = COALESCE($3, sale_date),
           amount = COALESCE($4, amount),
           note = $5
       WHERE id = $6;`,
      [unitId, client_id || null, sale_date || null, amount ?? null, note ?? null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Venta no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/sales/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM sales WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Venta no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Resuelve el id de unidad a partir de business_unit_id o unit_code del body.
 */
async function resolveUnitId(body = {}) {
  if (body.business_unit_id) return Number(body.business_unit_id);
  if (body.unit_code) {
    const { rows } = await query('SELECT id FROM business_units WHERE code = $1', [body.unit_code]);
    return rows[0]?.id || null;
  }
  return null;
}

module.exports = router;
