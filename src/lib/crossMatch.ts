/**
 * Motor de Cruce Inteligente de Datos SATI (ASU ↔ CDE)
 * Permite vincular automáticamente las órdenes de Asunción (rango #29403 en adelante)
 * con las órdenes correspondientes de Casa Matriz CDE (rango #125000 en adelante),
 * guiándose por las columnas compartidas:
 * - Serial Físico (identificador primordial y unívoco)
 * - Referencias directas en mensajes de taller (ej. #32445 o #125658)
 * - Código de Producto (SKU) + Modelo + Fechas próximas
 */

import { RecepcionTicket } from "@/data/recepcionData";
import {
  RecepcionCdeTicket,
  calcularDiasResolucion,
  isTicketDanesa,
  isDespachoCoherente,
  isFechaValida,
  parseFechaDMY,
} from "@/data/recepcionCdeData";

/**
 * Normaliza un número de serie físico descartando valores genéricos o ausentes
 */
export function normalizeSerial(serial?: string): string {
  if (!serial) return "";
  const s = serial.trim().toUpperCase().replace(/[\s\-_/\\.:,;']/g, "");
  if (
    !s ||
    s === "0" ||
    s.startsWith("SINSERIAL") ||
    s.startsWith("SINNUMERO") ||
    s.startsWith("SSERIAL") ||
    s.startsWith("NOSERIAL") ||
    s.startsWith("NOTIENE") ||
    s.startsWith("NOPOSEE") ||
    s.startsWith("SINSERIE") ||
    s.startsWith("SINNRO") ||
    s.startsWith("NONUMERO") ||
    s.startsWith("NOSERIE") ||
    s.includes("SINSERIAL") ||
    s.includes("NOSERIAL") ||
    s.includes("NOTIENESERIAL") ||
    s === "SN" ||
    s === "NA" ||
    s === "NONE" ||
    s === "NULL" ||
    s === "NULO" ||
    s === "DEFAULT" ||
    s.length < 4
  ) {
    return "";
  }
  return s;
}

/**
 * Normaliza texto para comparaciones insensibles a mayúsculas, acentos y signos
 */
export function normalizeText(txt?: string): string {
  if (!txt) return "";
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Quita prefijos de sucursal o técnico al inicio del cliente, ej. "(JC) Juan Lopez" -> "Juan Lopez"
 */
export function stripClientPrefix(name?: string): string {
  if (!name) return "";
  return name.replace(/^\s*[\(\[]\s*[a-z]{1,4}\s*[\)\]]\s*/i, "").trim();
}

/**
 * Verifica si dos nombres de cliente coinciden: primero de forma directa ("de una")
 * y, si no coincide, probando agregar/quitar el prefijo "(JC)" al principio.
 */
export function clientsMatch(
  clienteA?: string,
  clienteB?: string
): { matched: boolean; viaJcFallback: boolean } {
  if (!clienteA || !clienteB) return { matched: false, viaJcFallback: false };
  if (isTicketDanesa(clienteA) || isTicketDanesa(clienteB)) {
    return { matched: false, viaJcFallback: false };
  }

  const exactA = normalizeText(clienteA);
  const exactB = normalizeText(clienteB);
  const baseA = normalizeText(stripClientPrefix(clienteA));
  const baseB = normalizeText(stripClientPrefix(clienteB));

  if (baseA.length < 4 || baseB.length < 4) {
    return { matched: false, viaJcFallback: false };
  }

  if (exactA === exactB) {
    return { matched: true, viaJcFallback: false };
  }

  const withJcA = `jc${baseA}`;
  const withJcB = `jc${baseB}`;
  if (withJcA === exactB || withJcB === exactA || baseA === baseB) {
    return { matched: true, viaJcFallback: true };
  }

  return { matched: false, viaJcFallback: false };
}

/**
 * Convierte textos que llegan 100% en MAYÚSCULAS (como dictámenes SATI) a formato oración normal
 * (primera letra mayúscula y el resto normal). Respeta mensajes que ya tienen minúsculas o siglas cortas.
 */
export function formatSatiSentenceCase(text?: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const upperMatches = trimmed.match(/[A-ZÁÉÍÓÚÜÑ]/g);
  const hasLower = /[a-záéíóúüñ]/.test(trimmed);
  if (!upperMatches || upperMatches.length < 4 || hasLower) {
    return trimmed;
  }

  return trimmed
    .toLowerCase()
    .replace(/(^|[.!?]\s+|\n+\s*)([a-záéíóúüñ])/g, (_, prefix: string, ch: string) => {
      return `${prefix}${ch.toUpperCase()}`;
    });
}

function getCombinedEquipmentRaw(marca?: string, modelo?: string): string {
  const m = (marca || "").trim();
  const mod = (modelo || "").trim();
  if (!m) return mod;
  if (!mod) return m;
  if (mod.toLowerCase().startsWith(m.toLowerCase())) return mod;
  return `${m} ${mod}`;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

function tokenizeEquipment(raw: string): string[] {
  const stopWords = new Set(["a", "de", "del", "para", "con", "en", "la", "el", "y"]);
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));
}

const EQUIP_SIM_CACHE = new Map<string, number>();
const EQUIP_SIM_CACHE_MAX = 30000;

/**
 * Calcula similitud entre dos equipos (Marca + Modelo), tolerando diferencias de mayúsculas,
 * ubicación de marca/modelo y pequeños errores tipográficos (ej. KBHDV34 vs KBDV34).
 */
export function computeEquipmentSimilarity(
  marcaA?: string,
  modeloA?: string,
  marcaB?: string,
  modeloB?: string
): number {
  const key = `${marcaA || ""}\x00${modeloA || ""}\x00${marcaB || ""}\x00${modeloB || ""}`;
  const cached = EQUIP_SIM_CACHE.get(key);
  if (cached !== undefined) return cached;

  const combRawA = getCombinedEquipmentRaw(marcaA, modeloA);
  const combRawB = getCombinedEquipmentRaw(marcaB, modeloB);
  const normCombA = normalizeText(combRawA);
  const normCombB = normalizeText(combRawB);
  const normModA = normalizeText(modeloA);
  const normModB = normalizeText(modeloB);

  if (!normCombA || !normCombB) {
    if (EQUIP_SIM_CACHE.size >= EQUIP_SIM_CACHE_MAX) EQUIP_SIM_CACHE.clear();
    EQUIP_SIM_CACHE.set(key, 0);
    return 0;
  }
  if (normCombA === normCombB || (normModA && normModB && normModA === normModB)) {
    if (EQUIP_SIM_CACHE.size >= EQUIP_SIM_CACHE_MAX) EQUIP_SIM_CACHE.clear();
    EQUIP_SIM_CACHE.set(key, 1);
    return 1;
  }

  let containmentScore = 0;
  const minLen = Math.min(normCombA.length, normCombB.length);
  const maxLen = Math.max(normCombA.length, normCombB.length);
  if (minLen >= 5 && (normCombA.includes(normCombB) || normCombB.includes(normCombA))) {
    containmentScore = Math.max(0.84, minLen / maxLen);
  }

  const distComb = levenshteinDistance(normCombA, normCombB);
  const charSimComb = 1 - distComb / maxLen;

  let charSimMod = 0;
  if (normModA && normModB && Math.min(normModA.length, normModB.length) >= 4) {
    const distMod = levenshteinDistance(normModA, normModB);
    charSimMod = 1 - distMod / Math.max(normModA.length, normModB.length);
  }

  const tokensA = tokenizeEquipment(combRawA);
  const tokensB = tokenizeEquipment(combRawB);
  let tokenScore = 0;
  if (tokensA.length > 0 && tokensB.length > 0) {
    let matchedWeight = 0;
    const usedB = new Set<number>();
    for (const ta of tokensA) {
      let bestTok = 0;
      let bestIdx = -1;
      for (let j = 0; j < tokensB.length; j++) {
        if (usedB.has(j)) continue;
        const tb = tokensB[j];
        if (ta === tb) {
          bestTok = 1;
          bestIdx = j;
          break;
        }
        const mLen = Math.max(ta.length, tb.length);
        if (mLen >= 4) {
          const d = levenshteinDistance(ta, tb);
          const sim = 1 - d / mLen;
          if (sim >= 0.72 && sim > bestTok) {
            bestTok = sim;
            bestIdx = j;
          }
        }
      }
      if (bestIdx !== -1) {
        usedB.add(bestIdx);
        matchedWeight += bestTok;
      }
    }
    tokenScore = (2 * matchedWeight) / (tokensA.length + tokensB.length);
  }

  const finalSim = Math.max(containmentScore, charSimComb, charSimMod, tokenScore);
  if (EQUIP_SIM_CACHE.size >= EQUIP_SIM_CACHE_MAX) EQUIP_SIM_CACHE.clear();
  EQUIP_SIM_CACHE.set(key, finalSim);
  return finalSim;
}

/**
 * Evalua búsqueda libre en tabla SATI soportando prefijo "(JC)" opcional y serial/modelo sin signos
 */
export function matchesSmartSatiSearch(
  t: {
    idOrden: string;
    idOrdenAsu?: string;
    idOrdenCde?: string;
    cliente?: string;
    clienteAsu?: string;
    codigoProducto?: string;
    marca?: string;
    modelo?: string;
    serial?: string;
    mensaje?: string;
  },
  rawQuery: string
): boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return true;

  if (
    t.idOrden.toLowerCase().includes(q) ||
    (t.idOrdenAsu && t.idOrdenAsu.toLowerCase().includes(q)) ||
    (t.idOrdenCde && t.idOrdenCde.toLowerCase().includes(q)) ||
    (t.clienteAsu && t.clienteAsu.toLowerCase().includes(q)) ||
    (t.codigoProducto && t.codigoProducto.toLowerCase().includes(q)) ||
    (t.cliente && t.cliente.toLowerCase().includes(q)) ||
    (t.modelo && t.modelo.toLowerCase().includes(q)) ||
    (t.marca && t.marca.toLowerCase().includes(q)) ||
    (t.serial && t.serial.toLowerCase().includes(q)) ||
    (t.mensaje && t.mensaje.toLowerCase().includes(q))
  ) {
    return true;
  }

  const strippedQ = stripClientPrefix(rawQuery).toLowerCase();
  if (
    strippedQ &&
    strippedQ !== q &&
    ((t.cliente && stripClientPrefix(t.cliente).toLowerCase().includes(strippedQ)) ||
      (t.clienteAsu && stripClientPrefix(t.clienteAsu).toLowerCase().includes(strippedQ)))
  ) {
    return true;
  }

  const normQ = normalizeText(rawQuery);
  if (normQ.length >= 4) {
    const normClient = normalizeText(stripClientPrefix(t.cliente));
    const normClientAsu = normalizeText(stripClientPrefix(t.clienteAsu));
    const normClientQ = normalizeText(stripClientPrefix(rawQuery));
    if (
      (normClientQ.length >= 4 && (normClient.includes(normClientQ) || normClientAsu.includes(normClientQ))) ||
      normalizeText(t.serial).includes(normQ) ||
      normalizeText(getCombinedEquipmentRaw(t.marca, t.modelo)).includes(normQ)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extrae números de orden posibles (4 a 6 dígitos) de un mensaje
 */
function extractOrderIds(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(/\b\d{4,6}\b/g);
  return matches ? matches : [];
}

function extractSerialTokens(text?: string): string[] {
  if (!text) return [];
  const rawTokens = text.match(/[A-Za-z0-9][A-Za-z0-9\-_]{4,}[A-Za-z0-9]/g);
  if (!rawTokens) return [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const tok of rawTokens) {
    const norm = normalizeSerial(tok);
    if (norm.length < 6 || !/\d/.test(norm) || seen.has(norm)) continue;
    seen.add(norm);
    unique.push(norm);
  }
  return unique;
}

/**
 * Indexa posibles números de serie mencionados dentro de mensajes/informes en O(N),
 * evitando exploraciones cuadráticas O(N*M) cuando se cruzan miles de órdenes.
 */
function buildSerialMentionMap<T extends { mensaje?: string }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    for (const norm of extractSerialTokens(item.mensaje)) {
      let bucket = map.get(norm);
      if (!bucket) {
        bucket = [];
        map.set(norm, bucket);
      }
      bucket.push(item);
    }
  }
  return map;
}

function findSerialMentionMatch<T extends MatchableOrder>(
  sourceItem: MatchableOrder,
  sourceNormSerial: string,
  otherBySerial: Map<string, T[]>,
  otherMentioningSerial: Map<string, T[]>,
  usedIds: Set<string>,
  sourceIsAsu: boolean
): T | null {
  const isCoherent = (cand: T) =>
    sourceIsAsu
      ? isOrderPairChronologicallyCoherent(sourceItem, cand)
      : isOrderPairChronologicallyCoherent(cand, sourceItem);

  if (sourceNormSerial.length >= 6 && otherMentioningSerial.has(sourceNormSerial)) {
    for (const cand of otherMentioningSerial.get(sourceNormSerial)!) {
      if (usedIds.has(cand.idOrden)) continue;
      if (isCoherent(cand)) return cand;
    }
  }
  if (sourceItem.mensaje) {
    for (const tok of extractSerialTokens(sourceItem.mensaje)) {
      const candidates = otherBySerial.get(tok);
      if (!candidates) continue;
      for (const cand of candidates) {
        if (usedIds.has(cand.idOrden)) continue;
        if (isCoherent(cand)) return cand;
      }
    }
  }
  return null;
}

/**
 * Compara dos fechas (cualquier formato soportado por SATI) y devuelve la diferencia en días
 */
function getDiasDiferenciaFechas(f1?: string, f2?: string): number {
  if (!f1 || !f2) return 9999;
  const d1 = parseFechaDMY(f1);
  const d2 = parseFechaDMY(f2);
  if (!d1 || !d2) return 9999;
  return Math.abs(Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Genera una clave única inequívoca para una fila física
 */
export function getTicketRowKey(t: RecepcionCdeTicket | RecepcionTicket, index?: number): string {
  const anyT = t as RecepcionCdeTicket;
  if (anyT.rowKey) return anyT.rowKey;
  const origen = anyT.origen || (parseInt(t.idOrden, 10) >= 125000 ? "CDE" : "ASU");
  const id = (t.idOrden || "").trim();
  const cod = (t.codigoProducto || "").trim();
  const ser = normalizeSerial(t.serial) || (t.serial || "").trim();
  const base = `${origen}_${id}_${cod}_${ser}`;
  return index !== undefined ? `${base}_${index}` : base;
}

interface MatchableOrder {
  idOrden: string;
  codigoProducto?: string;
  cliente?: string;
  mensaje?: string;
  fechaIngreso?: string;
  fechaEntregada?: string;
  estado?: string;
  marca?: string;
  modelo?: string;
  serial?: string;
}

interface CachedDateMeta {
  valid: boolean;
  ms: number | null;
}

const FECHA_META_CACHE = new Map<string, CachedDateMeta>();
const FECHA_META_CACHE_MAX = 8000;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getDateMeta(fecha?: string): CachedDateMeta {
  if (!fecha) return { valid: false, ms: null };
  const cached = FECHA_META_CACHE.get(fecha);
  if (cached !== undefined) return cached;
  const parsed = parseFechaDMY(fecha);
  const meta: CachedDateMeta = {
    valid: isFechaValida(fecha),
    ms: parsed ? parsed.getTime() : null,
  };
  if (FECHA_META_CACHE.size >= FECHA_META_CACHE_MAX) FECHA_META_CACHE.clear();
  FECHA_META_CACHE.set(fecha, meta);
  return meta;
}

export interface ChronoCoherenceOptions {
  maxPreIngresoDays?: number;
  maxPreDespachoDays?: number;
  maxPostEntregaDays?: number;
}

function isOrderPairCoherentMeta(
  asuIngreso: CachedDateMeta,
  asuEntrega: CachedDateMeta,
  asuEntregada: boolean,
  cdeIngreso: CachedDateMeta,
  cdeDespacho: CachedDateMeta,
  options: ChronoCoherenceOptions = {}
): boolean {
  const {
    maxPreIngresoDays = 7,
    maxPreDespachoDays = 1,
    maxPostEntregaDays = 3,
  } = options;

  // 1. El despacho CDE no puede ocurrir antes del ingreso de la orden en ASU
  if (asuIngreso.ms !== null && cdeDespacho.ms !== null) {
    if ((cdeDespacho.ms - asuIngreso.ms) / MS_PER_DAY < -maxPreDespachoDays) {
      return false;
    }
  }

  // 2. El ingreso en CDE no puede ser semanas/meses anterior a la creación de la orden ASU
  if (asuIngreso.ms !== null && cdeIngreso.ms !== null) {
    if ((cdeIngreso.ms - asuIngreso.ms) / MS_PER_DAY < -maxPreIngresoDays) {
      return false;
    }
  }

  // 3. Una orden ASU ya Entregada al cliente no puede vincularse con un ticket CDE posterior
  if (asuEntregada && asuEntrega.valid && asuEntrega.ms !== null) {
    if (cdeIngreso.ms !== null && (cdeIngreso.ms - asuEntrega.ms) / MS_PER_DAY > maxPostEntregaDays) {
      return false;
    }
    if (cdeDespacho.ms !== null && (cdeDespacho.ms - asuEntrega.ms) / MS_PER_DAY > maxPostEntregaDays) {
      return false;
    }
  }

  return true;
}

/**
 * Valida coherencia cronológica bidireccional entre una orden ASU y una orden CDE:
 * evita que órdenes históricas ya entregadas capturen envíos recientes del mismo serial,
 * y que órdenes nuevas apunten a despachos pasados de visitas anteriores.
 */
export function isOrderPairChronologicallyCoherent(
  asu: Pick<MatchableOrder, "fechaIngreso" | "fechaEntregada" | "estado">,
  cde: Pick<MatchableOrder, "fechaIngreso" | "fechaEntregada">,
  options?: ChronoCoherenceOptions
): boolean {
  const asuEntregada = (asu.estado || "").toLowerCase().includes("entregada");
  return isOrderPairCoherentMeta(
    getDateMeta(asu.fechaIngreso),
    getDateMeta(asu.fechaEntregada),
    asuEntregada,
    getDateMeta(cde.fechaIngreso),
    getDateMeta(cde.fechaEntregada),
    options
  );
}

/**
 * Selecciona entre candidatos ya filtrados por ID/Serial aquel cuya línea de tiempo
 * (fechaIngreso / fechaEntregada) coincide mejor con la orden origen.
 */
export function pickBestChronologicalCandidate<T extends MatchableOrder>(
  source: MatchableOrder,
  candidates: T[],
  usedIds: Set<string> | null,
  sourceIsAsu: boolean,
  options?: ChronoCoherenceOptions
): T | null {
  let best: T | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  const srcIng = getDateMeta(source.fechaIngreso);

  for (const cand of candidates) {
    if (usedIds && usedIds.has(cand.idOrden)) continue;
    const asu = sourceIsAsu ? source : cand;
    const cde = sourceIsAsu ? cand : source;
    if (!isOrderPairChronologicallyCoherent(asu, cde, options)) continue;

    const candIng = getDateMeta(cand.fechaIngreso);
    let penalty = 30;
    if (srcIng.ms !== null && candIng.ms !== null) {
      const signedDays = (candIng.ms - srcIng.ms) / MS_PER_DAY;
      // En flujo normal ASU recibe primero y CDE ingresa el mismo día o pocos días después
      const normalFlow = sourceIsAsu ? signedDays >= -1 : signedDays <= 1;
      penalty = Math.abs(signedDays) + (normalFlow ? 0 : 12);
    }

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = cand;
    }
  }

  return best;
}

function getDateDiffFast(a: CachedDateMeta, b: CachedDateMeta): number | null {
  if (!a.valid || !b.valid || a.ms === null || b.ms === null) return null;
  return Math.abs(Math.round((a.ms - b.ms) / MS_PER_DAY));
}

interface IndexedCand<T extends MatchableOrder> {
  item: T;
  used: boolean;
  exactClient: string;
  baseClient: string;
  isDanesa: boolean;
  esEntregada: boolean;
  cod: string;
  hasModel: boolean;
  ingreso: CachedDateMeta;
  despacho: CachedDateMeta;
}

function buildIndexedCand<T extends MatchableOrder>(item: T): IndexedCand<T> {
  return {
    item,
    used: false,
    exactClient: normalizeText(item.cliente),
    baseClient: normalizeText(stripClientPrefix(item.cliente)),
    isDanesa: isTicketDanesa(item.cliente),
    esEntregada: (item.estado || "").toLowerCase().includes("entregada"),
    cod: (item.codigoProducto || "").trim(),
    hasModel: Boolean(normalizeText(item.modelo)),
    ingreso: getDateMeta(item.fechaIngreso),
    despacho: getDateMeta(item.fechaEntregada),
  };
}

function isIndexedPairCoherent<T extends MatchableOrder, U extends MatchableOrder>(
  source: IndexedCand<T>,
  cand: IndexedCand<U>,
  sourceIsAsu: boolean
): boolean {
  const asu = sourceIsAsu ? source : cand;
  const cde = sourceIsAsu ? cand : source;
  return isOrderPairCoherentMeta(asu.ingreso, asu.despacho, asu.esEntregada, cde.ingreso, cde.despacho);
}

function compactPoolInPlace<T extends MatchableOrder>(pool: IndexedCand<T>[], deadCount: number): void {
  if (pool.length <= 32 || deadCount * 2 < pool.length) return;
  let w = 0;
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].used) {
      pool[w++] = pool[i];
    }
  }
  pool.length = w;
}

/**
 * Busca el mejor candidato para un cliente particular en una sola pasada:
 * - Prioriza coincidencia directa de nombre sobre prefijo "(JC)"
 * - Usa fechas y normalizaciones pre-cacheadas y poda de candidatos ya emparejados
 */
function findBestClientEquipMatch<T extends MatchableOrder>(
  source: IndexedCand<MatchableOrder>,
  candidatesByBaseClient: Map<string, IndexedCand<T>[]>,
  reverseDates: boolean
): { entry: IndexedCand<T>; viaJcFallback: boolean; matchedByCode: boolean } | null {
  if (source.baseClient.length < 4 || source.isDanesa) return null;

  const pool = candidatesByBaseClient.get(source.baseClient);
  if (!pool || pool.length === 0) return null;

  const codSource = source.cod;
  const maxDirectCeiling = codSource ? 150 : 100;

  let bestDirect: IndexedCand<T> | null = null;
  let bestDirectScore = -1;
  let bestDirectByCode = false;

  let bestJc: IndexedCand<T> | null = null;
  let bestJcScore = -1;
  let bestJcByCode = false;

  let deadCount = 0;

  for (let i = 0; i < pool.length; i++) {
    const cand = pool[i];
    if (cand.used) {
      deadCount++;
      continue;
    }
    if (cand.isDanesa) continue;

    if (!isIndexedPairCoherent(source, cand, reverseDates)) continue;

    const diffDias = getDateDiffFast(source.ingreso, cand.ingreso);
    if (diffDias !== null && diffDias > 45) continue;

    const viaJc = source.exactClient !== cand.exactClient;
    const sameCodigo = Boolean(codSource && cand.cod && codSource === cand.cod);
    const equipSim = computeEquipmentSimilarity(
      source.item.marca,
      source.item.modelo,
      cand.item.marca,
      cand.item.modelo
    );

    if ((sameCodigo && equipSim >= 0.45) || equipSim >= 0.72) {
      const score = (sameCodigo ? 50 : 0) + equipSim * 100 - (diffDias !== null ? diffDias * 0.25 : 10);
      if (!viaJc) {
        if (score > bestDirectScore) {
          bestDirectScore = score;
          bestDirect = cand;
          bestDirectByCode = sameCodigo && equipSim < 0.72;
          if (bestDirectScore >= maxDirectCeiling) break;
        }
      } else if (score > bestJcScore) {
        bestJcScore = score;
        bestJc = cand;
        bestJcByCode = sameCodigo && equipSim < 0.72;
      }
    }
  }

  compactPoolInPlace(pool, deadCount);

  if (bestDirect) {
    return { entry: bestDirect, viaJcFallback: false, matchedByCode: bestDirectByCode };
  }
  if (bestJc) {
    return { entry: bestJc, viaJcFallback: true, matchedByCode: bestJcByCode };
  }
  return null;
}

/**
 * Busca el mejor candidato Danesa SA por Código + Similitud de Modelo y fechas próximas
 */
function findBestDanesaMatch<T extends MatchableOrder>(
  source: IndexedCand<MatchableOrder>,
  candidatesByCodigo: Map<string, IndexedCand<T>[]>,
  maxDiffDays: number,
  reverseDates: boolean
): IndexedCand<T> | null {
  const cod = source.cod;
  if (!cod) return null;
  const pool = candidatesByCodigo.get(cod);
  if (!pool || pool.length === 0) return null;

  let bestCand: IndexedCand<T> | null = null;
  let bestScore = -1;
  let deadCount = 0;

  for (let i = 0; i < pool.length; i++) {
    const cand = pool[i];
    if (cand.used) {
      deadCount++;
      continue;
    }

    if (!isIndexedPairCoherent(source, cand, reverseDates)) continue;

    const diffDias = getDateDiffFast(source.ingreso, cand.ingreso);
    if (diffDias !== null && diffDias > maxDiffDays) continue;

    const equipSim = computeEquipmentSimilarity(
      source.item.marca,
      source.item.modelo,
      cand.item.marca,
      cand.item.modelo
    );
    const hasBothModels = source.hasModel && cand.hasModel;
    if (!hasBothModels || equipSim >= 0.65) {
      const score = equipSim * 100 - (diffDias !== null ? diffDias * 0.5 : 10);
      if (score > bestScore) {
        bestScore = score;
        bestCand = cand;
        if (bestScore >= 100) break;
      }
    }
  }

  compactPoolInPlace(pool, deadCount);
  return bestCand;
}

/**
 * Cruza las órdenes de CDE con las de ASU evitando duplicaciones y emparejamientos espurios
 */
export function crossMatchCdeWithAsu(
  cdeTickets: RecepcionCdeTicket[],
  asuTickets: RecepcionTicket[]
): RecepcionCdeTicket[] {
  if (!cdeTickets || cdeTickets.length === 0) return [];
  if (!asuTickets || asuTickets.length === 0) return cdeTickets;

  // Filtrar estrictamente solo órdenes de CDE (>= 100000)
  const realCdeTickets = cdeTickets.filter((c) => {
    const num = parseInt(c.idOrden, 10);
    return isNaN(num) || num >= 100000;
  });

  // Índices de ASU
  const asuBySerial = new Map<string, RecepcionTicket[]>();
  const asuById = new Map<string, RecepcionTicket>();
  const asuEntryById = new Map<string, IndexedCand<RecepcionTicket>>();
  const asuByCodigoDanesa = new Map<string, IndexedCand<RecepcionTicket>[]>();
  const asuByBaseClient = new Map<string, IndexedCand<RecepcionTicket>[]>();
  const asuMentioningId = new Map<string, RecepcionTicket[]>();
  const asuMentioningSerial = buildSerialMentionMap(asuTickets);

  for (const a of asuTickets) {
    const entry = buildIndexedCand(a);
    if (a.idOrden) {
      const cleanId = a.idOrden.trim();
      asuById.set(cleanId, a);
      asuEntryById.set(cleanId, entry);
    }
    const s = normalizeSerial(a.serial);
    if (s) {
      if (!asuBySerial.has(s)) asuBySerial.set(s, []);
      asuBySerial.get(s)!.push(a);
    }
    if (entry.cod && entry.isDanesa) {
      if (!asuByCodigoDanesa.has(entry.cod)) asuByCodigoDanesa.set(entry.cod, []);
      asuByCodigoDanesa.get(entry.cod)!.push(entry);
    }
    if (entry.baseClient.length >= 4 && !entry.isDanesa) {
      if (!asuByBaseClient.has(entry.baseClient)) asuByBaseClient.set(entry.baseClient, []);
      asuByBaseClient.get(entry.baseClient)!.push(entry);
    }
    if (a.mensaje) {
      for (const mentioned of extractOrderIds(a.mensaje)) {
        if (parseInt(mentioned, 10) >= 100000) {
          if (!asuMentioningId.has(mentioned)) asuMentioningId.set(mentioned, []);
          asuMentioningId.get(mentioned)!.push(a);
        }
      }
    }
  }

  // Rastrear órdenes de ASU ya asignadas para evitar que múltiples tickets apunten al mismo
  const matchedAsuIds = new Set<string>();

  return realCdeTickets.map((cde, idx) => {
    let match: RecepcionTicket | null = null;
    let matchReason = "";

    const cdeSerial = normalizeSerial(cde.serial);

    // CRITERIO 1: Serial Físico exacto (prioriza coincidencia cronológica más cercana)
    if (cdeSerial && asuBySerial.has(cdeSerial)) {
      const hit = pickBestChronologicalCandidate(
        cde,
        asuBySerial.get(cdeSerial)!,
        matchedAsuIds,
        false
      );
      if (hit) {
        match = hit;
        matchReason = "Serial Físico";
      }
    }

    // CRITERIO 2: Referencia directa de ID entre mensajes de CDE y ASU
    if (!match && cde.mensaje) {
      const ids = extractOrderIds(cde.mensaje);
      for (const id of ids) {
        if (parseInt(id, 10) < 10000) continue;
        if (asuById.has(id)) {
          const candidate = asuById.get(id)!;
          if (!matchedAsuIds.has(candidate.idOrden) && isOrderPairChronologicallyCoherent(candidate, cde)) {
            match = candidate;
            matchReason = `Ref. en Mensaje (#${id})`;
            break;
          }
        }
      }
    }

    if (!match && cde.idOrden && asuMentioningId.has(cde.idOrden.trim())) {
      const hit = pickBestChronologicalCandidate(
        cde,
        asuMentioningId.get(cde.idOrden.trim())!,
        matchedAsuIds,
        false
      );
      if (hit) {
        match = hit;
        matchReason = `Ref. en Mensaje ASU (#${cde.idOrden})`;
      }
    }

    // CRITERIO 3: Serial mencionado en el Informe/Mensaje de cualquiera de los dos lados (lookup O(1) indexado)
    if (!match) {
      const hit = findSerialMentionMatch(
        cde,
        cdeSerial,
        asuBySerial,
        asuMentioningSerial,
        matchedAsuIds,
        false
      );
      if (hit) {
        match = hit;
        matchReason = "Serial en Informe";
      }
    }

    // CRITERIO 4: Cliente Particular + Equipo/Código (prueba nombre directo y luego prefijo "(JC)")
    if (!match && !(cde.esDanesa || isTicketDanesa(cde.cliente))) {
      const hit = findBestClientEquipMatch(buildIndexedCand(cde), asuByBaseClient, false);
      if (hit) {
        match = hit.entry.item;
        matchReason = hit.viaJcFallback
          ? "Cliente (JC) & Equipo"
          : hit.matchedByCode
            ? "Cliente & Código"
            : "Cliente & Equipo";
      }
    }

    // CRITERIO 5: Mismo Código + Modelo compatible SOLO si cliente es Danesa
    if (!match && (cde.esDanesa || isTicketDanesa(cde.cliente))) {
      const hit = findBestDanesaMatch(buildIndexedCand(cde), asuByCodigoDanesa, 25, false);
      if (hit) {
        match = hit.item;
        matchReason = "Código & Modelo";
      }
    }

    const rowKey = cde.rowKey || getTicketRowKey(cde, idx);

    if (match) {
      matchedAsuIds.add(match.idOrden);
      const matchedEntry = asuEntryById.get(match.idOrden.trim());
      if (matchedEntry) matchedEntry.used = true;
      return {
        ...cde,
        idOrdenAsu: match.idOrden,
        clienteAsu: match.cliente,
        fechaIngresoAsu: match.fechaIngreso,
        estadoAsu: match.estado,
        matchReason,
        rowKey,
      };
    }

    return {
      ...cde,
      rowKey,
    };
  });
}

/**
 * Cruza las órdenes de ASU con las órdenes de CDE (para alimentar vistas desde el lado ASU)
 */
export function crossMatchAsuWithCde(
  asuTickets: RecepcionTicket[],
  cdeTickets: RecepcionCdeTicket[],
  checkins: Record<string, any> = {},
  overrides: Record<string, any> = {},
  manualCrossMatches: Array<{ idOrdenAsu: string; idOrdenCde: string }> = []
): RecepcionTicket[] {
  if (!asuTickets || asuTickets.length === 0) return [];
  if (!cdeTickets || cdeTickets.length === 0) return asuTickets;

  // Filtrar estrictamente solo órdenes de CDE (>= 100000)
  const realCdeTickets = cdeTickets.filter((c) => {
    const num = parseInt(c.idOrden, 10);
    return isNaN(num) || num >= 100000;
  });

  // Mapa de cruces manuales prioritarios confirmados
  const manualAsuToCde = new Map<string, string>();
  if (Array.isArray(manualCrossMatches)) {
    manualCrossMatches.forEach((m) => {
      if (m.idOrdenAsu && m.idOrdenCde) {
        manualAsuToCde.set(m.idOrdenAsu.trim(), m.idOrdenCde.trim());
      }
    });
  }

  // Índices de CDE
  const cdeById = new Map<string, RecepcionCdeTicket>();
  const cdeEntryById = new Map<string, IndexedCand<RecepcionCdeTicket>>();
  const cdeBySerial = new Map<string, RecepcionCdeTicket[]>();
  const cdeByCodigoDanesa = new Map<string, IndexedCand<RecepcionCdeTicket>[]>();
  const cdeByBaseClient = new Map<string, IndexedCand<RecepcionCdeTicket>[]>();
  const cdeMentioningId = new Map<string, RecepcionCdeTicket[]>();
  const cdeMentioningSerial = buildSerialMentionMap(realCdeTickets);

  for (const c of realCdeTickets) {
    const entry = buildIndexedCand(c);
    if (c.esDanesa) entry.isDanesa = true;
    if (c.idOrden) {
      const cleanId = c.idOrden.trim();
      cdeById.set(cleanId, c);
      cdeEntryById.set(cleanId, entry);
    }
    const s = normalizeSerial(c.serial);
    if (s) {
      if (!cdeBySerial.has(s)) cdeBySerial.set(s, []);
      cdeBySerial.get(s)!.push(c);
    }
    if (entry.cod && entry.isDanesa) {
      if (!cdeByCodigoDanesa.has(entry.cod)) cdeByCodigoDanesa.set(entry.cod, []);
      cdeByCodigoDanesa.get(entry.cod)!.push(entry);
    }
    if (entry.baseClient.length >= 4 && !entry.isDanesa) {
      if (!cdeByBaseClient.has(entry.baseClient)) cdeByBaseClient.set(entry.baseClient, []);
      cdeByBaseClient.get(entry.baseClient)!.push(entry);
    }
    if (c.mensaje) {
      for (const mentioned of extractOrderIds(c.mensaje)) {
        const n = parseInt(mentioned, 10);
        if (n >= 10000 && n < 100000) {
          if (!cdeMentioningId.has(mentioned)) cdeMentioningId.set(mentioned, []);
          cdeMentioningId.get(mentioned)!.push(c);
        }
      }
    }
  }

  const matchedCdeIds = new Set<string>();

  return asuTickets.map((asu) => {
    const asuSerial = normalizeSerial(asu.serial);
    let match: RecepcionCdeTicket | null = null;

    // 0. Cruce Manual prioritario (descarta enlaces históricamente imposibles por fechas invertidas)
    const manualCdeId = manualAsuToCde.get(asu.idOrden);
    if (manualCdeId && cdeById.has(manualCdeId)) {
      const manualCand = cdeById.get(manualCdeId)!;
      if (
        !matchedCdeIds.has(manualCand.idOrden) &&
        isOrderPairChronologicallyCoherent(asu, manualCand, {
          maxPreIngresoDays: 14,
          maxPreDespachoDays: 7,
          maxPostEntregaDays: 7,
        })
      ) {
        match = manualCand;
      }
    }

    // 0.1 Overrides guardados
    if (!match && overrides) {
      const ov = overrides[asu.idOrden] || overrides[`ASU_${asu.idOrden}`];
      if (ov?.idOrdenCde && cdeById.has(ov.idOrdenCde.trim())) {
        const ovCand = cdeById.get(ov.idOrdenCde.trim())!;
        if (
          !matchedCdeIds.has(ovCand.idOrden) &&
          isOrderPairChronologicallyCoherent(asu, ovCand, {
            maxPreIngresoDays: 14,
            maxPreDespachoDays: 7,
            maxPostEntregaDays: 7,
          })
        ) {
          match = ovCand;
        }
      }
    }

    // CRITERIO 1: Serial Físico exacto (prioriza el envío CDE cronológicamente más cercano a esta orden ASU)
    if (!match && asuSerial && cdeBySerial.has(asuSerial)) {
      const hit = pickBestChronologicalCandidate(
        asu,
        cdeBySerial.get(asuSerial)!,
        matchedCdeIds,
        true
      );
      if (hit) {
        match = hit;
      }
    }

    // CRITERIO 2: Referencia directa de ID de orden en Mensaje de ASU o CDE
    if (!match && asu.mensaje) {
      const ids = extractOrderIds(asu.mensaje);
      for (const id of ids) {
        if (parseInt(id, 10) < 10000) continue;
        if (cdeById.has(id)) {
          const cand = cdeById.get(id)!;
          if (!matchedCdeIds.has(cand.idOrden) && isOrderPairChronologicallyCoherent(asu, cand)) {
            match = cand;
            break;
          }
        }
      }
    }

    if (!match && asu.idOrden && cdeMentioningId.has(asu.idOrden.trim())) {
      const hit = pickBestChronologicalCandidate(
        asu,
        cdeMentioningId.get(asu.idOrden.trim())!,
        matchedCdeIds,
        true
      );
      if (hit) {
        match = hit;
      }
    }

    // CRITERIO 3: Serial mencionado en el Informe/Mensaje de cualquiera de los dos lados (lookup O(1) indexado)
    if (!match) {
      const hit = findSerialMentionMatch(
        asu,
        asuSerial,
        cdeBySerial,
        cdeMentioningSerial,
        matchedCdeIds,
        true
      );
      if (hit) {
        match = hit;
      }
    }

    // CRITERIO 4: Mismo Cliente Particular + Equipo/Código (prueba directo y luego prefijo "(JC)")
    if (!match && !isTicketDanesa(asu.cliente)) {
      const hit = findBestClientEquipMatch(buildIndexedCand(asu), cdeByBaseClient, true);
      if (hit) {
        match = hit.entry.item;
      }
    }

    // CRITERIO 5: Mismo Código + Modelo compatible SOLO si cliente es Danesa SA
    if (!match && isTicketDanesa(asu.cliente)) {
      const hit = findBestDanesaMatch(buildIndexedCand(asu), cdeByCodigoDanesa, 30, true);
      if (hit) {
        match = hit.item;
      }
    }

    const esEntregadaAsu = (asu.estado || "").toLowerCase().includes("entregada");

    // Verificar si ya fue confirmado en depósito (Checkin)
    // Una orden ASU ya entregada al cliente nunca debe heredar un checkin activo desde CDE ni figurar en Listo Retiro
    const checkinInfo =
      (checkins &&
        (checkins[asu.idOrden] ||
          (!esEntregadaAsu && match && (checkins[match.idOrden] || checkins[match.rowKey || ""])))) ||
      null;
    const isRecibido =
      !esEntregadaAsu &&
      Boolean(asu.recibidoEnDeposito || (checkinInfo && checkinInfo.recibido));
    const fechaRecibido = esEntregadaAsu
      ? asu.fechaRecibidoDeposito || ""
      : checkinInfo?.fecha || asu.fechaRecibidoDeposito || (match && match.fechaRecibidoDeposito) || "";

    if (match) {
      matchedCdeIds.add(match.idOrden);
      const matchedEntry = cdeEntryById.get(match.idOrden.trim());
      if (matchedEntry) matchedEntry.used = true;

      // Verificación de Despacho e Ingreso en CDE
      const tieneDespachoValido =
        isFechaValida(match.fechaEntregada) &&
        isDespachoCoherente(asu.fechaIngreso, match.fechaEntregada);
      const tieneIngresoValido = isFechaValida(match.fechaIngreso);

      const enCamino = !isRecibido && !esEntregadaAsu && tieneDespachoValido;
      const ingresadoEnCde = !isRecibido && !esEntregadaAsu && !tieneDespachoValido && tieneIngresoValido;

      return {
        ...asu,
        idOrdenCde: match.idOrden,
        estadoCde: match.estado,
        fechaIngresoCde: match.fechaIngreso,
        fechaDespachoCde: match.fechaEntregada,
        recibidoEnDeposito: isRecibido,
        fechaRecibidoDeposito: fechaRecibido,
        enCamino,
        ingresadoEnCde,
      };
    }

    return {
      ...asu,
      recibidoEnDeposito: isRecibido,
      fechaRecibidoDeposito: fechaRecibido,
      enCamino: false,
      ingresadoEnCde: false,
    };
  });
}

/**
 * Construye la lista maestra unificada para SATI ASU - CDE:
 * 1. Danesa SA (Nuestra Sucursal): Órdenes de Danesa SA de ASU con número de orden ASU (#29403+)
 *    como número principal y abajo la orden CDE (#125000+).
 * 2. Clientes ASU: Órdenes de clientes directos de Asunción (nada de Danesa SA, órdenes #29403+).
 * 3. Clientes CDE: Órdenes de clientes propios de Ciudad del Este (órdenes #125000+).
 */
export function buildUnifiedSatiList(
  cdeTickets: RecepcionCdeTicket[],
  asuTickets: RecepcionTicket[],
  checkins: Record<string, any> = {},
  overrides: Record<string, any> = {},
  manualCrossMatches: Array<{ idOrdenAsu: string; idOrdenCde: string }> = []
): RecepcionCdeTicket[] {
  // Asegurar que solo participen órdenes reales de CDE (>= 100000)
  const cleanCdeTickets = (cdeTickets || []).filter((c) => {
    const num = parseInt(c.idOrden, 10);
    return isNaN(num) || num >= 100000;
  });

  // Índices rápidos por ID para hidratar fechas/clientes cruzados en ambos sentidos
  const asuById = new Map<string, RecepcionTicket>();
  for (const a of asuTickets || []) {
    if (a.idOrden) asuById.set(a.idOrden.trim(), a);
  }
  const cdeById = new Map<string, RecepcionCdeTicket>();
  for (const c of cleanCdeTickets) {
    if (c.idOrden) cdeById.set(c.idOrden.trim(), c);
  }

  // Mapa de cruces manuales prioritarios confirmados por el usuario
  const manualCdeToAsu = new Map<string, string>();
  const manualAsuToCde = new Map<string, string>();
  if (Array.isArray(manualCrossMatches)) {
    manualCrossMatches.forEach((m) => {
      if (m.idOrdenAsu && m.idOrdenCde) {
        manualAsuToCde.set(m.idOrdenAsu.trim(), m.idOrdenCde.trim());
        manualCdeToAsu.set(m.idOrdenCde.trim(), m.idOrdenAsu.trim());
      }
    });
  }

  // 1. Cruzar CDE con ASU
  const enrichedCde = crossMatchCdeWithAsu(cleanCdeTickets, asuTickets);

  // Mapa de CDE indexado por ID de Orden de ASU emparejada
  const cdeByAsuId = new Map<string, RecepcionCdeTicket>();
  const cdeEmparejadosIds = new Set<string>();

  enrichedCde.forEach((c) => {
    // Si hay cruce manual para esta orden CDE, priorizarlo e hidratar sus datos de ASU
    const manualAsuId = manualCdeToAsu.get(c.idOrden);
    if (manualAsuId) {
      const linkedAsu = asuById.get(manualAsuId);
      c.idOrdenAsu = manualAsuId;
      c.matchReason = "Cruce Manual Confirmado";
      if (linkedAsu) {
        c.clienteAsu = linkedAsu.cliente || c.clienteAsu;
        c.fechaIngresoAsu = linkedAsu.fechaIngreso || c.fechaIngresoAsu;
        c.estadoAsu = linkedAsu.estado || c.estadoAsu;
      }
      cdeByAsuId.set(manualAsuId, c);
      cdeEmparejadosIds.add(c.idOrden);
    } else if (c.idOrdenAsu) {
      const linkedAsu = asuById.get(c.idOrdenAsu.trim());
      if (linkedAsu) {
        c.clienteAsu = c.clienteAsu || linkedAsu.cliente;
        c.fechaIngresoAsu = c.fechaIngresoAsu || linkedAsu.fechaIngreso;
        c.estadoAsu = c.estadoAsu || linkedAsu.estado;
      }
      cdeByAsuId.set(c.idOrdenAsu, c);
      cdeEmparejadosIds.add(c.idOrden);
    }
  });

  const unifiedList: RecepcionCdeTicket[] = [];

  // Helper para extraer estado y fecha de checkin (solo confirmado si el operario lo registró físicamente)
  const getCheckinInfo = (
    rowKey: string,
    fallbackRecibido?: boolean,
    fallbackFecha?: string,
    stAsu?: string,
    stCde?: string,
    idOrden?: string,
    idOrdenAsu?: string,
    idOrdenCde?: string
  ) => {
    const val =
      checkins[rowKey] ??
      (idOrden ? checkins[idOrden] : undefined) ??
      (idOrdenAsu ? checkins[idOrdenAsu] : undefined) ??
      (idOrdenCde ? checkins[idOrdenCde] : undefined);
    if (typeof val === 'boolean') {
      return { recibido: val, fecha: fallbackFecha || '' };
    }
    if (val && typeof val === 'object') {
      return {
        recibido: Boolean(val.recibido),
        fecha: val.fecha || fallbackFecha || '',
      };
    }

    // Solo si viene explícitamente confirmado como recibido desde la base de datos (sati_checkins)
    if (fallbackRecibido) {
      return {
        recibido: true,
        fecha: fallbackFecha || '',
      };
    }

    return {
      recibido: false,
      fecha: '',
    };
  };

  // 2. Procesar las órdenes de ASU:
  // - Danesa SA (envíos de nuestra sucursal): Nº Orden ASU arriba, CDE abajo (o Pendiente si no tiene cruce).
  // - Clientes ASU: clientes directos de Asunción.
  asuTickets.forEach((asu, idx) => {
    const esDanesa = isTicketDanesa(asu.cliente);

    // Verificar si hay cruce manual prioritario definido por el usuario
    const manualCdeId = manualAsuToCde.get(asu.idOrden);
    const manualCdeTicket = manualCdeId
      ? cleanCdeTickets.find((c) => c.idOrden === manualCdeId) || {
          idOrden: manualCdeId,
          codigoProducto: asu.codigoProducto || "",
          cliente: asu.cliente,
          mensaje: "",
          fechaIngreso: "",
          fechaEntregada: "",
          estado: "En Asignacion",
          tipoComponente: asu.tipoComponente || "",
          modelo: asu.modelo || "",
          marca: asu.marca || "",
          serial: asu.serial || "",
          esDanesa,
          matchReason: "Cruce Manual Confirmado",
        }
      : undefined;

    const rawMatchedCde = cdeByAsuId.get(asu.idOrden);

    // Validación de coherencia cronológica y rango de CDE:
    // La orden de CDE debe ser >= 100000 y el despacho debe ser posterior o igual al ingreso en ASU.
    const esCdeValido = rawMatchedCde && parseInt(rawMatchedCde.idOrden, 10) >= 100000;
    const esCronologicamenteCoherente =
      Boolean(esCdeValido && isDespachoCoherente(asu.fechaIngreso, rawMatchedCde?.fechaEntregada));
    const matchedCde = manualCdeTicket || (esCronologicamenteCoherente ? rawMatchedCde : undefined);

    if (manualCdeTicket) {
      cdeEmparejadosIds.add(manualCdeTicket.idOrden);
    }

    const rowKey = (asu as any).rowKey || `ASU_${asu.idOrden}_${asu.codigoProducto || ""}_${asu.serial || ""}_${idx}`;

    // Fecha de despacho CDE (solo si el cruce es legítimo y cronológicamente coherente)
    const fechaDespachoCde = matchedCde?.fechaEntregada || "";

    // Fecha de ingreso en ASU (nuestra recepción)
    const fechaIngreso = asu.fechaIngreso || "";

    const checkin = getCheckinInfo(
      rowKey,
      asu.recibidoEnDeposito,
      (asu as any).fechaRecibidoDeposito || fechaDespachoCde || asu.fechaEntregada,
      asu.estado,
      matchedCde?.estado,
      asu.idOrden,
      asu.idOrden,
      matchedCde?.idOrden
    );

    // Días de taller (solo si hay fecha de despacho legítima)
    const dias = fechaDespachoCde ? calcularDiasResolucion(fechaIngreso, fechaDespachoCde) : null;

    unifiedList.push({
      idOrden: asu.idOrden,                     // Nº Orden ASU principal (29403 en adelante)
      codigoProducto: asu.codigoProducto || matchedCde?.codigoProducto || "",
      cliente: asu.cliente,
      mensaje: matchedCde?.mensaje || asu.mensaje || "",
      fechaIngreso,
      fechaIngresoAsu: asu.fechaIngreso || "",
      fechaIngresoCde: matchedCde?.fechaIngreso || "",
      fechaEntregada: fechaDespachoCde,         // Despacho CDE legítimo o vacío
      fechaEntregadaAsu: isFechaValida(asu.fechaEntregada) ? asu.fechaEntregada : "",
      fechaVenta: asu.fechaVenta || matchedCde?.fechaVenta || "",
      estado: asu.estado || "En Asignacion",
      tipoComponente: asu.tipoComponente || matchedCde?.tipoComponente || "",
      marca: asu.marca || matchedCde?.marca || "",
      modelo: asu.modelo || matchedCde?.modelo || "",
      serial: asu.serial || matchedCde?.serial || "",
      diasResolucion: dias,
      esDanesa,
      recibidoEnDeposito: checkin.recibido,
      fechaRecibidoDeposito: checkin.fecha,
      idOrdenAsu: asu.idOrden,
      idOrdenCde: matchedCde?.idOrden,           // Nº Orden CDE vinculado
      clienteAsu: asu.cliente,
      estadoAsu: asu.estado,
      estadoCde: matchedCde?.estado,
      matchReason: manualCdeTicket ? "Cruce Manual Confirmado" : matchedCde?.matchReason,
      origen: "ASU",
      rowKey,
    });
  });

  // 3. Agregar las órdenes de CDE (Clientes CDE: 125000 en adelante)
  // Para Danesa SA: solo las que no hayan cruzado con ASU para no duplicar el envío de sucursal
  enrichedCde.forEach((cde, idx) => {
    const esDanesaCde = cde.esDanesa || isTicketDanesa(cde.cliente);
    if (esDanesaCde && cdeEmparejadosIds.has(cde.idOrden)) {
      // Las de Danesa SA ya están consolidadas en la fila de envío de la sucursal ASU
      return;
    }

    const linkedAsu = cde.idOrdenAsu ? asuById.get(cde.idOrdenAsu.trim()) : undefined;
    const rowKey = cde.rowKey || `CDE_${cde.idOrden}_${cde.codigoProducto || ""}_${cde.serial || ""}_${idx}`;
    const checkin = getCheckinInfo(
      rowKey,
      cde.recibidoEnDeposito,
      cde.fechaRecibidoDeposito || cde.fechaEntregada,
      linkedAsu?.estado,
      cde.estado,
      cde.idOrden,
      cde.idOrdenAsu,
      cde.idOrden
    );

    unifiedList.push({
      ...cde,
      fechaIngresoAsu: cde.fechaIngresoAsu || linkedAsu?.fechaIngreso || "",
      fechaIngresoCde: cde.fechaIngreso || "",
      fechaEntregadaAsu: (linkedAsu && isFechaValida(linkedAsu.fechaEntregada)) ? linkedAsu.fechaEntregada : cde.fechaEntregadaAsu || "",
      clienteAsu: cde.clienteAsu || linkedAsu?.cliente || "",
      estadoAsu: cde.estadoAsu || linkedAsu?.estado || "",
      estadoCde: cde.estado,
      idOrdenCde: cde.idOrden,
      idOrdenAsu: cde.idOrdenAsu,
      recibidoEnDeposito: checkin.recibido,
      fechaRecibidoDeposito: checkin.fecha,
      origen: "CDE",
      rowKey,
    });
  });

  // 4. Aplicar overrides manuales guardados de órdenes y fechas
  const finalList =
    overrides && Object.keys(overrides).length > 0
      ? unifiedList.map((t) => {
          const ov =
            overrides[t.rowKey || ""] ||
            (t.idOrden && overrides[t.idOrden]) ||
            (t.idOrdenAsu && overrides[t.idOrdenAsu]) ||
            (t.idOrdenCde && overrides[t.idOrdenCde]);
          if (!ov) return t;

          const resolvedAsuId = ov.idOrdenAsu || t.idOrdenAsu;
          const resolvedCdeId = ov.idOrdenCde || t.idOrdenCde;
          const asuRef = resolvedAsuId ? asuById.get(resolvedAsuId.trim()) : undefined;
          const cdeRef = resolvedCdeId ? cdeById.get(resolvedCdeId.trim()) : undefined;

          const newIngresoAsu = ov.fechaIngresoAsu || t.fechaIngresoAsu || asuRef?.fechaIngreso || "";
          const newIngresoCde = ov.fechaIngresoCde || t.fechaIngresoCde || cdeRef?.fechaIngreso || "";
          const newDespacho =
            ov.fechaDespachoCde !== undefined
              ? ov.fechaDespachoCde
              : t.fechaEntregada || cdeRef?.fechaEntregada || "";
          const newRecibido = ov.fechaRecibidoAsu ? ov.fechaRecibidoAsu : t.fechaRecibidoDeposito;
          const newDias = newDespacho
            ? calcularDiasResolucion(newIngresoAsu || newIngresoCde || t.fechaIngreso, newDespacho)
            : t.diasResolucion;

          return {
            ...t,
            idOrdenAsu: resolvedAsuId,
            idOrdenCde: resolvedCdeId,
            clienteAsu: t.clienteAsu || asuRef?.cliente,
            estadoAsu: t.estadoAsu || asuRef?.estado,
            fechaIngresoAsu: newIngresoAsu,
            fechaIngresoCde: newIngresoCde,
            fechaEntregada: newDespacho,
            fechaRecibidoDeposito: newRecibido,
            recibidoEnDeposito: ov.fechaRecibidoAsu ? true : t.recibidoEnDeposito,
            diasResolucion: newDias,
          };
        })
      : unifiedList;

  return finalList;
}
