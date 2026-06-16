'use strict';

/**
 * Script de backup automático.
 * Genera un fichero JSON con TODOS los datos en la carpeta /backups.
 *
 * Uso manual:        npm run backup
 * Uso programado:    configurar un Cron Job en Render (ver DEPLOY.md) que ejecute
 *                    `node server/backup.js`. También sirve cualquier cron del sistema.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { dumpAll } = require('./routes/data');
const { pool } = require('./db');

async function run() {
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const dump = await dumpAll();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `mulata-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 2), 'utf-8');

  const counts = Object.entries(dump.data)
    .map(([t, rows]) => `${t}=${rows.length}`)
    .join(', ');
  console.log(`[Mulata] Backup creado: ${file}`);
  console.log(`[Mulata] Registros: ${counts}`);
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Mulata] Error en el backup:', err);
    process.exit(1);
  });
