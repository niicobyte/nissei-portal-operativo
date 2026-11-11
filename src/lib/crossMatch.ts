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
 * Compara dos fechas en formato DD/MM/AAAA y devuelve la diferencia en días
 */
function getDiasDiferenciaFechas(f1?: string, f2?: string): number {
  if (!f1 || !f2) return 9999;
  const p1 = f1.trim().split(" ")[0].split("/");
  const p2 = f2.trim().split(" ")[0].split("/");
  if (p1.length !== 3 || p2.length !== 3) return 9999;
  const d1 = new Date(parseInt(p1[2], 10), parseInt(p1[1], 10) - 1, parseInt(p1[0], 10));
  const d2 = new Date(parseInt(p2[2], 10), parseInt(p2[1], 10) - 1, parseInt(p2[0], 10));
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 9999;
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
  const asuByProdModel = new Map<string, RecepcionTicket[]>();

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
    const mod = normalizeText(a.modelo);
    if (cod && mod) {
      const key = `${cod}___${mod}`;
      if (!asuByProdModel.has(key)) asuByProdModel.set(key, []);
      asuByProdModel.get(key)!.push(a);
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

    // CRITERIO 2: Referencia directa de ID de ASU en el Mensaje de CDE
    if (!match && cde.mensaje) {
      const ids = extractOrderIds(cde.mensaje);
      for (const id of ids) {
        if (asuById.has(id)) {
          const candidate = asuById.get(id)!;
          if (!matchedAsuIds.has(candidate.idOrden)) {
            if (isDespachoCoherente(candidate.fechaIngreso, cde.fechaEntregada)) {
              match = candidate;
              matchReason = `Ref. en Mensaje (#${id})`;
              break;
            }
          }
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

    // CRITERIO 4: Mismo Código + Modelo SOLO si cliente es Danesa, fechas dentro de 25 días y coherente
    if (!match && (cde.esDanesa || isTicketDanesa(cde.cliente))) {
      const cod = (cde.codigoProducto || "").trim();
      const mod = normalizeText(cde.modelo);
      if (cod && mod) {
        const key = `${cod}___${mod}`;
        const candidates = asuByProdModel.get(key) || [];
        for (const cand of candidates) {
          if (matchedAsuIds.has(cand.idOrden)) continue;
          const diffDias = getDiasDiferenciaFechas(cde.fechaIngreso, cand.fechaIngreso);
          if (diffDias <= 25 && isDespachoCoherente(cand.fechaIngreso, cde.fechaEntregada)) {
            match = cand;
            matchReason = "Código & Modelo";
            break;
          }
        }
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
  const cdeByProdModel = new Map<string, RecepcionCdeTicket[]>();
  const cdeByClienteModel = new Map<string, RecepcionCdeTicket[]>();

  for (const c of realCdeTickets) {
    if (c.idOrden) cdeById.set(c.idOrden.trim(), c);
    const s = normalizeSerial(c.serial);
    if (s) {
      if (!cdeBySerial.has(s)) cdeBySerial.set(s, []);
      cdeBySerial.get(s)!.push(c);
    }
    const cod = (c.codigoProducto || "").trim();
    const mod = normalizeText(c.modelo);
    if (cod && mod) {
      const key = `${cod}___${mod}`;
      if (!cdeByProdModel.has(key)) cdeByProdModel.set(key, []);
      cdeByProdModel.get(key)!.push(c);
    }
    const cli = normalizeText(c.cliente);
    if (cli && cli !== "danesasa" && mod) {
      const key = `${cli}___${mod}`;
      if (!cdeByClienteModel.has(key)) cdeByClienteModel.set(key, []);
      cdeByClienteModel.get(key)!.push(c);
    }
  }

  const matchedCdeIds = new Set<string>();

  return asuTickets.map((asu) => {
    const asuSerial = normalizeSerial(asu.serial);
    let match: RecepcionCdeTicket | null = null;
    let matchReason = "";

    // 0. Cruce Manual prioritario
    const manualCdeId = manualAsuToCde.get(asu.idOrden);
    if (manualCdeId && cdeById.has(manualCdeId)) {
      match = cdeById.get(manualCdeId)!;
      matchReason = "Cruce Manual";
    }

    // 0.1 Overrides guardados
    if (!match && overrides) {
      const ov = overrides[asu.idOrden] || overrides[`ASU_${asu.idOrden}`];
      if (ov?.idOrdenCde && cdeById.has(ov.idOrdenCde.trim())) {
        match = cdeById.get(ov.idOrdenCde.trim())!;
        matchReason = "Override Guardado";
      }
    }

    // CRITERIO 1: Serial Físico exacto (con validación de coherencia cronológica)
    if (!match && asuSerial && cdeBySerial.has(asuSerial)) {
      const candidates = cdeBySerial.get(asuSerial)!;
      for (const cand of candidates) {
        if (matchedCdeIds.has(cand.idOrden)) continue;
        if (isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
          match = cand;
          matchReason = "Serial Físico";
          break;
        }
      }
    }

    // CRITERIO 2: Referencia directa de ID de CDE en el Mensaje de ASU
    if (!match && asu.mensaje) {
      const ids = extractOrderIds(asu.mensaje);
      for (const id of ids) {
        if (cdeById.has(id)) {
          const cand = cdeById.get(id)!;
          if (!matchedCdeIds.has(cand.idOrden)) {
            if (isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
              match = cand;
              matchReason = `Ref. en Mensaje ASU (#${id})`;
              break;
            }
          }
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
            matchReason = "Serial en Informe CDE";
            break;
          }
        }
      }
    }

    // CRITERIO 4: Mismo Cliente Particular + Modelo
    if (!match && !isTicketDanesa(asu.cliente)) {
      const cli = normalizeText(asu.cliente);
      const mod = normalizeText(asu.modelo);
      if (cli && cli.length >= 5 && mod) {
        const key = `${cli}___${mod}`;
        const candidates = cdeByClienteModel.get(key) || [];
        for (const cand of candidates) {
          if (matchedCdeIds.has(cand.idOrden)) continue;
          const diffDias = getDiasDiferenciaFechas(cand.fechaIngreso, asu.fechaIngreso);
          if (diffDias <= 45 && isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
            match = cand;
            matchReason = "Cliente & Modelo";
            break;
          }
        }
      }
    }

    // CRITERIO 5: Mismo Código + Modelo SOLO si cliente es Danesa SA
    if (!match && isTicketDanesa(asu.cliente)) {
      const cod = (asu.codigoProducto || "").trim();
      const mod = normalizeText(asu.modelo);
      if (cod && mod) {
        const key = `${cod}___${mod}`;
        const candidates = cdeByProdModel.get(key) || [];
        for (const cand of candidates) {
          if (matchedCdeIds.has(cand.idOrden)) continue;
          const diffDias = getDiasDiferenciaFechas(cand.fechaIngreso, asu.fechaIngreso);
          if (diffDias <= 30 && isDespachoCoherente(asu.fechaIngreso, cand.fechaEntregada)) {
            match = cand;
            matchReason = "Código & Modelo Danesa";
            break;
          }
        }
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

    const esEntregadaAsu = (asu.estado || "").toLowerCase() === "entregada";

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
    // Si hay cruce manual para esta orden CDE, priorizarlo
    const manualAsuId = manualCdeToAsu.get(c.idOrden);
    if (manualAsuId) {
      c.idOrdenAsu = manualAsuId;
      c.matchReason = "Cruce Manual Confirmado";
      cdeByAsuId.set(manualAsuId, c);
      cdeEmparejadosIds.add(c.idOrden);
    } else if (c.idOrdenAsu) {
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

    const rowKey = cde.rowKey || `CDE_${cde.idOrden}_${cde.codigoProducto || ""}_${cde.serial || ""}_${idx}`;
    const checkin = getCheckinInfo(
      rowKey,
      cde.recibidoEnDeposito,
      cde.fechaRecibidoDeposito || cde.fechaEntregada,
      undefined,
      cde.estado,
      cde.idOrden,
      cde.idOrdenAsu,
      cde.idOrden
    );

    unifiedList.push({
      ...cde,
      fechaIngresoAsu: cde.fechaIngresoAsu || "",
      fechaIngresoCde: cde.fechaIngreso || "",
      idOrdenCde: cde.idOrden,
      idOrdenAsu: cde.idOrdenAsu,
      recibidoEnDeposito: checkin.recibido,
      fechaRecibidoDeposito: checkin.fecha,
      origen: "CDE",
      rowKey,
    });
  });

  // 4. Aplicar overrides manuales guardados de órdenes y fechas
  if (overrides && Object.keys(overrides).length > 0) {
    return unifiedList.map((t) => {
      const ov =
        overrides[t.rowKey || ""] ||
        (t.idOrden && overrides[t.idOrden]) ||
        (t.idOrdenAsu && overrides[t.idOrdenAsu]) ||
        (t.idOrdenCde && overrides[t.idOrdenCde]);
      if (!ov) return t;

      const newIngresoAsu = ov.fechaIngresoAsu || t.fechaIngresoAsu;
      const newIngresoCde = ov.fechaIngresoCde || t.fechaIngresoCde;
      const newDespacho = ov.fechaDespachoCde !== undefined ? ov.fechaDespachoCde : t.fechaEntregada;
      const newRecibido = ov.fechaRecibidoAsu ? ov.fechaRecibidoAsu : t.fechaRecibidoDeposito;
      const newDias = newDespacho ? calcularDiasResolucion(newIngresoAsu || newIngresoCde || t.fechaIngreso, newDespacho) : t.diasResolucion;

      return {
        ...t,
        idOrdenAsu: ov.idOrdenAsu || t.idOrdenAsu,
        idOrdenCde: ov.idOrdenCde || t.idOrdenCde,
        fechaIngresoAsu: newIngresoAsu,
        fechaIngresoCde: newIngresoCde,
        fechaEntregada: newDespacho,
        fechaRecibidoDeposito: newRecibido,
        recibidoEnDeposito: ov.fechaRecibidoAsu ? true : t.recibidoEnDeposito,
        diasResolucion: newDias,
      };
    });
  }

  return unifiedList;
}
