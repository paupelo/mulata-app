'use strict';

// Importación masiva desde un archivo Excel (.xlsx) con 4 hojas fijas.
// Reutiliza exactamente la misma vía de inserción que la entrada manual
// (server/repository.js): no crea tablas nuevas ni duplica SQL.

const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');

const { query } = require('../db');
const { insertSale, insertExpense, findOrCreateClient } = require('../repository');
const { norm, saleKey, expenseKey, loadSaleKeys, loadExpenseKeys } = require('../dedupe');

const router = express.Router();

// Subida en memoria (el FS de Render es efímero). Límite defensivo de 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Nombres de hoja y sus cabeceras esperadas (formato fijo del Excel).
const SHEETS = ['VENTAS_TIENDA', 'VENTAS_DISTRIBUCION', 'GASTOS_TIENDA', 'GASTOS_GENERALES'];

// ---------------------------------------------------------------------------
// Helpers de parseo robusto
// ---------------------------------------------------------------------------

// `norm` (normalización de texto) y las claves de duplicados se importan de
// ../dedupe para compartir la misma lógica con la entrada rápida masiva.

// Texto de tienda del Excel -> code interno de unidad de negocio.
const STORE_TEXT_TO_CODE = {
  megapolis: 'megapolis',
  casco: 'casco',
  'casco antiguo': 'casco',
};

/** Empareja el texto de tienda con un code conocido, o null si no coincide. */
function storeCodeFromText(text) {
  return STORE_TEXT_TO_CODE[norm(text)] || null;
}

/** Formatea año/mes/día como 'YYYY-MM-DD'. */
function fmtYmd(y, m, d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

/**
 * Parsea una fecha que puede venir como objeto Date, número de serie de Excel o
 * texto. Devuelve 'YYYY-MM-DD' o null si no es interpretable.
 */
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;

  // 1) Objeto Date (xlsx con cellDates:true).
  if (v instanceof Date && !isNaN(v.getTime())) {
    return fmtYmd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }

  // 2) Número de serie de Excel.
  if (typeof v === 'number' && isFinite(v)) {
    const dc = XLSX.SSF.parse_date_code(v);
    if (dc && dc.y) return fmtYmd(dc.y, dc.m, dc.d);
    return null;
  }

  // 3) Texto.
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // AAAA-MM-DD (formato esperado)
  if (m) return fmtYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/AAAA (tolerancia)
  if (m) return fmtYmd(Number(m[3]), Number(m[2]), Number(m[1]));

  // 4) Último intento: parser nativo para cadenas ISO con hora.
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return fmtYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/**
 * Parsea un importe que puede venir como número o como texto (con símbolo de
 * moneda, separador de miles, etc.). Devuelve un número >= 0 o NaN si inválido.
 */
function parseAmount(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  // Quita símbolo de moneda, letras y espacios; deja dígitos, punto, coma y signo.
  let s = String(v).replace(/[^0-9.,\-]/g, '');
  // El formato es de punto decimal: las comas son separador de miles.
  s = s.replace(/,/g, '');
  // Si quedan varios puntos (p. ej. el "." del símbolo "B/."), el último es el
  // decimal y los demás se descartan como ruido de la moneda/miles.
  const parts = s.split('.');
  if (parts.length > 2) {
    const dec = parts.pop();
    s = parts.join('') + '.' + dec;
  }
  if (s === '' || s === '-' || s === '.') return NaN;
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/**
 * Lee una hoja como matriz de filas conservando el número de fila real de Excel.
 * Devuelve { colIndex(name), rows: [{ excelRow, cells }] } o null si no existe.
 */
function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  if (aoa.length === 0) return { col: () => -1, rows: [] };

  const header = (aoa[0] || []).map((h) => norm(h));
  const col = (n) => header.indexOf(norm(n));

  const rows = [];
  for (let i = 1; i < aoa.length; i++) {
    rows.push({ excelRow: i + 1, cells: aoa[i] || [] });
  }
  return { col, rows };
}

/** ¿Está la fila completamente vacía? */
function isEmptyRow(cells) {
  return !cells.some((c) => c !== null && c !== undefined && String(c).trim() !== '');
}

// ---------------------------------------------------------------------------
// Endpoint principal
// ---------------------------------------------------------------------------

/**
 * POST /api/import/excel  (multipart/form-data, campo "file")
 * Importa las 4 hojas reutilizando la inserción de la entrada manual, evitando
 * duplicados frente a lo ya existente y dentro del propio archivo.
 */
router.post('/excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No se ha recibido ningún archivo .xlsx.' });
    }

    let wb;
    try {
      wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    } catch {
      return res.status(400).json({ error: 'El archivo no es un Excel (.xlsx) válido.' });
    }

    // --- Precarga eficiente (1 query por recurso) ---
    const { rows: units } = await query('SELECT id, code FROM business_units;');
    const unitIdByCode = Object.fromEntries(units.map((u) => [u.code, u.id]));

    const clientsByName = new Map(); // nombre normalizado -> id
    {
      const { rows } = await query('SELECT id, name FROM distribution_clients;');
      for (const c of rows) clientsByName.set(norm(c.name), c.id);
    }

    // Sets de claves existentes para anti-duplicados.
    const saleKeys = await loadSaleKeys();
    const expenseKeys = await loadExpenseKeys();

    const summary = {};
    const errors = [];
    const blank = () => ({ present: false, inserted: 0, skipped: 0, errors: 0 });
    for (const s of SHEETS) summary[s] = blank();

    // Helper: registra un error de fila sin abortar la importación.
    const addError = (sheet, row, reason) => {
      summary[sheet].errors += 1;
      errors.push({ sheet, row, reason });
    };

    // ----------------------- VENTAS_TIENDA -----------------------
    await processSheet('VENTAS_TIENDA', async (sheet, get, excelRow) => {
      const dateRaw = get('fecha');
      const tienda = get('tienda');
      const importeRaw = get('importe');
      const nota = get('nota');

      const code = storeCodeFromText(tienda);
      if (!code || !unitIdByCode[code]) {
        return addError(sheet, excelRow, `Tienda desconocida: "${tienda}".`);
      }
      const date = parseDate(dateRaw);
      if (!date) return addError(sheet, excelRow, `Fecha inválida: "${dateRaw}".`);
      const amount = parseAmount(importeRaw);
      if (!(amount >= 0)) return addError(sheet, excelRow, `Importe inválido: "${importeRaw}".`);

      const unitId = unitIdByCode[code];
      const key = saleKey({ sale_date: date, business_unit_id: unitId, client_id: null, amount });
      if (saleKeys.has(key)) {
        summary[sheet].skipped += 1;
        return;
      }
      await insertSale({
        business_unit_id: unitId,
        client_id: null,
        sale_date: date,
        amount,
        note: nota != null && String(nota).trim() !== '' ? String(nota).trim() : null,
      });
      saleKeys.add(key);
      summary[sheet].inserted += 1;
    });

    // -------------------- VENTAS_DISTRIBUCION --------------------
    const distId = unitIdByCode['distribucion'];
    await processSheet('VENTAS_DISTRIBUCION', async (sheet, get, excelRow) => {
      const dateRaw = get('fecha');
      const clienteRaw = get('cliente');
      const importeRaw = get('importe');
      const nota = get('nota');

      const clienteName = clienteRaw == null ? '' : String(clienteRaw).trim();
      if (!clienteName) return addError(sheet, excelRow, 'Falta el nombre del cliente.');
      if (!distId) return addError(sheet, excelRow, 'No existe la unidad de Distribución.');
      const date = parseDate(dateRaw);
      if (!date) return addError(sheet, excelRow, `Fecha inválida: "${dateRaw}".`);
      const amount = parseAmount(importeRaw);
      if (!(amount >= 0)) return addError(sheet, excelRow, `Importe inválido: "${importeRaw}".`);

      // Cliente: buscar o crear (caché en memoria para no repetir queries).
      let clientId = clientsByName.get(norm(clienteName));
      if (clientId === undefined) {
        const { id } = await findOrCreateClient(clienteName);
        clientId = id;
        clientsByName.set(norm(clienteName), id);
      }

      const key = saleKey({ sale_date: date, business_unit_id: distId, client_id: clientId, amount });
      if (saleKeys.has(key)) {
        summary[sheet].skipped += 1;
        return;
      }
      await insertSale({
        business_unit_id: distId,
        client_id: clientId,
        sale_date: date,
        amount,
        note: nota != null && String(nota).trim() !== '' ? String(nota).trim() : null,
      });
      saleKeys.add(key);
      summary[sheet].inserted += 1;
    });

    // ----------------------- GASTOS_TIENDA -----------------------
    await processSheet('GASTOS_TIENDA', async (sheet, get, excelRow) => {
      const dateRaw = get('fecha');
      const tienda = get('tienda');
      const concepto = get('concepto');
      const tipoRaw = get('tipo');
      const importeRaw = get('importe');
      const nota = get('nota');

      const code = storeCodeFromText(tienda);
      if (!code || !unitIdByCode[code]) {
        return addError(sheet, excelRow, `Tienda desconocida: "${tienda}".`);
      }
      const date = parseDate(dateRaw);
      if (!date) return addError(sheet, excelRow, `Fecha inválida: "${dateRaw}".`);
      const amount = parseAmount(importeRaw);
      if (!(amount >= 0)) return addError(sheet, excelRow, `Importe inválido: "${importeRaw}".`);
      const tipo = norm(tipoRaw);
      let kind;
      if (tipo === 'fijo') kind = 'fijo';
      else if (tipo === 'extraordinario') kind = 'extraordinario';
      else return addError(sheet, excelRow, `Tipo inválido (usa FIJO o EXTRAORDINARIO): "${tipoRaw}".`);

      const conceptVal = concepto != null && String(concepto).trim() !== '' ? String(concepto).trim() : null;
      const unitId = unitIdByCode[code];
      const key = expenseKey({ expense_date: date, business_unit_id: unitId, amount, concept: conceptVal });
      if (expenseKeys.has(key)) {
        summary[sheet].skipped += 1;
        return;
      }
      await insertExpense({
        business_unit_id: unitId,
        category_id: null,
        expense_date: date,
        amount,
        concept: conceptVal,
        supplier: null,
        kind,
        note: nota != null && String(nota).trim() !== '' ? String(nota).trim() : null,
      });
      expenseKeys.add(key);
      summary[sheet].inserted += 1;
    });

    // ---------------------- GASTOS_GENERALES ----------------------
    await processSheet('GASTOS_GENERALES', async (sheet, get, excelRow) => {
      const dateRaw = get('fecha');
      const concepto = get('concepto');
      const importeRaw = get('importe');
      const proveedor = get('proveedor');
      const nota = get('nota');

      const date = parseDate(dateRaw);
      if (!date) return addError(sheet, excelRow, `Fecha inválida: "${dateRaw}".`);
      const amount = parseAmount(importeRaw);
      if (!(amount >= 0)) return addError(sheet, excelRow, `Importe inválido: "${importeRaw}".`);

      const conceptVal = concepto != null && String(concepto).trim() !== '' ? String(concepto).trim() : null;
      const key = expenseKey({ expense_date: date, business_unit_id: null, amount, concept: conceptVal });
      if (expenseKeys.has(key)) {
        summary[sheet].skipped += 1;
        return;
      }
      await insertExpense({
        business_unit_id: null,
        category_id: null,
        expense_date: date,
        amount,
        concept: conceptVal,
        supplier: proveedor != null && String(proveedor).trim() !== '' ? String(proveedor).trim() : null,
        kind: 'general',
        note: nota != null && String(nota).trim() !== '' ? String(nota).trim() : null,
      });
      expenseKeys.add(key);
      summary[sheet].inserted += 1;
    });

    // Totales agregados.
    const totals = { inserted: 0, skipped: 0, errors: 0 };
    for (const s of SHEETS) {
      totals.inserted += summary[s].inserted;
      totals.skipped += summary[s].skipped;
      totals.errors += summary[s].errors;
    }

    return res.json({ ok: true, summary, totals, errors });

    // -- función interna: recorre una hoja fila a fila con manejo de errores --
    async function processSheet(name, handleRow) {
      const sheet = readSheet(wb, name);
      if (!sheet) return; // hoja ausente: se salta sin romper
      summary[name].present = true;
      const get = (colName, cells) => {
        const idx = sheet.col(colName);
        return idx >= 0 ? cells[idx] : null;
      };
      for (const { excelRow, cells } of sheet.rows) {
        if (isEmptyRow(cells)) continue; // ignora filas vacías
        try {
          await handleRow(name, (c) => get(c, cells), excelRow);
        } catch (err) {
          // Un fallo puntual no aborta el resto.
          summary[name].errors += 1;
          errors.push({ sheet: name, row: excelRow, reason: err.message || 'Error al insertar la fila.' });
        }
      }
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/import/template — descarga una plantilla .xlsx vacía con las 4 hojas
 * y solo las filas de cabecera, lista para rellenar y reimportar.
 */
router.get('/template', (req, res, next) => {
  try {
    const headers = {
      VENTAS_TIENDA: ['fecha', 'tienda', 'importe', 'nota'],
      VENTAS_DISTRIBUCION: ['fecha', 'cliente', 'importe', 'nota'],
      GASTOS_TIENDA: ['fecha', 'tienda', 'concepto', 'tipo', 'importe', 'nota'],
      GASTOS_GENERALES: ['fecha', 'concepto', 'importe', 'proveedor', 'nota'],
    };
    const wb = XLSX.utils.book_new();
    for (const name of SHEETS) {
      const ws = XLSX.utils.aoa_to_sheet([headers[name]]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-mulata.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
