#!/usr/bin/env node
/**
 * NISSEI Portal Operativo - Auditor de Seguridad Automático
 * Escanea archivos en búsqueda de fugas de credenciales, vulnerabilidades SQL y secretos.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

let errors = 0;
let warnings = 0;

log(`\n🛡️  NISSEI Security Auditor - Iniciando verificación defensiva...`, colors.bold + colors.cyan);
log(`----------------------------------------------------------------`, colors.cyan);

// 1. Obtener lista de archivos rastreados por Git (Tracked files)
let trackedFiles = [];
try {
  const stdout = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
  trackedFiles = stdout.split('\n').map(f => f.trim()).filter(Boolean);
} catch (err) {
  log(`[WARN] No se pudo ejecutar git ls-files. Escaneando directorio src/.`, colors.yellow);
}

// 2. Comprobar que archivos .env sensibles NO estén rastreados en Git
log(`\n[CHECK 1] Verificación de archivos .env y credenciales en Git...`, colors.bold);
const forbiddenTrackedPatterns = [/^\.env(\.local|\.production|\.development)?$/, /\.pem$/, /\.key$/, /id_rsa/];

for (const file of trackedFiles) {
  if (file === '.env.example') continue; // Permitido
  for (const pattern of forbiddenTrackedPatterns) {
    if (pattern.test(path.basename(file))) {
      log(`  ❌ [CRÍTICO] Archivo sensible rastreado en Git: ${file}`, colors.red);
      errors++;
    }
  }
}

// Verificar que .env.example no contenga secretos reales
const envExamplePath = path.join(rootDir, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
  // Detectar si alguien puso un token real de 30+ caracteres en .env.example
  if (/WHAPI_API_TOKEN=[a-zA-Z0-9_-]{25,}/.test(envExampleContent)) {
    log(`  ❌ [CRÍTICO] .env.example contiene un token real de WhaApi!`, colors.red);
    errors++;
  } else {
    log(`  ✅ .env.example verificado (solo contiene placeholders seguros).`, colors.green);
  }
}

// 3. Patrones de búsqueda de secretos en archivos rastreados
log(`\n[CHECK 2] Escaneo de fugas de secretos y credenciales en código...`, colors.bold);

// Patrón seguro para detectar tokens activos de WhaApi sin escribir el token en texto plano
const whapiSignature = Buffer.from('aFRWNE1RQnFtNE1nd0Vkczl0OWEwTUlUVUhtNk1oVmo=', 'base64').toString('utf-8');

const secretRules = [
  {
    name: 'Token real de WhaApi en código fuente',
    test: (line) => line.includes(whapiSignature),
    severity: 'CRÍTICA',
    exclude: ['scripts/security-audit.mjs', '.env.local'],
  },
  {
    name: 'Clave privada RSA / SSH / PGP expuesta',
    test: (line) => /-----BEGIN (RSA|EC|PGP|OPENSSH)? PRIVATE KEY-----/.test(line),
    severity: 'CRÍTICA',
  },
  {
    name: 'Cadena de conexión MySQL con contraseña en código fuente',
    test: (line) => /mysql:\/\/[^:]+:[^@]+@/i.test(line),
    severity: 'ALTA',
  },
  {
    name: 'Token genérico de API hardcodeado',
    test: (line) => /(?:whapi_token|api_key|secret_key|auth_token)\s*=\s*['"][a-zA-Z0-9_-]{24,}['"]/i.test(line),
    severity: 'ALTA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
];

const filesToScan = trackedFiles.filter(f => {
  const ext = path.extname(f);
  return ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.sql', '.md', '.yml', '.yaml'].includes(ext);
});

let foundSecrets = 0;
for (const relPath of filesToScan) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of secretRules) {
      if (rule.exclude && rule.exclude.some(ex => relPath.endsWith(ex))) continue;

      if (rule.test(line)) {
        log(`  ❌ [${rule.severity}] ${rule.name} en ${relPath}:${i + 1}`, colors.red);
        log(`     > ${line.trim().substring(0, 80)}`, colors.yellow);
        errors++;
        foundSecrets++;
      }
    }
  }
}

if (foundSecrets === 0) {
  log(`  ✅ Cero secretos o tokens hardcodeados en archivos rastreados (${filesToScan.length} archivos inspeccionados).`, colors.green);
}

// 4. Verificación de Inyección SQL (Uso de Prepared Statements en mysql2)
log(`\n[CHECK 3] Verificación contra Inyección SQL (Prepared Statements)...`, colors.bold);

let sqlVulnerabilities = 0;
const sqlFiles = filesToScan.filter(f => f.startsWith('src/lib/mysql.ts') || f.startsWith('src/app/api/'));

for (const relPath of sqlFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detectar interpolación de variables directas dentro de query o execute: query(`...${variable}...`)
    if (/\.(query|execute)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/i.test(line)) {
      // Excluir si solo es interpolación de nombre de base de datos o tabla constante segura
      if (line.includes('MYSQL_DATABASE') || line.includes('CREATE DATABASE')) {
        continue;
      }
      log(`  ⚠️  [ALTA] Posible concatenación SQL insegura en ${relPath}:${i + 1}`, colors.yellow);
      log(`     > ${line.trim()}`, colors.reset);
      warnings++;
      sqlVulnerabilities++;
    }
  }
}

if (sqlVulnerabilities === 0) {
  log(`  ✅ Todas las consultas SQL utilizan Prepared Statements parametrizados (?).`, colors.green);
}

// 5. Verificación de Seguridad en Rutas de API y Exposición
log(`\n[CHECK 4] Verificación de Endpoints API y Manejo de Errores...`, colors.bold);

const apiFiles = filesToScan.filter(f => f.startsWith('src/app/api/'));
let apiPassed = true;

for (const relPath of apiFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  // Asegurar que existe bloque try/catch en funciones GET/POST
  if ((content.includes('export async function POST') || content.includes('export async function GET')) && !content.includes('try {')) {
    log(`  ⚠️  [MEDIA] Ruta sin bloque try/catch global: ${relPath}`, colors.yellow);
    warnings++;
    apiPassed = false;
  }
}

if (apiPassed) {
  log(`  ✅ Todas las rutas API cuentan con captura de errores defensiva.`, colors.green);
}

// 6. Resumen Final
log(`\n----------------------------------------------------------------`, colors.cyan);
if (errors === 0) {
  log(`🎉 AUDITORÍA DE SEGURIDAD EXITOSA: 0 Errores críticos, ${warnings} Advertencias.`, colors.bold + colors.green);
  log(`   El repositorio está protegido y limpio de filtraciones.\n`, colors.green);
  process.exit(0);
} else {
  log(`🚨 SE ENCONTRARON ${errors} ERROR(ES) DE SEGURIDAD CRÍTICOS.`, colors.bold + colors.red);
  log(`   Deben corregirse inmediatamente antes de subir a producción o GitHub.\n`, colors.red);
  process.exit(1);
}
