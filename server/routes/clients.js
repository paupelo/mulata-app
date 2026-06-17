'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * GET /api/clients — lista de clientes de distribución (boutiques).
 * Incluye el total facturado a cada cliente para mostrarlo en la lista.
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT dc.id, dc.name, dc.contact, dc.active, dc.created_at,
             COALESCE(SUM(s.amount), 0)::float8 AS total_billed
      FROM distribution_clients dc
      LEFT JOIN sales s ON s.client_id = dc.id
      GROUP BY dc.id
      ORDER BY total_billed DESC, dc.name ASC;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/clients — crea una boutique cliente.
 * Body: { name, contact? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, contact } = req.body || {};
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    const { rows } = await query(
      `INSERT INTO distribution_clients (name, contact) VALUES ($1, $2) RETURNING id;`,
      [name, contact || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/clients/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, contact, active } = req.body || {};
    const { rowCount } = await query(
      `UPDATE distribution_clients
       SET name = COALESCE($1, name), contact = $2, active = COALESCE($3, active)
       WHERE id = $4;`,
      [name || null, contact ?? null, active ?? null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/clients/:id — sus ventas quedan con client_id NULL (no se borran).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM distribution_clients WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
