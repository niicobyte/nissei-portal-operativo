#!/usr/bin/env node
/**
 * Herramienta de consulta y gestión directa para Railway MySQL (Nube)
 * Uso:
 *   node scripts/railway-db.mjs "SELECT * FROM usuarios"
 *   node scripts/railway-db.mjs --tables
 *   node scripts/railway-db.mjs --describe recepcion_tickets
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local de forma nativa sin dependencias
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const connectionUri =
  process.env.MYSQL_PUBLIC_URL ||
  `mysql://${process.env.MYSQL_USER || 'root'}:${encodeURIComponent(process.env.MYSQL_PASSWORD || '')}@${process.env.MYSQL_HOST || 'acela.proxy.rlwy.net'}:${process.env.MYSQL_PORT || 17042}/${process.env.MYSQL_DATABASE || 'railway'}`;

async function main() {
  const args = process.argv.slice(2);
  const conn = await mysql.createConnection(connectionUri);

  if (args.length === 0 || args[0] === '--tables') {
    const [tables] = await conn.query('SHOW TABLES');
    console.log('\n☁️  TABLAS EN RAILWAY MYSQL:');
    console.table(tables);
    await conn.end();
    return;
  }

  if (args[0] === '--describe' && args[1]) {
    const [cols] = await conn.execute(`DESCRIBE \`${args[1]}\``);
    console.log(`\n☁️  ESTRUCTURA DE ${args[1]} EN RAILWAY:`);
    console.table(cols);
    await conn.end();
    return;
  }

  const sql = args.join(' ');
  console.log(`\n☁️  EJECUTANDO EN RAILWAY MYSQL: ${sql}`);
  const [rows] = await conn.query(sql);
  console.log(`Filas retornadas: ${Array.isArray(rows) ? rows.length : 0}`);
  console.table(rows);
  await conn.end();
}

main().catch((err) => {
  console.error('❌ Error en Railway MySQL:', err.message);
  process.exit(1);
});
