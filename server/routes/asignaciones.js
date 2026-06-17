'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * DELETE /api/asignaciones/:id — elimina una asignación (imputación a unidad).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM asignaciones_compra WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Asignación no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
