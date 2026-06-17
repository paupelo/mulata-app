'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./db');

// Las 3 unidades de negocio fijas del negocio Mulata.
const BUSINESS_UNITS = [
  { code: 'megapolis', name: 'Tienda Megapolis' },
  { code: 'casco', name: 'Tienda Casco Antiguo' },
  { code: 'distribucion', name: 'Distribución' },
];

// Conceptos de gasto fijos típicos sembrados para cada tienda física.
const DEFAULT_FIXED_CATEGORIES = ['Salario', 'Alquiler', 'Naturgy (luz)', 'Wifi / Internet', 'Municipio / Impuestos'];

// Conceptos de gastos generales / comunes (business_unit_id = NULL).
const DEFAULT_GENERAL_CATEGORIES = ['Compra a proveedor', 'Honorarios contadora', 'Tasas e impuestos sociedad'];

// Proveedores por defecto sembrados al arrancar (idempotente, no duplica).
const DEFAULT_PROVEEDORES = ['Anisa', 'Benli', 'Lentes', 'Bisutería', 'Taller Mulata', 'Valeria'];

/**
 * Crea todas las tablas si no existen (idempotente) y siembra los datos base.
 */
async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_units (
      id   SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS distribution_clients (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      contact    TEXT,
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      business_unit_id INTEGER REFERENCES business_units(id) ON DELETE CASCADE,
      kind             TEXT NOT NULL DEFAULT 'fijo',
      is_default       BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sales (
      id               SERIAL PRIMARY KEY,
      business_unit_id INTEGER NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
      client_id        INTEGER REFERENCES distribution_clients(id) ON DELETE SET NULL,
      sale_date        DATE NOT NULL,
      amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
      note             TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id               SERIAL PRIMARY KEY,
      business_unit_id INTEGER REFERENCES business_units(id) ON DELETE CASCADE,
      category_id      INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
      expense_date     DATE NOT NULL,
      amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
      concept          TEXT,
      supplier         TEXT,
      kind             TEXT NOT NULL DEFAULT 'extraordinario',
      note             TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── Módulo Proveedores ──────────────────────────────────────────────
  // Tablas independientes de ventas/gastos. Las compras a proveedor se
  // registran aquí y luego se reparten ("imputan") a las unidades de negocio
  // mediante asignaciones. Esto NO altera las tablas sales/expenses.
  await query(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id         SERIAL PRIMARY KEY,
      nombre     TEXT NOT NULL UNIQUE,
      activo     BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS compras_proveedor (
      id                SERIAL PRIMARY KEY,
      proveedor_id      INTEGER REFERENCES proveedores(id),
      fecha             DATE NOT NULL,
      concepto          TEXT NOT NULL,
      cantidad_unidades INTEGER,
      importe_total     NUMERIC(10,2) NOT NULL,
      nota              TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asignaciones_compra (
      id                SERIAL PRIMARY KEY,
      compra_id         INTEGER REFERENCES compras_proveedor(id) ON DELETE CASCADE,
      unidad            TEXT NOT NULL CHECK (unidad IN ('megapolis','casco','distribucion')),
      unidades_tomadas  INTEGER,
      importe_asignado  NUMERIC(10,2) NOT NULL,
      fecha             DATE NOT NULL,
      nota              TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Índices para acelerar las agregaciones del dashboard.
  await query(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (sale_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sales_unit ON sales (business_unit_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sales_client ON sales (client_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_expenses_unit ON expenses (business_unit_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_expenses_cat ON expenses (category_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras_proveedor (fecha);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras_proveedor (proveedor_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_compra ON asignaciones_compra (compra_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_unidad ON asignaciones_compra (unidad);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha ON asignaciones_compra (fecha);`);

  await seed();
  console.log('[Mulata] Migración y seed completados.');
}

/**
 * Siembra unidades de negocio, categorías por defecto y usuario admin.
 * Todo es idempotente: no duplica si ya existe.
 */
async function seed() {
  // Unidades de negocio.
  for (const unit of BUSINESS_UNITS) {
    await query(
      `INSERT INTO business_units (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING;`,
      [unit.code, unit.name]
    );
  }

  const { rows: units } = await query(`SELECT id, code FROM business_units;`);
  const byCode = Object.fromEntries(units.map((u) => [u.code, u.id]));

  // Categorías fijas para las dos tiendas físicas.
  for (const code of ['megapolis', 'casco']) {
    for (const name of DEFAULT_FIXED_CATEGORIES) {
      await ensureCategory(name, byCode[code], 'fijo');
    }
  }

  // Categorías de gastos generales (sin unidad).
  for (const name of DEFAULT_GENERAL_CATEGORIES) {
    await ensureCategory(name, null, 'general');
  }

  // Proveedores por defecto (no duplica si ya existen).
  for (const nombre of DEFAULT_PROVEEDORES) {
    await query(
      `INSERT INTO proveedores (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING;`,
      [nombre]
    );
  }

  // Usuario admin a partir de las variables de entorno (login principal).
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;
  if (username && password) {
    const hash = bcrypt.hashSync(password, 10);
    await query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
      [username, hash]
    );
  }
}

/**
 * Inserta una categoría por defecto si no existe ya una con el mismo nombre/unidad.
 */
async function ensureCategory(name, businessUnitId, kind) {
  const existing = await query(
    `SELECT id FROM expense_categories
     WHERE name = $1 AND business_unit_id IS NOT DISTINCT FROM $2;`,
    [name, businessUnitId]
  );
  if (existing.rowCount === 0) {
    await query(
      `INSERT INTO expense_categories (name, business_unit_id, kind, is_default)
       VALUES ($1, $2, $3, TRUE);`,
      [name, businessUnitId, kind]
    );
  }
}

module.exports = { migrate };

// Permite ejecutar la migración manualmente con: npm run migrate
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Mulata] Error en la migración:', err);
      process.exit(1);
    });
}
