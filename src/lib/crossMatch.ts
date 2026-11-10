/**
 * Motor de Cruce Inteligente de Datos SATI (ASU ↔ CDE)
 * Permite vincular automáticamente las órdenes de Asunción (ej. #32445)
 * con las órdenes correspondientes de Casa Matriz CDE (ej. #125658),
 * guiándose por las columnas compartidas:
 * - Serial Físico (identificador primordial)
 * - Código de Producto (SKU)
 * - Marca y Modelo de Hardware
 * - Referencias en Mensajes de Servicio
 * - Fechas y clientes
 */

import { RecepcionTicket } from "@/data/recepcionData";
import { RecepcionCdeTicket } from "@/data/recepcionCdeData";

export interface CruceInfo {
  idOrdenAsu: string;
  clienteAsu: string;
  fechaIngresoAsu: string;
  estadoAsu: string;
  matchReason: string;
  matchScore: number;
}

/**
 * Normaliza un número de serie físico descartando valores genéricos
 */
export function normalizeSerial(serial?: string): string {
  if (!serial) return "";
  const s = serial.trim().toUpperCase().replace(/[\s\-_/\\.:]/g, "");
  if (
    !s ||
    s === "0" ||
    s === "SINSERIAL" ||
    s === "SN" ||
    s === "NA" ||
    s === "NOTIENE" ||
    s === "SINNUMERO" ||
    s === "SSERIAL" ||
    s === "NOPOSEE" ||
    s === "DEFAULT" ||
    s.length < 4
  ) {
    return "";
  }
  return s;
}

/**
 * Normaliza texto para comparaciones de modelo/marca
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
 * Extrae números de orden posibles (4 a 6 dígitos) de un mensaje
 */
function extractOrderIds(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(/\b\d{4,6}\b/g);
  return matches ? matches : [];
}

/**
 * Cruza las órdenes de CDE con las órdenes de ASU y devuelve los tickets enriquecidos
 */
export function crossMatchCdeWithAsu(
  cdeTickets: RecepcionCdeTicket[],
  asuTickets: RecepcionTicket[]
): RecepcionCdeTicket[] {
  if (!cdeTickets || cdeTickets.length === 0) return [];
  if (!asuTickets || asuTickets.length === 0) return cdeTickets;

  // 1. Índice por Serial Físico Normalizado
  const asuBySerial = new Map<string, RecepcionTicket>();
  // 2. Índice por ID de Orden de ASU
  const asuById = new Map<string, RecepcionTicket>();
  // 3. Índice por Código de Producto + Modelo normalizado
  const asuByProdModel = new Map<string, RecepcionTicket[]>();

  for (const a of asuTickets) {
    if (a.idOrden) {
      asuById.set(a.idOrden.trim(), a);
    }

    const s = normalizeSerial(a.serial);
    if (s) {
      asuBySerial.set(s, a);
    }

    const cod = (a.codigoProducto || "").trim();
    const mod = normalizeText(a.modelo);
    if (cod && mod) {
      const key = `${cod}___${mod}`;
      if (!asuByProdModel.has(key)) asuByProdModel.set(key, []);
      asuByProdModel.get(key)!.push(a);
    }
  }

  return cdeTickets.map((cde) => {
    let match: RecepcionTicket | null = null;
    let matchReason = "";
    let matchScore = 0;

    const cdeSerial = normalizeSerial(cde.serial);

    // CRITERIO 1: Coincidencia exacta de Serial Físico (100% confianza)
    if (cdeSerial && asuBySerial.has(cdeSerial)) {
      match = asuBySerial.get(cdeSerial)!;
      matchReason = "Serial Físico";
      matchScore = 100;
    }

    // CRITERIO 2: Referencia directa de ID de ASU en el Mensaje de CDE
    if (!match && cde.mensaje) {
      const ids = extractOrderIds(cde.mensaje);
      for (const id of ids) {
        if (asuById.has(id)) {
          match = asuById.get(id)!;
          matchReason = `Ref. en Mensaje (#${id})`;
          matchScore = 90;
          break;
        }
      }
    }

    // CRITERIO 3: Serial de CDE mencionado en el Mensaje de ASU
    if (!match && cdeSerial && cdeSerial.length >= 6) {
      for (const a of asuTickets) {
        if (a.mensaje && a.mensaje.toUpperCase().includes(cdeSerial)) {
          match = a;
          matchReason = "Serial en Informe";
          matchScore = 85;
          break;
        }
      }
    }

    // CRITERIO 4: Mismo Código de Producto + Mismo Modelo (para envíos Danesa SA)
    if (!match && (cde.esDanesa || (cde.cliente || "").toLowerCase().includes("danesa"))) {
      const cod = (cde.codigoProducto || "").trim();
      const mod = normalizeText(cde.modelo);
      if (cod && mod) {
        const key = `${cod}___${mod}`;
        const candidates = asuByProdModel.get(key);
        if (candidates && candidates.length > 0) {
          // Tomar el candidato más reciente o con fecha más próxima
          match = candidates[0];
          matchReason = "Código & Modelo";
          matchScore = 75;
        }
      }
    }

    if (match) {
      return {
        ...cde,
        idOrdenAsu: match.idOrden,
        clienteAsu: match.cliente,
        fechaIngresoAsu: match.fechaIngreso,
        estadoAsu: match.estado,
        matchReason,
      };
    }

    return cde;
  });
}

/**
 * Cruza las órdenes de ASU con las órdenes de CDE (para mostrar estado de CDE en recepción)
 */
export function crossMatchAsuWithCde(
  asuTickets: RecepcionTicket[],
  cdeTickets: RecepcionCdeTicket[]
): RecepcionTicket[] {
  if (!asuTickets || asuTickets.length === 0) return [];
  if (!cdeTickets || cdeTickets.length === 0) return asuTickets;

  const cdeBySerial = new Map<string, RecepcionCdeTicket>();
  for (const c of cdeTickets) {
    const s = normalizeSerial(c.serial);
    if (s) {
      cdeBySerial.set(s, c);
    }
  }

  return asuTickets.map((asu) => {
    const asuSerial = normalizeSerial(asu.serial);
    if (asuSerial && cdeBySerial.has(asuSerial)) {
      const cde = cdeBySerial.get(asuSerial)!;
      return {
        ...asu,
        idOrdenCde: cde.idOrden,
        estadoCde: cde.estado,
        fechaDespachoCde: cde.fechaEntregada,
      };
    }
    return asu;
  });
}
