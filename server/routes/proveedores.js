'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// Unidades de negocio válidas para imputar gasto de proveedores.
const UNIDADES = ['megapolis', 'casco', 'distribucion'];

/**
 * GET /api/proveedores — lista los proveedores activos.
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre, activo, created_at
       FROM proveedores
       WHERE activo = true
       ORDER BY nombre ASC;`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/proveedores/resumen
 * Total de gasto imputado a cada unidad (megapolis, casco, distribucion) en el
 * periodo. Query params opcionales: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD.
 * Devuelve { desde, hasta, unidades: { megapolis, casco, distribucion }, total }.
 *
 * Importante: definir esta ruta ANTES de las rutas con :id no es necesario al
 * ser un GET sobre la lista, pero la dejamos arriba por claridad.
 */
router.get('/resumen', async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const where = [];
    const params = [];
    if (desde) {
      params.push(desde);
      where.push(`a.fecha >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      where.push(`a.fecha <= $${params.length}`);
    }
    const { rows } = await query(
      `SELECT a.unidad, COALESCE(SUM(a.importe_asignado), 0)::float8 AS total
       FROM asignaciones_compra a
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY a.unidad;`,
      params
    );

    const unidades = { megapolis: 0, casco: 0, distribucion: 0 };
    for (const r of rows) {
      if (unidades[r.unidad] !== undefined) unidades[r.unidad] = r.total;
    }
    const total = unidades.megapolis + unidades.casco + unidades.distribucion;
    res.json({ desde: desde || null, hasta: hasta || null, unidades, total });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/proveedores — crea un proveedor.
 * Body: { nombre }
 */
router.post('/', async (req, res, next) => {
  try {
    const nombre = (req.body?.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    const { rows } = await query(
      `INSERT INTO proveedores (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET activo = true
       RETURNING id;`,
      [nombre]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/proveedores/:id — edita nombre y/o activo.
 * Body: { nombre?, activo? }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { nombre, activo } = req.body || {};
    const { rowCount } = await query(
      `UPDATE proveedores
       SET nombre = COALESCE($1, nombre),
           activo = COALESCE($2, activo)
       WHERE id = $3;`,
      [nombre ? String(nombre).trim() : null, activo ?? null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/proveedores/:id — desactiva (soft delete, activo = false).
 * No se borra para conservar el histórico de compras asociadas.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE proveedores SET activo = false WHERE id = $1;`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, UNIDADES };
