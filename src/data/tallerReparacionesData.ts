// Gestión y Asignación de Taller de Reparaciones NISSEI CDE
// Administrador: Admin
// Técnicos: Carlos, Enrique, Michael, Marcelo
// Basado 100% en los registros reales de recepcion.csv (SATI NISSEI)

import { getStoredTickets, updateTicketStatus } from "./recepcionData";

export interface Tecnico {
  id: string;
  nombre: string;
  banco: string;
  avatar: string;
}

export interface Admin {
  id: string;
  nombre: string;
  cargo: string;
  avatar: string;
}

export const LISTA_TECNICOS: Tecnico[] = [
  { id: "carlos", nombre: "Carlos", banco: "Banco 1", avatar: "C1" },
  { id: "enrique", nombre: "Enrique", banco: "Banco 2", avatar: "E2" },
  { id: "michael", nombre: "Michael", banco: "Banco 3", avatar: "M3" },
  { id: "marcelo", nombre: "Marcelo", banco: "Banco 4", avatar: "M4" },
];

export const LISTA_ADMINS: Admin[] = [
  { id: "admin", nombre: "Admin", cargo: "Supervisor General de Laboratorio SATI", avatar: "AD" },
];

export interface OrdenReparacion {
  idOrden: string;
  codigoProducto?: string;
  cliente: string;
  equipo: string;
  marca: string;
  modelo: string;
  tipoComponente: string;
  serial: string;
  /** Falla a Asignar: vacía inicialmente porque el CSV no trae columna de fallas; se llena únicamente cuando el Admin asigna al técnico */
  fallaReportada: string;
  /** Detalle de la Reparación: solo para equipos efectivamente reparados (extraído del CSV o cargado por el técnico al reparar) */
  detalleReparacion: string;
  /** Observaciones: notas de NC, cambio por nuevo, sin reparo, rechazo de presupuesto, fuera de garantía o notas donde no se reparó nada */
  observaciones: string;
  mensajeSATI?: string;
  fechaIngreso: string;
  fechaAsignacion?: string;
  fechaFinalizacion?: string;
  estado: "SIN_ASIGNAR" | "EN_REPARACION" | "FINALIZADA";
  tecnicoAsignado?: string; // "Carlos" | "Enrique" | "Michael" | "Marcelo"
  asignadoPor?: string; // "Admin"
  dictamenFinal?: "REPARADO" | "SIN_DEFECTO" | "NO_REPARADO";
  repuestosUtilizados?: string;
}

// Clave única v7 con separación limpia de Fallas a Asignar, Detalle de la Reparación y Observaciones
const STORAGE_KEY_REPARACIONES = "nissei_taller_reparaciones_v7_clean";

/**
 * Clasifica automáticamente el campo `Mensaje` del CSV en:
 * - `detalleReparacion`: si describe una reparación técnica real realizada al equipo.
 * - `observaciones`: si no se reparó nada (NC, cambio por nuevo, sin reparo, fuera de garantía, rechazo, stock, etc.).
 */
export function clasificarMensajeCSV(
  mensajeRaw: string | undefined,
  estadoRaw: string
): { detalleReparacion: string; observaciones: string } {
  const msg = (mensajeRaw || "").trim();
  if (!msg) {
    return { detalleReparacion: "", observaciones: "" };
  }

  // Patrones donde NO se reparó el equipo o es una nota administrativa/comercial/observación
  const esObservacionSinReparo =
    /sin reparo|sinn reparo|no tiene reparo|no se puede reparar|ya no es reparable|fuera de garantia|fuera del plazo|no compensa|rechaza|cambio por nuevo|cambia por nuevo|cambio de equipo por nuevo|cambio de cable por un modelo mas nuevo|le dejamos uno nuevo|nueva unidad|\bnc\b|nota de credito|emap|empa|credito|reembolso|stock|pendiente de reparacion|en pruebas|debe de ver|compra de|fecha de venta|falta repuesto|no contamos por recpuesto|no disponemos de repuesto|sin repuesto|^mueble|^estante|no presenta defecto|no presenta falla|sin defecto|sin defectos|sin falla/i.test(
      msg
    );

  if (esObservacionSinReparo) {
    return {
      detalleReparacion: "",
      observaciones: msg,
    };
  }

  // Patrones que confirman que sí hubo una intervención/reparación técnica real
  const tieneAccionDeReparacion =
    /reparad|reparo|reparacion|reemplaz|limpieza|mantenimiento|cambio de placa|cambio de bateria|cambio de display|cambio del tubo|cambio de bandeja|cambio de componente|cambio de flex|cambio de ficha|cambio de fuente|cambio de cooler|cambio de teclado|cambio de pantalla|ajuste|soldadura|reinstalacion|actualizacion|formateo|calibracion|reposicion|funcionando|funciona ok|funciona normalmente|equipo funcional|solucionado|desactivar|desacivar|corto|reballing|bios|firmware/i.test(
      msg
    );

  if (tieneAccionDeReparacion || estadoRaw.toLowerCase().includes("reparada")) {
    return {
      detalleReparacion: msg,
      observaciones: "",
    };
  }

  // Cualquier otra nota general de órdenes no reparadas va a Observaciones
  return {
    detalleReparacion: "",
    observaciones: msg,
  };
}

// Generar dataset inicial basado 100% en los registros reales del CSV SATI
export function generarOrdenesIniciales(): OrdenReparacion[] {
  const allTickets = getStoredTickets();

  // Filtramos tickets del CSV que corresponden al flujo de taller SATI
  const ticketsTaller = allTickets.filter(
    (t) =>
      t.estado.toLowerCase().includes("reparación") ||
      t.estado.toLowerCase().includes("asignad") ||
      t.estado.toLowerCase().includes("asignacion") ||
      t.estado.toLowerCase().includes("repuesto") ||
      t.estado.toUpperCase() === "QC" ||
      t.estado.toLowerCase().includes("reparada")
  );

  return ticketsTaller.map((t) => {
    const estadoRaw = t.estado.toLowerCase();
    let estado: "SIN_ASIGNAR" | "EN_REPARACION" | "FINALIZADA" = "SIN_ASIGNAR";
    let tecnicoAsignado: string | undefined = undefined;
    let asignadoPor: string | undefined = undefined;
    let fechaAsignacion: string | undefined = undefined;
    let fechaFinalizacion: string | undefined = undefined;
    let dictamenFinal: "REPARADO" | "SIN_DEFECTO" | "NO_REPARADO" | undefined = undefined;
    let repuestosUtilizados: string | undefined = undefined;

    const numId = parseInt((t.idOrden || "0").replace(/\D/g, ""), 10) || 0;
    const asignadoPrevio = LISTA_TECNICOS[numId % LISTA_TECNICOS.length].nombre;

    // Clasificamos el Mensaje del CSV en Detalle de la Reparación vs Observaciones
    const { detalleReparacion, observaciones } = clasificarMensajeCSV(t.mensaje, t.estado);

    if (estadoRaw.includes("reparada") || estadoRaw === "qc") {
      // Reparadas y control de calidad terminadas en taller (Historial previo de SATI)
      estado = "FINALIZADA";
      tecnicoAsignado = asignadoPrevio;
      asignadoPor = "Admin";
      fechaAsignacion = t.fechaIngreso || "19/06/2026";
      fechaFinalizacion = t.fechaEntregada || t.fechaIngreso || "20/06/2026";

      const msgUpper = (t.mensaje || "").toUpperCase();
      if (msgUpper.includes("SIN DEFECTO") || msgUpper.includes("NO PRESENTA FALLA")) {
        dictamenFinal = "SIN_DEFECTO";
      } else if (
        msgUpper.includes("SIN REPARO") ||
        msgUpper.includes("NC") ||
        msgUpper.includes("CAMBIO POR NUEVO") ||
        msgUpper.includes("RECHAZA") ||
        (!detalleReparacion && observaciones)
      ) {
        dictamenFinal = "NO_REPARADO";
      } else {
        dictamenFinal = "REPARADO";
      }

      if (detalleReparacion) {
        if (msgUpper.includes("BATERIA")) repuestosUtilizados = "Reemplazo de batería original";
        else if (msgUpper.includes("PLACA")) repuestosUtilizados = "Sustitución / Reparación de placa de circuito";
        else if (msgUpper.includes("DISPLAY") || msgUpper.includes("PANTALLA"))
          repuestosUtilizados = "Reemplazo de módulo de pantalla";
      }
    } else {
      // TODAS las órdenes pendientes entran estrictamente como SIN ASIGNAR
      estado = "SIN_ASIGNAR";
      tecnicoAsignado = undefined;
      asignadoPor = undefined;
      fechaAsignacion = undefined;
    }

    return {
      idOrden: t.idOrden,
      codigoProducto: t.codigoProducto,
      cliente: t.cliente,
      equipo: `${t.marca} ${t.modelo}`.trim(),
      marca: t.marca,
      modelo: t.modelo,
      tipoComponente: t.tipoComponente || "GENERAL",
      serial: t.serial || "S/N",
      mensajeSATI: t.mensaje || "",
      // En el CSV no existe columna de fallas: inicia vacío y solo se llena cuando el Admin asigna al técnico
      fallaReportada: "",
      detalleReparacion,
      observaciones,
      fechaIngreso: t.fechaIngreso || "19/06/2026",
      fechaAsignacion,
      fechaFinalizacion,
      estado,
      tecnicoAsignado,
      asignadoPor,
      dictamenFinal,
      repuestosUtilizados,
    };
  });
}

// Cargar órdenes del taller
export function getStoredReparaciones(): OrdenReparacion[] {
  if (typeof window === "undefined") return generarOrdenesIniciales();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPARACIONES);
    if (!raw) {
      const init = generarOrdenesIniciales();
      localStorage.setItem(STORAGE_KEY_REPARACIONES, JSON.stringify(init));
      return init;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const init = generarOrdenesIniciales();
    localStorage.setItem(STORAGE_KEY_REPARACIONES, JSON.stringify(init));
    return init;
  } catch (e) {
    console.error("Error cargando reparaciones:", e);
    return generarOrdenesIniciales();
  }
}

// Guardar órdenes en caché local
export function saveReparaciones(ordenes: OrdenReparacion[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_REPARACIONES, JSON.stringify(ordenes));
  } catch (e) {
    console.error("Error guardando reparaciones:", e);
  }
}

// Sincronizar lectura desde MySQL (/api/db?module=reparaciones)
export async function fetchReparacionesFromMySQL(options?: {
  throwOnError?: boolean;
}): Promise<OrdenReparacion[]> {
  try {
    const res = await fetch("/api/db?module=reparaciones", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || `Error MySQL (HTTP ${res.status})`);
    }
    if (Array.isArray(json.data) && json.data.length > 0) {
      saveReparaciones(json.data);
      return json.data;
    }
  } catch (err) {
    console.warn("[MySQL Sync] Usando caché local mientras conecta a MySQL:", err);
    if (options?.throwOnError) {
      throw err instanceof Error ? err : new Error("Error al conectar con MySQL.");
    }
  }
  return getStoredReparaciones();
}

// Asignar técnico por el Admin con detalle de falla a asignar (guarda en MySQL + caché local)
export function asignarOrdenATecnico(
  idOrden: string,
  nombreTecnico: string,
  nombreAdmin: string,
  detalleFalla?: string
): OrdenReparacion[] {
  const current = getStoredReparaciones();
  const fechaHoy = new Date().toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const fallaLimpia = detalleFalla?.trim() || "";

  const updated = current.map((ord) => {
    if (ord.idOrden === idOrden) {
      return {
        ...ord,
        estado: "EN_REPARACION" as const,
        tecnicoAsignado: nombreTecnico,
        asignadoPor: nombreAdmin,
        fechaAsignacion: fechaHoy,
        fallaReportada: fallaLimpia || ord.fallaReportada || "",
      };
    }
    return ord;
  });

  saveReparaciones(updated);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ASIGNAR_TECNICO",
        idOrden,
        nombreTecnico,
        nombreAdmin,
        detalleFalla: fallaLimpia,
      }),
    }).catch((err) => console.error("[MySQL Error Asignación]", err));
  }

  return updated;
}

// Resetear todas las órdenes al estado inicial en MySQL y caché local
export function resetReparaciones(): OrdenReparacion[] {
  const initial = generarOrdenesIniciales();
  saveReparaciones(initial);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET_REPARACIONES" }),
    }).catch((err) => console.error("[MySQL Error Reset Reparaciones]", err));
  }

  return initial;
}

// Finalizar la reparación por el Técnico (guarda en MySQL + caché local)
export function finalizarReparacionTecnico(
  idOrden: string,
  nombreTecnico: string,
  dictamen: "REPARADO" | "SIN_DEFECTO" | "NO_REPARADO",
  detalle: string,
  repuestos?: string
): { updatedList: OrdenReparacion[]; ordenFinalizada?: OrdenReparacion } {
  const current = getStoredReparaciones();
  const fechaHoy = new Date().toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let ordenFinalizada: OrdenReparacion | undefined;

  const updatedList = current.map((ord) => {
    if (ord.idOrden === idOrden) {
      const esReparado = dictamen === "REPARADO";
      const finalizada: OrdenReparacion = {
        ...ord,
        estado: "FINALIZADA" as const,
        tecnicoAsignado: nombreTecnico,
        dictamenFinal: dictamen,
        // Si fue reparado se guarda en Detalle de la Reparación; si no se reparó nada, se guarda en Observaciones
        detalleReparacion: esReparado ? detalle : ord.detalleReparacion || "",
        observaciones: !esReparado ? detalle : ord.observaciones || "",
        repuestosUtilizados: repuestos,
        fechaFinalizacion: fechaHoy,
      };
      ordenFinalizada = finalizada;
      return finalizada;
    }
    return ord;
  });

  saveReparaciones(updatedList);

  // Sincronizar de inmediato con el módulo de Recepción de Retornos
  const nuevoEstadoSATI =
    dictamen === "REPARADO"
      ? "Reparada"
      : dictamen === "SIN_DEFECTO"
      ? "Entregada"
      : "Liquidacion";

  updateTicketStatus(idOrden, nuevoEstadoSATI);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "FINALIZAR_REPARACION",
        idOrden,
        nombreTecnico,
        dictamen,
        detalle,
        repuestos,
      }),
    }).catch((err) => console.error("[MySQL Error Finalizar Reparación]", err));
  }

  return { updatedList, ordenFinalizada };
}

// Formateador oficial del Mensaje para el Grupo de WhatsApp del Taller NISSEI
export function generarMensajeGrupoWhatsApp(orden: OrdenReparacion): string {
  let dictamenIcon = "✅";
  let dictamenText = "REPARADO CON ÉXITO";

  if (orden.dictamenFinal === "SIN_DEFECTO") {
    dictamenIcon = "ℹ️";
    dictamenText = "SIN DEFECTO COMPROBADO";
  } else if (orden.dictamenFinal === "NO_REPARADO") {
    dictamenIcon = "❌";
    dictamenText = "NO REPARADO / DERIVADO A RMA (NOTA DE CRÉDITO)";
  }

  const bloqueResolucion =
    orden.dictamenFinal === "REPARADO"
      ? `📝 *Detalle de la Reparación:*\n${orden.detalleReparacion || "Sin detalles adicionales."}`
      : `📌 *Observaciones:*\n${orden.observaciones || orden.detalleReparacion || "Sin observaciones adicionales."}`;

  return `*NOTIFICACIÓN DE REPARACIÓN FINALIZADA*
*NISSEI S.A. · Laboratorio Técnico CDE*

📋 *Nº Orden SATI:* #${orden.idOrden}
👤 *Cliente:* ${orden.cliente}
💻 *Equipo:* ${orden.equipo}
🏷️ *Categoría:* ${orden.tipoComponente}
🔢 *Nº de Serie:* ${orden.serial}
📅 *Fecha de Ingreso:* ${orden.fechaIngreso || "N/A"}
${orden.fallaReportada ? `\n⚠️ *Falla Asignada:* ${orden.fallaReportada}` : ""}

👨‍🔧 *Técnico Responsable:* ${orden.tecnicoAsignado || "Taller NISSEI"}
${dictamenIcon} *Dictamen:* ${dictamenText}

${bloqueResolucion}
${orden.repuestosUtilizados ? `\n🔧 *Repuestos/Piezas Utilizadas:*\n${orden.repuestosUtilizados}` : ""}

📦 *Destino:* Equipo finalizado y derivado al sector de *Recepción Post-Venta* para verificación y entrega al cliente.`;
}
