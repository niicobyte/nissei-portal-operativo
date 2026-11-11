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
  const combRawA = getCombinedEquipmentRaw(marcaA, modeloA);
  const combRawB = getCombinedEquipmentRaw(marcaB, modeloB);
  const normCombA = normalizeText(combRawA);
  const normCombB = normalizeText(combRawB);
  const normModA = normalizeText(modeloA);
  const normModB = normalizeText(modeloB);

  if (!normCombA || !normCombB) return 0;
  if (normCombA === normCombB || (normModA && normModB && normModA === normModB)) {
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

  return Math.max(containmentScore, charSimComb, charSimMod, tokenScore);
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
  marca?: string;
  modelo?: string;
  serial?: string;
}

function getDateDiffOrNull(f1?: string, f2?: string): number | null {
  if (!isFechaValida(f1) || !isFechaValida(f2)) return null;
  const d = getDiasDiferenciaFechas(f1, f2);
  return d === 9999 ? null : d;
}

/**
 * Busca el mejor candidato para un cliente particular usando:
 * - Pass 1: nombre de cliente directo ("de una")
 * - Pass 2: probando "(JC) " al principio si no encontró directo
 * Tolerando diferencias de mayúsculas/minúsculas o pequeños typos en marca/modelo (ej. KRAB vs Krab, KBHDV34 vs KBDV34).
 */
function findBestClientEquipMatch<T extends MatchableOrder>(
  source: MatchableOrder,
  candidatesByBaseClient: Map<string, T[]>,
  usedIds: Set<string>,
  getAsuAndCdeDates: (cand: T) => { asuIngreso?: string; cdeDespacho?: string }
): { match: T; viaJcFallback: boolean; matchedByCode: boolean } | null {
  const sourceBase = normalizeText(stripClientPrefix(source.cliente));
  if (sourceBase.length < 4 || isTicketDanesa(source.cliente)) return null;

  const pool = candidatesByBaseClient.get(sourceBase) || [];
  if (pool.length === 0) return null;

  const codSource = (source.codigoProducto || "").trim();

  for (const allowJcFallback of [false, true]) {
    let bestCand: T | null = null;
    let bestScore = -1;
    let bestByCode = false;

    for (const cand of pool) {
      if (usedIds.has(cand.idOrden) || isTicketDanesa(cand.cliente)) continue;

      const clientCheck = clientsMatch(source.cliente, cand.cliente);
      if (!clientCheck.matched || clientCheck.viaJcFallback !== allowJcFallback) continue;

      const { asuIngreso, cdeDespacho } = getAsuAndCdeDates(cand);
      if (!isDespachoCoherente(asuIngreso, cdeDespacho)) continue;

      const diffDias = getDateDiffOrNull(source.fechaIngreso, cand.fechaIngreso);
      if (diffDias !== null && diffDias > 45) continue;

      const codCand = (cand.codigoProducto || "").trim();
      const sameCodigo = Boolean(codSource && codCand && codSource === codCand);
      const equipSim = computeEquipmentSimilarity(source.marca, source.modelo, cand.marca, cand.modelo);

      if ((sameCodigo && equipSim >= 0.45) || equipSim >= 0.72) {
        const score = (sameCodigo ? 50 : 0) + equipSim * 100 - (diffDias !== null ? diffDias * 0.25 : 10);
        if (score > bestScore) {
          bestScore = score;
          bestCand = cand;
          bestByCode = sameCodigo && equipSim < 0.72;
        }
      }
    }

    if (bestCand) {
      return { match: bestCand, viaJcFallback: allowJcFallback, matchedByCode: bestByCode };
    }
  }

  return null;
}

/**
 * Busca el mejor candidato Danesa SA por Código + Similitud de Modelo y fechas próximas
 */
function findBestDanesaMatch<T extends MatchableOrder>(
  source: MatchableOrder,
  candidatesByCodigo: Map<string, T[]>,
  usedIds: Set<string>,
  maxDiffDays: number,
  getAsuAndCdeDates: (cand: T) => { asuIngreso?: string; cdeDespacho?: string }
): T | null {
  const cod = (source.codigoProducto || "").trim();
  if (!cod) return null;
  const pool = candidatesByCodigo.get(cod) || [];

  let bestCand: T | null = null;
  let bestScore = -1;

  for (const cand of pool) {
    if (usedIds.has(cand.idOrden)) continue;
    const { asuIngreso, cdeDespacho } = getAsuAndCdeDates(cand);
    if (!isDespachoCoherente(asuIngreso, cdeDespacho)) continue;

    const diffDias = getDateDiffOrNull(source.fechaIngreso, cand.fechaIngreso);
    if (diffDias !== null && diffDias > maxDiffDays) continue;

    const equipSim = computeEquipmentSimilarity(source.marca, source.modelo, cand.marca, cand.modelo);
    const hasBothModels = Boolean(normalizeText(source.modelo) && normalizeText(cand.modelo));
    if (!hasBothModels || equipSim >= 0.65) {
      const score = equipSim * 100 - (diffDias !== null ? diffDias * 0.5 : 10);
      if (score > bestScore) {
        bestScore = score;
        bestCand = cand;
      }
    }
  }

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
  const asuByCodigoDanesa = new Map<string, RecepcionTicket[]>();
  const asuByBaseClient = new Map<string, RecepcionTicket[]>();
  const asuMentioningId = new Map<string, RecepcionTicket[]>();

  for (const a of asuTickets) {
    if (a.idOrden) {
      asuById.set(a.idOrden.trim(), a);
    }
    const s = normalizeSerial(a.serial);
    if (s) {
      if (!asuBySerial.has(s)) asuBySerial.set(s, []);
      asuBySerial.get(s)!.push(a);
    }
    const cod = (a.codigoProducto || "").trim();
    if (cod && isTicketDanesa(a.cliente)) {
      if (!asuByCodigoDanesa.has(cod)) asuByCodigoDanesa.set(cod, []);
      asuByCodigoDanesa.get(cod)!.push(a);
    }
    const baseClient = normalizeText(stripClientPrefix(a.cliente));
    if (baseClient.length >= 4 && !isTicketDanesa(a.cliente)) {
      if (!asuByBaseClient.has(baseClient)) asuByBaseClient.set(baseClient, []);
      asuByBaseClient.get(baseClient)!.push(a);
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

    // CRITERIO 1: Serial Físico exacto (con validación de coherencia cronológica)
    if (cdeSerial && asuBySerial.has(cdeSerial)) {
      const candidates = asuBySerial.get(cdeSerial)!;
      for (const cand of candidates) {
        if (matchedAsuIds.has(cand.idOrden)) continue;
        if (isDespachoCoherente(cand.fechaIngreso, cde.fechaEntregada)) {
          match = cand;
          matchReason = "Serial Físico";
          break;
        }
      }
    }

    // CRITERIO 2: Referencia directa de ID entre mensajes de CDE y ASU
    if (!match && cde.mensaje) {
      const ids = extractOrderIds(cde.mensaje);
      for (const id of ids) {
        if (parseInt(id, 10) < 10000) continue;
        if (asuById.has(id)) {
          const candidate = asuById.get(id)!;
          if (!matchedAsuIds.has(candidate.idOrden) && isDespachoCoherente(candidate.fechaIngreso, cde.fechaEntregada)) {
            match = candidate;
            matchReason = `Ref. en Mensaje (#${id})`;
            break;
          }
        }
      }
    }

    if (!match && cde.idOrden && asuMentioningId.has(cde.idOrden.trim())) {
      for (const candidate of asuMentioningId.get(cde.idOrden.trim())!) {
        if (!matchedAsuIds.has(candidate.idOrden) && isDespachoCoherente(candidate.fechaIngreso, cde.fechaEntregada)) {
          match = candidate;
          matchReason = `Ref. en Mensaje ASU (#${cde.idOrden})`;
          break;
        }
      }
    }

    // CRITERIO 3: Serial de CDE mencionado en el Mensaje de ASU
    if (!match && cdeSerial && cdeSerial.length >= 6) {
      for (const a of asuTickets) {
        if (matchedAsuIds.has(a.idOrden)) continue;
        if (a.mensaje && a.mensaje.toUpperCase().includes(cdeSerial)) {
          if (isDespachoCoherente(a.fechaIngreso, cde.fechaEntregada)) {
            match = a;
            matchReason = "Serial en Informe";
            break;
          }
        }
      }
    }

    // CRITERIO 4: Cliente Particular + Equipo/Código (prueba nombre directo y luego prefijo "(JC)")
    if (!match && !(cde.esDanesa || isTicketDanesa(cde.cliente))) {
      const hit = findBestClientEquipMatch(cde, asuByBaseClient, matchedAsuIds, (cand) => ({
        asuIngreso: cand.fechaIngreso,
        cdeDespacho: cde.fechaEntregada,
      }));
      if (hit) {
        match = hit.match;
        matchReason = hit.viaJcFallback
          ? "Cliente (JC) & Equipo"
          : hit.matchedByCode
            ? "Cliente & Código"
            : "Cliente & Equipo";
      }
    }

    // CRITERIO 5: Mismo Código + Modelo compatible SOLO si cliente es Danesa
    if (!match && (cde.esDanesa || isTicketDanesa(cde.cliente))) {
      const hit = findBestDanesaMatch(cde, asuByCodigoDanesa, matchedAsuIds, 25, (cand) => ({
        asuIngreso: cand.fechaIngreso,
        cdeDespacho: cde.fechaEntregada,
      }));
      if (hit) {
        match = hit;
        matchReason = "Código & Modelo";
      }
    }

    const rowKey = cde.rowKey || getTicketRowKey(cde, idx);

    if (match) {
      matchedAsuIds.add(match.idOrden);
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
  const cdeBySerial = new Map<string, RecepcionCdeTicket[]>();
  const cdeByCodigoDanesa = new Map<string, RecepcionCdeTicket[]>();
  const cdeByBaseClient = new Map<string, RecepcionCdeTicket[]>();
  const cdeMentioningId = new Map<string, RecepcionCdeTicket[]>();

  for (const c of realCdeTickets) {
    if (c.idOrden) cdeById.set(c.idOrden.trim(), c);
    const s = normalizeSerial(c.serial);
    if (s) {
      if (!cdeBySerial.has(s)) cdeBySerial.set(s, []);
      cdeBySerial.get(s)!.push(c);
    }
    const cod = (c.codigoProducto || "").trim();
    if (cod && (c.esDanesa || isTicketDanesa(c.cliente))) {
      if (!cdeByCodigoDanesa.has(cod)) cdeByCodigoDanesa.set(cod, []);
      cdeByCodigoDanesa.get(cod)!.push(c);
    }
    const baseClient = normalizeText(stripClientPrefix(c.cliente));
    if (baseClient.length >= 4 && !(c.esDanesa || isTicketDanesa(c.cliente))) {
      if (!cdeByBaseClient.has(baseClient)) cdeByBaseClient.set(baseClient, []);
      cdeByBaseClient.get(baseClient)!.push(c);
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

    // 0. Cruce Manual prioritario
    const manualCdeId = manualAsuToCde.get(asu.idOrden);
    if (manualCdeId && cdeById.has(manualCdeId)) {
      match = cdeById.get(manualCdeId)!;
    }

    // 0.1 Overrides guardados
    if (!match && overrides) {
      const ov = overrides[asu.idOrden] || overrides[`ASU_${asu.idOrden}`];
      if (ov?.idOrdenCde && cdeById.has(ov.idOrdenCde.trim())) {
        match = cdeById.get(ov.idOrdenCde.trim())!;
      }
    }

    // CRITERIO 1: Serial Físico exacto (con validación de coherencia cronológica)
    if (!match && asuSerial && cdeBySerial.has(asuSerial)) {
      const candidates = cdeBySerial.get(asuSerial)!;
      for (const cand of candidates) {
        if (matchedCdeIds.has(cand.idOrden)) continue;
        if (isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
          match = cand;
          break;
        }
      }
    }

    // CRITERIO 2: Referencia directa de ID de orden en Mensaje de ASU o CDE
    if (!match && asu.mensaje) {
      const ids = extractOrderIds(asu.mensaje);
      for (const id of ids) {
        if (parseInt(id, 10) < 10000) continue;
        if (cdeById.has(id)) {
          const cand = cdeById.get(id)!;
          if (!matchedCdeIds.has(cand.idOrden) && isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
            match = cand;
            break;
          }
        }
      }
    }

    if (!match && asu.idOrden && cdeMentioningId.has(asu.idOrden.trim())) {
      for (const cand of cdeMentioningId.get(asu.idOrden.trim())!) {
        if (!matchedCdeIds.has(cand.idOrden) && isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
          match = cand;
          break;
        }
      }
    }

    // CRITERIO 3: Serial de ASU mencionado en el Informe/Mensaje de CDE
    if (!match && asuSerial && asuSerial.length >= 6) {
      for (const c of realCdeTickets) {
        if (matchedCdeIds.has(c.idOrden)) continue;
        if (c.mensaje && c.mensaje.toUpperCase().includes(asuSerial)) {
          if (isDespachoCoherente(asu.fechaIngreso, c.fechaEntregada)) {
            match = c;
            break;
          }
        }
      }
    }

    // CRITERIO 4: Mismo Cliente Particular + Equipo/Código (prueba directo y luego prefijo "(JC)")
    if (!match && !isTicketDanesa(asu.cliente)) {
      const hit = findBestClientEquipMatch(asu, cdeByBaseClient, matchedCdeIds, (cand) => ({
        asuIngreso: asu.fechaIngreso,
        cdeDespacho: cand.fechaEntregada,
      }));
      if (hit) {
        match = hit.match;
      }
    }

    // CRITERIO 5: Mismo Código + Modelo compatible SOLO si cliente es Danesa SA
    if (!match && isTicketDanesa(asu.cliente)) {
      const hit = findBestDanesaMatch(asu, cdeByCodigoDanesa, matchedCdeIds, 30, (cand) => ({
        asuIngreso: asu.fechaIngreso,
        cdeDespacho: cand.fechaEntregada,
      }));
      if (hit) {
        match = hit;
      }
    }

    // Verificar si ya fue confirmado en depósito (Checkin)
    const checkinInfo =
      (checkins && (checkins[asu.idOrden] || (match && (checkins[match.idOrden] || checkins[match.rowKey || ''])))) ||
      null;
    const isRecibido = Boolean(
      asu.recibidoEnDeposito || (checkinInfo && checkinInfo.recibido)
    );
    const fechaRecibido =
      checkinInfo?.fecha || asu.fechaRecibidoDeposito || (match && match.fechaRecibidoDeposito) || "";

    const esEntregadaAsu = (asu.estado || "").toLowerCase().includes("entregada");

    if (match) {
      matchedCdeIds.add(match.idOrden);

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
      fechaVenta: asu.fechaVenta || matchedCde?.fechaVenta || "",
      estado: matchedCde?.estado || asu.estado || "En Asignacion",
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
      clienteAsu: cde.clienteAsu || linkedAsu?.cliente || "",
      estadoAsu: cde.estadoAsu || linkedAsu?.estado || "",
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
