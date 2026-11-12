// Motor unificado de depuración, filtrado histórico y normalización SATI (ASU + CDE)
// Reemplaza la depuración manual en Google Sheets / Apps Script permitiendo importar Excel (.xlsx/.xls) o CSV crudo directo del ERP.

export const SATI_MIN_ID_ASU = 29403;
export const SATI_MIN_ID_CDE = 125600;
export const SATI_CDE_RANGE_START = 100000;

export type SatiSheetScope = 'ASU' | 'CDE' | 'MIXED';

export const SATI_EXCLUDED_CLIENT_KEYWORDS = [
  'drop',
  'emap',
  '10807',
  'code 100 sa',
  'farma 10',
  'dream',
  'drem',
  'py-pjc',
  'py-sg',
  'py/sg',
] as const;

export const SATI_ALLOWED_CLIENT_PARENS = new Set(['(JC)', '(ATCN)']);

const CLIENT_ACRONYMS = new Set([
  'SA',
  'EAS',
  'SRL',
  'SAS',
  'ATCN',
  'LTDA',
  'EIRL',
  'CIA',
]);

const BRAND_ACRONYMS = new Set([
  'HP',
  'LG',
  'IBM',
  'PC',
  'TV',
  'USB',
  'HDD',
  'SSD',
  'RAM',
  'CPU',
  'GPU',
  'SA',
  'SRL',
  'SAS',
  'JBL',
  'DJI',
  'MSI',
  'AMD',
  'APC',
  'AOC',
  'WD',
  'TCL',
  'ZTE',
  'QCY',
  'XPG',
  'PNY',
  'JVC',
  'ATX',
  'UPS',
  'LCD',
  'LED',
]);

const COMPONENT_ACRONYMS = new Set([
  'HDD',
  'SSD',
  'RAM',
  'CPU',
  'GPU',
  'PSU',
  'LCD',
  'LED',
  'MB',
  'PC',
  'TV',
  'USB',
  'UPS',
  'DDR3',
  'DDR4',
  'DDR5',
  'NVME',
  'HDMI',
  'VGA',
  'ATX',
  'PS4',
  'PS5',
  'POS',
  'CCTV',
  'IP',
  'AP',
  'RGB',
]);

export type RawSatiRejectReason =
  | 'SIN_ID'
  | 'ID_HISTORICO_ASU'
  | 'ID_HISTORICO_CDE'
  | 'PALABRA_EXCLUIDA'
  | 'PARENTESIS_EXCLUIDO';

export interface SatiDepurationStats {
  totalRawFilas: number;
  totalValidas: number;
  descartadasHistoricasAsu: number;
  descartadasHistoricasCde: number;
  descartadasFiltroCliente: number;
  descartadasParentesis: number;
  duplicadosFusionados: number;
  camposNormalizados: number;
}

export interface SatiPreparedSheetInput {
  csvText: string;
  preSkippedHistoricasAsu: number;
  preSkippedHistoricasCde: number;
  scope?: SatiSheetScope;
}

/**
 * Determina si una hoja o archivo SATI corresponde únicamente a ASU, únicamente a CDE
 * (cuando incluye todo el historial desde #1 hasta #130k+ atravesando el rango 45k..99k)
 * o a una mezcla ya consolidada ASU+CDE.
 */
export function detectSatiSheetScope(
  idValues: Iterable<unknown>,
  hintName?: string
): SatiSheetScope {
  let hasCdeHigh = false;
  let gapMidCount = 0;

  for (const val of idValues) {
    if (val === null || val === undefined) continue;
    let numId: number;
    if (typeof val === 'number') {
      if (!Number.isInteger(val) || val <= 0) continue;
      numId = val;
    } else {
      const clean = String(val).replace(/^#/, '').trim();
      if (!/^\d+$/.test(clean)) continue;
      numId = parseInt(clean, 10);
    }

    if (numId >= SATI_CDE_RANGE_START) {
      hasCdeHigh = true;
    } else if (numId >= 45000) {
      gapMidCount++;
    }
  }

  if (!hasCdeHigh) {
    return 'ASU';
  }

  const hintLow = (hintName || '').toLowerCase();
  const hintsCdeOnly = /\bcde\b/.test(hintLow) && !/\basu\b/.test(hintLow);
  if (gapMidCount >= 5 || (hintsCdeOnly && gapMidCount > 0)) {
    return 'CDE';
  }

  return 'MIXED';
}

export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function createEmptyDepurationStats(): SatiDepurationStats {
  return {
    totalRawFilas: 0,
    totalValidas: 0,
    descartadasHistoricasAsu: 0,
    descartadasHistoricasCde: 0,
    descartadasFiltroCliente: 0,
    descartadasParentesis: 0,
    duplicadosFusionados: 0,
    camposNormalizados: 0,
  };
}

export function mergeDepurationStats(
  a: SatiDepurationStats,
  b: SatiDepurationStats
): SatiDepurationStats {
  return {
    totalRawFilas: a.totalRawFilas + b.totalRawFilas,
    totalValidas: a.totalValidas + b.totalValidas,
    descartadasHistoricasAsu: a.descartadasHistoricasAsu + b.descartadasHistoricasAsu,
    descartadasHistoricasCde: a.descartadasHistoricasCde + b.descartadasHistoricasCde,
    descartadasFiltroCliente: a.descartadasFiltroCliente + b.descartadasFiltroCliente,
    descartadasParentesis: a.descartadasParentesis + b.descartadasParentesis,
    duplicadosFusionados: a.duplicadosFusionados + b.duplicadosFusionados,
    camposNormalizados: a.camposNormalizados + b.camposNormalizados,
  };
}

// Cachés en memoria acotadas para procesar archivos de 32k-130k+ filas en milisegundos
const CACHE_LIMIT = 20000;
const clienteCache = new Map<string, string>();
const marcaCache = new Map<string, string>();
const modeloCache = new Map<string, string>();
const serialCache = new Map<string, string>();
const componenteCache = new Map<string, string>();

function setBoundedCache(cache: Map<string, string>, key: string, val: string): void {
  if (cache.size >= CACHE_LIMIT) {
    cache.clear();
  }
  cache.set(key, val);
}

export function collapseSpacesTrim(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

export function collapseMensajeSpaces(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  return String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Evalúa si una fila cruda exportada de SATI debe conservarse o descartarse según:
 * - ID mínimo histórico (ASU >= 29403, CDE >= 125650)
 * - Palabras clave excluidas en cliente ('drop', 'emap', '10807', 'code 100 sa', etc.)
 * - Paréntesis distintos a (JC) y (ATCN) en cliente
 */
export function evaluateRawSatiRow(
  rawId?: string | null,
  rawCliente?: string | null,
  scope: SatiSheetScope = 'MIXED'
): {
  keep: boolean;
  cleanId: string;
  origen: 'ASU' | 'CDE';
  reason?: RawSatiRejectReason;
} {
  const cleanId = String(rawId || '').replace(/^#/, '').trim();
  if (!cleanId || !/\d/.test(cleanId)) {
    return { keep: false, cleanId: '', origen: scope === 'CDE' ? 'CDE' : 'ASU', reason: 'SIN_ID' };
  }

  const isNumericId = /^\d+$/.test(cleanId);
  const numId = isNumericId ? parseInt(cleanId, 10) : NaN;
  const origen: 'ASU' | 'CDE' =
    scope === 'CDE'
      ? 'CDE'
      : scope === 'ASU'
        ? 'ASU'
        : isNumericId && numId < SATI_CDE_RANGE_START
          ? 'ASU'
          : 'CDE';

  if (isNumericId) {
    if (origen === 'ASU' && numId < SATI_MIN_ID_ASU) {
      return { keep: false, cleanId, origen, reason: 'ID_HISTORICO_ASU' };
    }
    if (origen === 'CDE' && numId < SATI_MIN_ID_CDE) {
      return { keep: false, cleanId, origen, reason: 'ID_HISTORICO_CDE' };
    }
  }

  const clienteCollapsed = collapseSpacesTrim(rawCliente).toLowerCase();
  if (clienteCollapsed) {
    const clienteSlashTight = clienteCollapsed.replace(/\s*\/\s*/g, '/');
    const hasExcludedKeyword = SATI_EXCLUDED_CLIENT_KEYWORDS.some(
      (kw) => clienteCollapsed.includes(kw) || clienteSlashTight.includes(kw)
    );
    if (hasExcludedKeyword) {
      return { keep: false, cleanId, origen, reason: 'PALABRA_EXCLUIDA' };
    }

    const parenMatches = clienteCollapsed.match(/\([^)]+\)/g);
    if (parenMatches) {
      const hasDisallowedParen = parenMatches.some((match) => {
        const cleanParen = match.replace(/\s+/g, '').toUpperCase();
        return !SATI_ALLOWED_CLIENT_PARENS.has(cleanParen);
      });
      if (hasDisallowedParen) {
        return { keep: false, cleanId, origen, reason: 'PARENTESIS_EXCLUIDO' };
      }
    }
  }

  return { keep: true, cleanId, origen };
}

function isAcronymDottedWord(word: string): boolean {
  // Detecta abreviaturas con puntos tipo S.A., S.R.L., E.A.S. (sin romper versiones como M.2 o 2.1)
  return /^[A-Za-z](\.[A-Za-z])+\.?$/.test(word);
}

function formatSingleWord(
  word: string,
  acronyms: ReadonlySet<string>,
  preserveHyphenCompound = false
): string {
  if (!word) return '';
  if (word === '-' || word === '–') return '-';

  // Conservar prefijos especiales como TP-Link en lugar de convertir todo a minúsculas
  if (preserveHyphenCompound && word.includes('-') && word.length > 1) {
    const parts = word.split('-').map((part) => {
      if (!part) return '';
      const upper = part.replace(/\./g, '').toUpperCase();
      if (upper === 'TP' || acronyms.has(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });
    return parts.join('-');
  }

  // Preservar tokens técnicos con decimales/versión como M.2, 5.1, USB2.0
  if (/\d\.\d|\.\d/.test(word)) {
    const upper = word.toUpperCase();
    if (upper === 'M.2') return 'M.2';
    return upper;
  }

  const stripped =
    isAcronymDottedWord(word) || /^[A-Za-z]{2,}\.$/.test(word)
      ? word.replace(/\./g, '')
      : word;

  if (!stripped) return '';
  const mayus = stripped.toUpperCase();
  if (acronyms.has(mayus)) return mayus;

  return stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
}

export function normalizeSatiCliente(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  const rawStr = String(raw);
  const cached = clienteCache.get(rawStr);
  if (cached !== undefined) return cached;

  let text = rawStr
    // Limpiar paréntesis vacíos residuales
    .replace(/\(\s*\)/g, ' ')
    // Asegurar separación correcta para (JC) y (ATCN) incluso si están pegados al nombre: "(jc)Juan" -> "(JC) Juan"
    .replace(/\(\s*(jc|atcn)\s*\)/gi, (_, inner: string) => ` (${inner.toUpperCase()}) `)
    // Convertir barra "A/B" -> "A - B"
    .replace(/\s*\/\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    setBoundedCache(clienteCache, rawStr, '');
    return '';
  }

  const formatted = text
    .split(' ')
    .map((word) => {
      if (!word) return '';
      const parenUpper = word.replace(/\s+/g, '').toUpperCase();
      if (SATI_ALLOWED_CLIENT_PARENS.has(parenUpper)) return parenUpper;
      return formatSingleWord(word, CLIENT_ACRONYMS, false);
    })
    .filter((w) => w !== '')
    .join(' ');

  setBoundedCache(clienteCache, rawStr, formatted);
  return formatted;
}

export function normalizeSatiMarca(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  const rawStr = String(raw);
  const cached = marcaCache.get(rawStr);
  if (cached !== undefined) return cached;

  const text = collapseSpacesTrim(rawStr);
  if (!text) {
    setBoundedCache(marcaCache, rawStr, '');
    return '';
  }

  const formatted = text
    .split(' ')
    .map((word) => formatSingleWord(word, BRAND_ACRONYMS, true))
    .filter((w) => w !== '')
    .join(' ');

  setBoundedCache(marcaCache, rawStr, formatted);
  return formatted;
}

export function normalizeSatiModelo(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  const rawStr = String(raw);
  const cached = modeloCache.get(rawStr);
  if (cached !== undefined) return cached;

  // Solo limpia espacios múltiples: jamás altera mayúsculas/minúsculas de códigos (ej. "SM-A515F", "ILCE-7M3")
  const formatted = collapseSpacesTrim(rawStr);
  setBoundedCache(modeloCache, rawStr, formatted);
  return formatted;
}

export function normalizeSatiSerial(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  const rawStr = String(raw);
  const cached = serialCache.get(rawStr);
  if (cached !== undefined) return cached;

  const trimmed = collapseSpacesTrim(rawStr);
  const formatted = trimmed.toUpperCase();
  setBoundedCache(serialCache, rawStr, formatted);
  return formatted;
}

export function normalizeSatiTipoComponente(raw?: string | null): string {
  if (raw === undefined || raw === null) return '';
  const rawStr = String(raw);
  const cached = componenteCache.get(rawStr);
  if (cached !== undefined) return cached;

  const text = collapseSpacesTrim(rawStr);
  if (!text) {
    setBoundedCache(componenteCache, rawStr, '');
    return '';
  }

  const formatted = text
    .split(' ')
    .map((word) => formatSingleWord(word, COMPONENT_ACRONYMS, false))
    .filter((w) => w !== '')
    .join(' ');

  setBoundedCache(componenteCache, rawStr, formatted);
  return formatted;
}

export interface RawSatiNormalizableFields {
  cliente: string;
  marca: string;
  modelo: string;
  serial: string;
  tipoComponente: string;
  mensaje: string;
}

/**
 * Normaliza los campos estructurados de una fila SATI siguiendo las reglas configuradas
 * y devuelve los nuevos valores junto con el conteo de campos modificados.
 */
export function normalizeSatiRowFields(input: RawSatiNormalizableFields): {
  normalized: RawSatiNormalizableFields;
  camposModificados: number;
} {
  const cliente = normalizeSatiCliente(input.cliente);
  const marca = normalizeSatiMarca(input.marca);
  const modelo = normalizeSatiModelo(input.modelo);
  const serial = normalizeSatiSerial(input.serial);
  const tipoComponente = normalizeSatiTipoComponente(input.tipoComponente);
  const mensaje = collapseMensajeSpaces(input.mensaje);

  let camposModificados = 0;
  if (cliente !== (input.cliente ?? '')) camposModificados++;
  if (marca !== (input.marca ?? '')) camposModificados++;
  if (modelo !== (input.modelo ?? '')) camposModificados++;
  if (serial !== (input.serial ?? '')) camposModificados++;
  if (tipoComponente !== (input.tipoComponente ?? '')) camposModificados++;
  if (mensaje !== (input.mensaje ?? '')) camposModificados++;

  return {
    normalized: {
      cliente,
      marca,
      modelo,
      serial,
      tipoComponente,
      mensaje,
    },
    camposModificados,
  };
}

/**
 * Fusiona información de filas duplicadas con el mismo idOrden dentro de una misma importación cruda:
 * conserva valores no vacíos, fechas de entrega válidas y prioriza estados avanzados sobre 'En Asignacion'.
 */
export function mergeSatiDuplicateFields<
  T extends {
    codigoProducto?: string;
    cliente?: string;
    mensaje?: string;
    fechaIngreso?: string;
    fechaEntregada?: string;
    fechaVenta?: string;
    estado?: string;
    tipoComponente?: string;
    marca?: string;
    modelo?: string;
    serial?: string;
  },
>(base: T, incoming: T): T {
  const pickText = (a?: string, b?: string) => {
    const cleanB = collapseSpacesTrim(b);
    const cleanA = collapseSpacesTrim(a);
    return cleanB.length >= cleanA.length ? cleanB || cleanA : cleanA;
  };

  const baseEstado = collapseSpacesTrim(base.estado);
  const incEstado = collapseSpacesTrim(incoming.estado);
  const baseIsDefault = !baseEstado || baseEstado.toLowerCase() === 'en asignacion';
  const incIsDelivered = incEstado.toLowerCase().includes('entregada');
  const estado =
    incIsDelivered || (baseIsDefault && Boolean(incEstado))
      ? incEstado || baseEstado
      : baseEstado || incEstado;

  const baseTipo = collapseSpacesTrim(base.tipoComponente);
  const incTipo = collapseSpacesTrim(incoming.tipoComponente);
  const tipoComponente =
    incTipo && incTipo.toUpperCase() !== 'GENERAL'
      ? incTipo
      : baseTipo || incTipo || 'General';

  return {
    ...base,
    ...incoming,
    codigoProducto: collapseSpacesTrim(incoming.codigoProducto) || collapseSpacesTrim(base.codigoProducto),
    cliente: pickText(base.cliente, incoming.cliente),
    mensaje: pickText(base.mensaje, incoming.mensaje),
    fechaIngreso: collapseSpacesTrim(incoming.fechaIngreso) || collapseSpacesTrim(base.fechaIngreso),
    fechaEntregada: collapseSpacesTrim(incoming.fechaEntregada) || collapseSpacesTrim(base.fechaEntregada),
    fechaVenta: collapseSpacesTrim(incoming.fechaVenta) || collapseSpacesTrim(base.fechaVenta),
    estado,
    tipoComponente,
    marca: pickText(base.marca, incoming.marca),
    modelo: pickText(base.modelo, incoming.modelo),
    serial:
      collapseSpacesTrim(incoming.serial) &&
      collapseSpacesTrim(incoming.serial) !== 'SIN SERIAL VISIBLE'
        ? collapseSpacesTrim(incoming.serial)
        : collapseSpacesTrim(base.serial),
  };
}

/**
 * Comparación tolerante a mayúsculas/minúsculas y espacios múltiples para detectar
 * cambios operativos reales sin disparar falsas alertas por normalización cosmética.
 */
export function isSameNormalizedText(a?: string | null, b?: string | null): boolean {
  return collapseSpacesTrim(a).toLowerCase() === collapseSpacesTrim(b).toLowerCase();
}
