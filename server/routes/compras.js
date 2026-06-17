'use strict';

const express = require('express');
const { query } = require('../db');
const { UNIDADES } = require('./proveedores');

const router = express.Router();

/**
 * GET /api/compras
 * Lista todas las compras con el nombre del proveedor y el importe ya asignado,
 * ordenadas por fecha desc. Filtros opcionales: ?desde=&hasta=&proveedor_id=.
 */
router.get('/', async (req, res, next) => {
  try {
    const { desde, hasta, proveedor_id } = req.query;
    const where = [];
    const params = [];
    if (desde) {
      params.push(desde);
      where.push(`c.fecha >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      where.push(`c.fecha <= $${params.length}`);
    }
    if (proveedor_id) {
      params.push(proveedor_id);
      where.push(`c.proveedor_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT c.id, c.proveedor_id, p.nombre AS proveedor_nombre,
              c.fecha, c.concepto, c.cantidad_unidades,
              c.importe_total::float8 AS importe_total,
              c.nota, c.created_at,
              COALESCE(a.asignado, 0)::float8 AS importe_asignado,
              COALESCE(a.unidades, 0)::int    AS unidades_asignadas
       FROM compras_proveedor c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       LEFT JOIN (
         SELECT compra_id,
                SUM(importe_asignado) AS asignado,
                SUM(COALESCE(unidades_tomadas, 0)) AS unidades
         FROM asignaciones_compra GROUP BY compra_id
       ) a ON a.compra_id = c.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY c.fecha DESC, c.id DESC;`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/compras/:id — detalle de una compra con sus asignaciones.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.proveedor_id, p.nombre AS proveedor_nombre,
              c.fecha, c.concepto, c.cantidad_unidades,
              c.importe_total::float8 AS importe_total, c.nota, c.created_at
       FROM compras_proveedor c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       WHERE c.id = $1;`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Compra no encontrada.' });
    const compra = rows[0];
    const { rows: asignaciones } = await query(
      `SELECT a.id, a.compra_id, a.unidad, a.unidades_tomadas,
              a.importe_asignado::float8 AS importe_asignado, a.fecha, a.nota,
              a.cliente_id, dc.name AS cliente_nombre, a.created_at
       FROM asignaciones_compra a
       LEFT JOIN distribution_clients dc ON dc.id = a.cliente_id
       WHERE a.compra_id = $1
       ORDER BY a.fecha ASC, a.id ASC;`,
      [req.params.id]
    );
    res.json({ ...compra, asignaciones });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/compras — crea una compra.
 * Body: { proveedor_id, fecha, concepto, cantidad_unidades?, importe_total, nota? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { proveedor_id, fecha, concepto, cantidad_unidades, importe_total, nota } = req.body || {};
    if (!proveedor_id || !fecha || !concepto || importe_total === undefined || importe_total === null || importe_total === '') {
      return res.status(400).json({ error: 'Faltan campos: proveedor, fecha, concepto e importe total son obligatorios.' });
    }
    const importe = Number(importe_total);
    if (!Number.isFinite(importe) || importe < 0) {
      return res.status(400).json({ error: 'Importe total inválido.' });
    }
    const { rows } = await query(
      `INSERT INTO compras_proveedor (proveedor_id, fecha, concepto, cantidad_unidades, importe_total, nota)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [
        Number(proveedor_id),
        fecha,
        String(concepto).trim(),
        cantidad_unidades === '' || cantidad_unidades === undefined || cantidad_unidades === null ? null : Number(cantidad_unidades),
        importe,
        nota ? String(nota).trim() : null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/compras/:id — edita una compra.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { proveedor_id, fecha, concepto, cantidad_unidades, importe_total, nota } = req.body || {};
    const { rowCount } = await query(
      `UPDATE compras_proveedor
       SET proveedor_id = COALESCE($1, proveedor_id),
           fecha = COALESCE($2, fecha),
           concepto = COALESCE($3, concepto),
           cantidad_unidades = $4,
           importe_total = COALESCE($5, importe_total),
           nota = $6
       WHERE id = $7;`,
      [
        proveedor_id ? Number(proveedor_id) : null,
        fecha || null,
        concepto ? String(concepto).trim() : null,
        cantidad_unidades === '' || cantidad_unidades === undefined || cantidad_unidades === null ? null : Number(cantidad_unidades),
        importe_total === undefined || importe_total === null || importe_total === '' ? null : Number(importe_total),
        nota ?? null,
        req.params.id,
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Compra no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/compras/:id — elimina una compra.
 * Sus asignaciones se borran en cascada (ON DELETE CASCADE).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM compras_proveedor WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Compra no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/compras/:id/asignaciones — imputa parte de la compra a una unidad.
 * Body: { unidad, unidades_tomadas?, importe_asignado, fecha?, nota? }
 * Si no se pasa fecha, se usa la fecha de la compra.
 */
router.post('/:id/asignaciones', async (req, res, next) => {
  try {
    const { unidad, unidades_tomadas, importe_asignado, fecha, nota, cliente_id } = req.body || {};
    if (!unidad || !UNIDADES.includes(unidad)) {
      return res.status(400).json({ error: 'Unidad inválida. Debe ser megapolis, casco o distribucion.' });
    }
    if (importe_asignado === undefined || importe_asignado === null || importe_asignado === '') {
      return res.status(400).json({ error: 'El importe asignado es obligatorio.' });
    }
    const importe = Number(importe_asignado);
    if (!Number.isFinite(importe) || importe < 0) {
      return res.status(400).json({ error: 'Importe asignado inválido.' });
    }
    // En distribución es obligatorio imputar la compra a un cliente existente.
    if (unidad === 'distribucion' && !cliente_id) {
      return res.status(400).json({ error: 'Para distribución debes elegir un cliente de distribución.' });
    }

    // La compra debe existir; tomamos su fecha como default.
    const { rows: compraRows } = await query(
      'SELECT fecha FROM compras_proveedor WHERE id = $1',
      [req.params.id]
    );
    if (compraRows.length === 0) return res.status(404).json({ error: 'Compra no encontrada.' });

    const { rows } = await query(
      `INSERT INTO asignaciones_compra (compra_id, unidad, unidades_tomadas, importe_asignado, fecha, nota, cliente_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [
        Number(req.params.id),
        unidad,
        unidades_tomadas === '' || unidades_tomadas === undefined || unidades_tomadas === null ? null : Number(unidades_tomadas),
        importe,
        fecha || compraRows[0].fecha,
        nota ? String(nota).trim() : null,
        unidad === 'distribucion' && cliente_id ? Number(cliente_id) : null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
