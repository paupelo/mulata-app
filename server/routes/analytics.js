'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * Decide la granularidad de agrupación temporal según la longitud del rango.
 * <= 62 días: por día. <= 366 días: por semana. más: por mes.
 */
function pickGranularity(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const days = Math.round((b - a) / 86400000) + 1;
  if (days <= 62) return 'day';
  if (days <= 366) return 'week';
  return 'month';
}

/**
 * Devuelve {from, to} resolviendo defaults (mes actual si no llegan).
 */
function resolveRange(q) {
  let { from, to } = q;
  if (!from || !to) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    from = from || first.toISOString().slice(0, 10);
    to = to || last.toISOString().slice(0, 10);
  }
  return { from, to };
}

/**
 * Calcula el rango inmediatamente anterior de igual longitud (para variaciones).
 */
function previousRange(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const len = Math.round((b - a) / 86400000) + 1;
  const prevTo = new Date(a);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (len - 1));
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

/** Suma de ventas en un rango, opcionalmente filtrada por unidad. */
async function sumSales(from, to, unitCode) {
  const params = [from, to];
  let unitFilter = '';
  if (unitCode) {
    params.push(unitCode);
    unitFilter = `AND bu.code = $3`;
  }
  const { rows } = await query(
    `SELECT COALESCE(SUM(s.amount),0)::float8 AS total
     FROM sales s JOIN business_units bu ON bu.id = s.business_unit_id
     WHERE s.sale_date BETWEEN $1 AND $2 ${unitFilter};`,
    params
  );
  return rows[0].total;
}

/**
 * Suma de gastos en un rango.
 * scope: 'all' (todo), 'units' (solo con unidad), 'general' (solo sin unidad),
 * o un code de unidad concreto.
 */
async function sumExpenses(from, to, scope) {
  const params = [from, to];
  let filter = '';
  if (scope === 'general') {
    filter = 'AND e.business_unit_id IS NULL';
  } else if (scope === 'units') {
    filter = 'AND e.business_unit_id IS NOT NULL';
  } else if (scope && scope !== 'all') {
    params.push(scope);
    filter = `AND bu.code = $3`;
  }
  const { rows } = await query(
    `SELECT COALESCE(SUM(e.amount),0)::float8 AS total
     FROM expenses e LEFT JOIN business_units bu ON bu.id = e.business_unit_id
     WHERE e.expense_date BETWEEN $1 AND $2 ${filter};`,
    params
  );
  return rows[0].total;
}

function pct(n) {
  return Math.round(n * 10) / 10;
}
function variation(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return pct(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * GET /api/analytics/summary
 * KPIs del periodo + variación vs periodo anterior.
 * Filtro opcional: unit (code). Si no, es global (resta gastos generales).
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query);
    const unit = req.query.unit || null;
    const prev = previousRange(from, to);

    const sales = await sumSales(from, to, unit);
    const prevSales = await sumSales(prev.from, prev.to, unit);

    // Gastos: si hay unidad, solo esa unidad. Si es global, gastos de unidades + generales.
    let expenses;
    let prevExpenses;
    if (unit) {
      expenses = await sumExpenses(from, to, unit);
      prevExpenses = await sumExpenses(prev.from, prev.to, unit);
    } else {
      const units = await sumExpenses(from, to, 'units');
      const general = await sumExpenses(from, to, 'general');
      expenses = units + general;
      const pUnits = await sumExpenses(prev.from, prev.to, 'units');
      const pGeneral = await sumExpenses(prev.from, prev.to, 'general');
      prevExpenses = pUnits + pGeneral;
    }

    const profit = sales - expenses;
    const prevProfit = prevSales - prevExpenses;
    const margin = sales > 0 ? pct((profit / sales) * 100) : 0;
    const prevMargin = prevSales > 0 ? pct((prevProfit / prevSales) * 100) : 0;

    res.json({
      range: { from, to },
      previousRange: prev,
      sales: { value: sales, variation: variation(sales, prevSales) },
      expenses: { value: expenses, variation: variation(expenses, prevExpenses) },
      profit: { value: profit, variation: variation(profit, prevProfit) },
      margin: { value: margin, variationPoints: pct(margin - prevMargin) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/sales-trend
 * Serie temporal de ventas agrupada por día/semana/mes (auto).
 * Filtro opcional: unit (code).
 */
router.get('/sales-trend', async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query);
    const unit = req.query.unit || null;
    const grain = pickGranularity(from, to);
    const params = [from, to];
    let unitFilter = '';
    if (unit) {
      params.push(unit);
      unitFilter = `AND bu.code = $3`;
    }
    const { rows } = await query(
      `SELECT to_char(date_trunc('${grain}', s.sale_date), 'YYYY-MM-DD') AS bucket,
              COALESCE(SUM(s.amount),0)::float8 AS sales
       FROM sales s JOIN business_units bu ON bu.id = s.business_unit_id
       WHERE s.sale_date BETWEEN $1 AND $2 ${unitFilter}
       GROUP BY 1 ORDER BY 1;`,
      params
    );
    res.json({ granularity: grain, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/profit-trend
 * Beneficio (ventas - gastos) por bucket temporal y por unidad.
 * Devuelve filas con { bucket, megapolis, casco, distribucion, general, global }.
 */
router.get('/profit-trend', async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query);
    const grain = pickGranularity(from, to);

    const salesQ = await query(
      `SELECT to_char(date_trunc('${grain}', s.sale_date), 'YYYY-MM-DD') AS bucket,
              bu.code AS unit, COALESCE(SUM(s.amount),0)::float8 AS amount
       FROM sales s JOIN business_units bu ON bu.id = s.business_unit_id
       WHERE s.sale_date BETWEEN $1 AND $2
       GROUP BY 1,2;`,
      [from, to]
    );
    const expQ = await query(
      `SELECT to_char(date_trunc('${grain}', e.expense_date), 'YYYY-MM-DD') AS bucket,
              COALESCE(bu.code, 'general') AS unit, COALESCE(SUM(e.amount),0)::float8 AS amount
       FROM expenses e LEFT JOIN business_units bu ON bu.id = e.business_unit_id
       WHERE e.expense_date BETWEEN $1 AND $2
       GROUP BY 1,2;`,
      [from, to]
    );

    const buckets = {};
    const ensure = (b) => {
      if (!buckets[b]) {
        buckets[b] = { bucket: b, megapolis: 0, casco: 0, distribucion: 0, general: 0 };
      }
      return buckets[b];
    };
    for (const r of salesQ.rows) ensure(r.bucket)[r.unit] += r.amount;
    for (const r of expQ.rows) ensure(r.bucket)[r.unit] -= r.amount;

    const data = Object.values(buckets)
      .map((b) => ({
        ...b,
        // beneficio global = beneficios de unidades + (gastos generales ya restados como negativo)
        global: b.megapolis + b.casco + b.distribucion + b.general,
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    res.json({ granularity: grain, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/margin-trend
 * Margen % global por bucket temporal.
 */
router.get('/margin-trend', async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query);
    const grain = pickGranularity(from, to);

    const salesQ = await query(
      `SELECT to_char(date_trunc('${grain}', s.sale_date), 'YYYY-MM-DD') AS bucket,
              COALESCE(SUM(s.amount),0)::float8 AS amount
       FROM sales s WHERE s.sale_date BETWEEN $1 AND $2 GROUP BY 1;`,
      [from, to]
    );
    const expQ = await query(
      `SELECT to_char(date_trunc('${grain}', e.expense_date), 'YYYY-MM-DD') AS bucket,
              COALESCE(SUM(e.amount),0)::float8 AS amount
       FROM expenses e WHERE e.expense_date BETWEEN $1 AND $2 GROUP BY 1;`,
      [from, to]
    );

    const map = {};
    for (const r of salesQ.rows) map[r.bucket] = { bucket: r.bucket, sales: r.amount, expenses: 0 };
    for (const r of expQ.rows) {
      if (!map[r.bucket]) map[r.bucket] = { bucket: r.bucket, sales: 0, expenses: 0 };
      map[r.bucket].expenses = r.amount;
    }
    const data = Object.values(map)
      .map((d) => ({
        bucket: d.bucket,
        margin: d.sales > 0 ? pct(((d.sales - d.expenses) / d.sales) * 100) : 0,
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    res.json({ granularity: grain, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/unit-comparison
 * Ventas, gastos y beneficio de cada una de las 3 unidades en el rango.
 */
router.get('/unit-comparison', async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query);
    const { rows: units } = await query(`SELECT code, name FROM business_units ORDER BY id;`);

    const result = [];
    for (const u of units) {
      const sales = await sumSales(from, to, u.code);
      const expenses = await sumExpenses(from, to, u.code);
      result.push({
        unit: u.code,
        name: u.name,
        sales,
        expenses,
        profit: sales - expenses,
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/expense-breakdown
 * Desglose de gastos por categoría en el rango. Filtro opcional: unit, general.
 */
router.get('/expense-breakdown', async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query);
    const { unit, general } = req.query;
    const params = [from, to];
    let filter = '';
    if (general === 'true') {
      filter = 'AND e.business_unit_id IS NULL';
    } else if (unit) {
      params.push(unit);
      filter = `AND bu.code = $3`;
    }
    const { rows } = await query(
      `SELECT COALESCE(c.name, 'Sin categoría') AS category,
              COALESCE(SUM(e.amount),0)::float8 AS amount
       FROM expenses e
       LEFT JOIN business_units bu ON bu.id = e.business_unit_id
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE e.expense_date BETWEEN $1 AND $2 ${filter}
       GROUP BY 1 ORDER BY amount DESC;`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
