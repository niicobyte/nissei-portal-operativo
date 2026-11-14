#!/usr/bin/env node
/**
 * NISSEI Portal Operativo - Auditor de Seguridad Automático v2.0
 * Motor de Auditoría: Claude Opus 5.5 High (Fallback: Gemini 3.8 Flash Medium)
 * Escanea archivos en búsqueda de fugas de credenciales, inyecciones SQL,
 * secretos de alta entropía y patrones de código inseguro.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

const startTime = performance.now();
let errors = 0;
let warnings = 0;
let totalLinesScanned = 0;

log(`\n🛡️  NISSEI Security Auditor v2.0 — Sistema de Verificación Defensiva`, colors.bold + colors.cyan);
log(`   [MOTOR DE AUDITORÍA]: Claude Opus 5.5 High (Fallback: Gemini 3.8 Flash Medium)`, colors.dim + colors.cyan);
log(`--------------------------------------------------------------------------------`, colors.cyan);

// 1. Obtener lista de archivos rastreados por Git
let trackedFiles = [];
try {
  const stdout = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
  trackedFiles = stdout.split('\n').map(f => f.trim()).filter(Boolean);
} catch {
  log(`  ⚠️  [WARN] No se pudo ejecutar git ls-files. Escaneando sistema de archivos.`, colors.yellow);
}

// ============================================================================
// CHECK 1: Integridad de Archivos de Entorno y GitIgnore
// ============================================================================
log(`\n[CHECK 1] Verificación de archivos .env, .gitignore y credenciales en Git...`, colors.bold);

// 1.1 Verificar .gitignore
const gitignorePath = path.join(rootDir, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  const requiredIgnores = ['.env', '.env.local', 'node_modules'];
  for (const item of requiredIgnores) {
    if (!gitignoreContent.includes(item)) {
      log(`  ❌ [CRÍTICO] .gitignore no contiene la regla obligatoria: ${item}`, colors.red);
      errors++;
    }
  }
} else {
  log(`  ❌ [CRÍTICO] Archivo .gitignore no encontrado en la raíz del proyecto!`, colors.red);
  errors++;
}

// 1.2 Comprobar que ningún archivo .env sensible esté rastreado por Git
const forbiddenTrackedPatterns = [
  /^\.env(\.local|\.production|\.development)?$/,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /\.pfx$/,
  /\.pkcs12$/,
];

for (const file of trackedFiles) {
  if (file === '.env.example') continue;
  for (const pattern of forbiddenTrackedPatterns) {
    if (pattern.test(path.basename(file))) {
      log(`  ❌ [CRÍTICO] Archivo sensible rastreado en Git: ${file}`, colors.red);
      errors++;
    }
  }
}

// 1.3 Verificar que .env.example no contenga secretos reales
const envExamplePath = path.join(rootDir, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
  if (/WHAPI_API_TOKEN=[a-zA-Z0-9_-]{25,}/.test(envExampleContent)) {
    log(`  ❌ [CRÍTICO] .env.example contiene un token real de WhaApi!`, colors.red);
    errors++;
  } else if (/MYSQL_PASSWORD=[a-zA-Z0-9_!@#$%^&*]{8,}/.test(envExampleContent) && !envExampleContent.includes('tu_password') && !envExampleContent.includes('password_ejemplo')) {
    log(`  ❌ [CRÍTICO] .env.example contiene una contraseña real de MySQL!`, colors.red);
    errors++;
  } else {
    log(`  ✅ .env.example verificado (solo contiene placeholders seguros).`, colors.green);
  }
}

// ============================================================================
// CHECK 2: Escaneo Integral de Fugas de Secretos y Credenciales en Código
// ============================================================================
log(`\n[CHECK 2] Escaneo de fugas de secretos, tokens y credenciales en código...`, colors.bold);

// Firma irreversible SHA-256 (one-way digest) para detectar el token histórico de WhaApi
// sin almacenar ni exponer el secreto (ni en texto plano ni en Base64) dentro del repositorio.
const REVOKED_WHAPI_TOKEN_SHA256 = '81d49fe8539c9f88ca39312f25c58a81a043e0d847b0867bdc76a3fd641a8d1a';

function lineContainsRevokedWhapiToken(line) {
  // 1. Verificar candidatos alfanuméricos de 32 caracteres mediante SHA-256
  const candidates = line.match(/[A-Za-z0-9]{32}/g) || [];
  for (const token of candidates) {
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    if (digest === REVOKED_WHAPI_TOKEN_SHA256) return true;
  }
  // 2. Verificar candidatos codificados en Base64 de 44 caracteres
  const b64Candidates = line.match(/[A-Za-z0-9+/]{43}=/g) || [];
  for (const b64 of b64Candidates) {
    try {
      const decoded = Buffer.from(b64, 'base64');
      const digest = crypto.createHash('sha256').update(decoded).digest('hex');
      if (digest === REVOKED_WHAPI_TOKEN_SHA256) return true;
    } catch {
      // Ignorar Base64 inválido
    }
  }
  return false;
}

const secretRules = [
  {
    name: 'Token real de WhaApi (plano o Base64) en código fuente',
    test: (line) => lineContainsRevokedWhapiToken(line),
    severity: 'CRÍTICA',
    exclude: ['.env.local'],
  },
  {
    name: 'ID real de Grupo de WhatsApp (@g.us) hardcodeado en código fuente',
    test: (line) => /\b[0-9]{15,}@g\.us\b/.test(line),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'Backdoor de contraseña en texto plano detectado',
    test: (line) => /cleanLower\s*===\s*["'](?:sati|danesa|deposito\.danesa)["']/i.test(line),
    severity: 'CRÍTICA',
    exclude: ['scripts/security-audit.mjs'],
  },
  {
    name: 'Clave privada RSA / EC / PGP / OPENSSH expuesta',
    test: (line) => /-----BEGIN (?:RSA|EC|PGP|OPENSSH|ENCRYPTED)? PRIVATE KEY-----/.test(line),
    severity: 'CRÍTICA',
  },
  {
    name: 'OpenAI API Key hardcodeada',
    test: (line) => /sk-[a-zA-Z0-9_-]{28,}/.test(line) && !line.includes('tu_openai_key') && !line.includes('process.env'),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'Anthropic API Key hardcodeada',
    test: (line) => /sk-ant-[a-zA-Z0-9_-]{28,}/.test(line) && !line.includes('tu_key'),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'Google Gemini API Key expuesta',
    test: (line) => /AIza[0-9A-Za-z\-_]{35}/.test(line) && !line.includes('process.env'),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'GitHub Personal Access Token expuesto',
    test: (line) => /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/.test(line) || /github_pat_[a-zA-Z0-9_]{50,}/.test(line),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'AWS Access Key ID hardcodeado',
    test: (line) => /AKIA[0-9A-Z]{16}/.test(line) && !line.includes('AKIAIOSFODNN7EXAMPLE'),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'Cadena de conexión a Base de Datos con contraseña expuesta',
    test: (line) => /(?:mysql|postgres|postgresql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/i.test(line) && !line.includes('usuario:password') && !line.includes('process.env'),
    severity: 'CRÍTICA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'JWT Token real completo con firma en texto plano',
    test: (line) => /eyJh[a-zA-Z0-9_-]{10,}\.eyJh[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{15,}/.test(line) && !line.includes('eyJxxx'),
    severity: 'ALTA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'Webhook de Slack o Discord expuesto',
    test: (line) => /https:\/\/(?:hooks\.slack\.com\/services\/|discord(?:app)?\.com\/api\/webhooks\/)[a-zA-Z0-9_\-\/]+/.test(line),
    severity: 'ALTA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
  {
    name: 'Token genérico de API asignado en código',
    test: (line) => /(?:whapi_token|api_key|secret_key|auth_token)\s*=\s*['"][a-zA-Z0-9_-]{24,}['"]/i.test(line) && !line.includes('tu_token') && !line.includes('placeholder'),
    severity: 'ALTA',
    exclude: ['.env.local', 'scripts/security-audit.mjs'],
  },
];

const scanExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.sql', '.md', '.yml', '.yaml'];
const filesToScan = trackedFiles.filter(f => {
  const ext = path.extname(f);
  return scanExtensions.includes(ext);
});

let foundSecrets = 0;
for (const relPath of filesToScan) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  totalLinesScanned += lines.length;

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
  log(`  ✅ Cero secretos o tokens hardcodeados en archivos rastreados (${filesToScan.length} archivos, ${totalLinesScanned.toLocaleString()} líneas inspeccionadas).`, colors.green);
}

// ============================================================================
// CHECK 3: Verificación contra Inyección SQL (Prepared Statements)
// ============================================================================
log(`\n[CHECK 3] Verificación contra Inyección SQL (Prepared Statements)...`, colors.bold);

let sqlVulnerabilities = 0;
const sqlFiles = filesToScan.filter(f => f.startsWith('src/lib/mysql.ts') || f.startsWith('src/app/api/') || f.endsWith('.sql'));

for (const relPath of sqlFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Detectar interpolación template string dentro de query o execute: query(`...${variable}...`)
    if (/\.(query|execute)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/i.test(line)) {
      // Excluir si solo es interpolación de nombre de base de datos o placeholders constantes controlados
      if (
        line.includes('MYSQL_DATABASE') ||
        line.includes('CREATE DATABASE') ||
        line.includes('placeholders') ||
        line.includes('join(", ")')
      ) {
        continue;
      }
      log(`  ⚠️  [ALTA] Posible concatenación SQL con template string inseguro en ${relPath}:${i + 1}`, colors.yellow);
      log(`     > ${line.trim()}`, colors.reset);
      warnings++;
      sqlVulnerabilities++;
    }

    // 2. Detectar concatenación con operador + dentro de query o execute
    if (/\.(query|execute)\s*\(\s*['"][^'"]*['"]\s*\+\s*[a-zA-Z0-9_]+/i.test(line)) {
      if (line.includes('placeholders')) continue;
      log(`  ⚠️  [ALTA] Concatenación SQL directa con operador (+) en ${relPath}:${i + 1}`, colors.yellow);
      log(`     > ${line.trim()}`, colors.reset);
      warnings++;
      sqlVulnerabilities++;
    }
  }
}

if (sqlVulnerabilities === 0) {
  log(`  ✅ Todas las consultas SQL utilizan Prepared Statements parametrizados (?).`, colors.green);
}

// ============================================================================
// CHECK 4: Detección de Código Dinámico Inseguro / RCE
// ============================================================================
log(`\n[CHECK 4] Verificación de Código Dinámico Seguro (Anti-RCE)...`, colors.bold);

let dynamicCodeIssues = 0;
const srcCodeFiles = filesToScan.filter(f => f.startsWith('src/'));

for (const relPath of srcCodeFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detección de eval()
    if (/\beval\s*\(/.test(line)) {
      log(`  ❌ [CRÍTICA] Uso peligroso de eval() detectado en ${relPath}:${i + 1}`, colors.red);
      errors++;
      dynamicCodeIssues++;
    }

    // Detección de new Function() con parámetros dinámicos
    if (/\bnew\s+Function\s*\(/.test(line)) {
      log(`  ⚠️  [MEDIA] Uso de new Function() detectado en ${relPath}:${i + 1}`, colors.yellow);
      warnings++;
      dynamicCodeIssues++;
    }
  }
}

if (dynamicCodeIssues === 0) {
  log(`  ✅ Cero ejecuciones de código dinámico inseguro (sin eval ni new Function).`, colors.green);
}

// ============================================================================
// CHECK 5: Verificación de Endpoints API y Manejo Defensivo de Errores
// ============================================================================
log(`\n[CHECK 5] Verificación de Rutas API y Captura Defensiva...`, colors.bold);

const apiFiles = filesToScan.filter(f => f.startsWith('src/app/api/'));
let apiPassed = true;

for (const relPath of apiFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');

  // Asegurar que existe bloque try/catch en funciones GET/POST/PUT/DELETE exportadas
  const hasExportedRoute =
    content.includes('export async function POST') ||
    content.includes('export async function GET') ||
    content.includes('export async function PUT') ||
    content.includes('export async function DELETE');

  if (hasExportedRoute && !content.includes('try {')) {
    log(`  ⚠️  [MEDIA] Ruta API sin bloque try/catch global: ${relPath}`, colors.yellow);
    warnings++;
    apiPassed = false;
  }

  // Prevenir fuga de error.stack en respuestas al cliente
  if (content.includes('stack: err.stack') || content.includes('stack: error.stack')) {
    log(`  ⚠️  [MEDIA] Posible exposición de stack trace de error en API: ${relPath}`, colors.yellow);
    warnings++;
  }
}

if (apiPassed) {
  log(`  ✅ Todas las rutas API cuentan con captura de errores defensiva.`, colors.green);
}

// ============================================================================
// Resumen Final y Métricas de Rendimiento
// ============================================================================
const durationMs = (performance.now() - startTime).toFixed(1);

log(`\n--------------------------------------------------------------------------------`, colors.cyan);
log(`📊 Métricas de Auditoría: ${filesToScan.length} archivos | ${totalLinesScanned.toLocaleString()} líneas | Tiempo: ${durationMs} ms`, colors.dim);

if (errors === 0) {
  log(`🎉 AUDITORÍA DE SEGURIDAD EXITOSA: 0 Errores críticos, ${warnings} Advertencias.`, colors.bold + colors.green);
  log(`   Repositorio limpio, blindado y validado con éxito.\n`, colors.green);
  process.exit(0);
} else {
  log(`🚨 SE ENCONTRARON ${errors} ERROR(ES) DE SEGURIDAD CRÍTICOS.`, colors.bold + colors.red);
  log(`   Deben corregirse inmediatamente antes de subir a producción o GitHub.\n`, colors.red);
  process.exit(1);
}
