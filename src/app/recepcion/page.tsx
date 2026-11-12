"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { HeaderActions } from "@/components/common/HeaderActions";
import {
  Search,
  Eye,
  Printer,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Plus,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Info,
  Save,
  Layers,
  Sparkles,
  Package,
  Tag,
  Truck,
  Building2,
  Lock,
  EyeOff,
  Box,
  Inbox,
  Check,
  Calendar,
  UserCheck,
} from "lucide-react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import CategoryFilterSelect, { CategoryCountItem } from "@/components/common/CategoryFilterSelect";
import { OrderSearchInput } from "@/components/common/OrderSearchInput";
import { matchesCategoryFilter, normalizeComponentName } from "@/data/recepcionCategories";
import { SpeedTruck } from "@/components/common/SpeedTruck";
import { readMultipleSpreadsheetsForSati, SPREADSHEET_FILE_ACCEPT } from "@/lib/spreadsheetImport";
import { SatiDepurationSummary } from "@/components/SatiDepurationSummary";
import { yieldToBrowser } from "@/lib/satiRawDepurator";
import {
  saveWorkDraft,
  loadWorkDraft,
  useFlushDraftBeforeLogout,
} from "@/lib/workDrafts";
import {
  RecepcionTicket,
  INITIAL_RECEPCION_DATA,
  getStoredTickets,
  fetchTicketsFromMySQL,
  updateTicketStatus,
  updateTicketDetails,
  resetTickets,
  procesarActualizacionCSV,
  ResultadoCargaCSV,
  sincronizarRecepcionCsvOnline,
  isTicketNuevoIngreso,
  isTicketEstadoCambiadoReciente,
  isTicketEntregadoReciente,
} from "@/data/recepcionData";
import {
  toggleCheckinDeposito,
  saveSatiTicketOverride,
  saveSatiCrossMatchLocal,
  isTicketDanesa,
  isEstadoInternoNoCliente,
  parseFechaDMY,
  getStoredCdeTickets,
  classifyAndParseMultiSatiPreparedAsync,
  sincronizarCdeCsvOnline,
  fetchCdeTicketsFromMySQL,
  getStoredCdeCheckins,
  getStoredSatiOverrides,
  getStoredSatiCrossMatches,
  RecepcionCdeTicket,
} from "@/data/recepcionCdeData";
import {
  crossMatchAsuWithCde,
  formatSatiSentenceCase,
  matchesSmartSatiSearch,
} from "@/lib/crossMatch";
import { consumeCloudSyncWarning } from "@/lib/cloudSync";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";
import { getActiveUser, verifyDepositoPassword, verifyAdminPassword, authenticate } from "@/data/authData";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 25;

/**
 * Estados operativos principales compartidos entre el filtro de estados,
 * el selector de cambio rápido dentro del detalle (ojito) y las notificaciones.
 */
const ESTADOS_RECEPCION_CORE = [
  "Asignada",
  "En Asignacion",
  "En Reparación",
  "Entregada",
  "Pendiente por repuesto",
  "QC",
  "Reparada",
] as const;

interface EstadoVisualConfig {
  badgeClass: string;
  inactiveBtnClass: string;
  activeBtnClass: string;
  isDanger?: boolean;
  isDelivered?: boolean;
  readyForPickup: boolean;
  whatsappHeader: string;
  whatsappBody: string;
}

const DEFAULT_ESTADO_VISUAL: EstadoVisualConfig = {
  badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
  inactiveBtnClass: "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-400",
  activeBtnClass: "bg-zinc-900 text-white border-zinc-900 shadow-xs ring-2 ring-zinc-300",
  readyForPickup: false,
  whatsappHeader: "Actualización del estado en taller",
  whatsappBody: "El equipo se encuentra bajo gestión del sector de Post-Venta.",
};

function getEstadoVisualConfig(estado?: string): EstadoVisualConfig {
  const norm = (estado || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (norm === "entregada") {
    return {
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      inactiveBtnClass: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
      activeBtnClass: "bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-200",
      isDelivered: true,
      readyForPickup: true,
      whatsappHeader: "✅ *ENTREGADA*",
      whatsappBody: "Confirmamos que el equipo figura como entregado conforme en el sector de Post-Venta.",
    };
  }
  if (norm === "reparada") {
    return {
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
      inactiveBtnClass: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
      activeBtnClass: "bg-sky-700 text-white border-sky-700 shadow-xs ring-2 ring-sky-200",
      readyForPickup: true,
      whatsappHeader: "✅ *REPARADO CON ÉXITO*",
      whatsappBody: "El equipo fue reparado satisfactoriamente, superó las pruebas técnicas y está listo para ser retirado.",
    };
  }
  if (norm === "qc" || norm.includes("control de calidad")) {
    return {
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      inactiveBtnClass: "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100",
      activeBtnClass: "bg-purple-700 text-white border-purple-700 shadow-xs ring-2 ring-purple-200",
      readyForPickup: true,
      whatsappHeader: "🔬 *EN CONTROL DE CALIDAD (QC)*",
      whatsappBody: "El equipo se encuentra en etapa final de pruebas y control de calidad en Post-Venta.",
    };
  }
  if (norm.includes("pendiente") && norm.includes("repuesto")) {
    return {
      badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
      inactiveBtnClass: "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100",
      activeBtnClass: "bg-orange-600 text-white border-orange-600 shadow-xs ring-2 ring-orange-200",
      readyForPickup: false,
      whatsappHeader: "⏳ *PENDIENTE POR REPUESTO*",
      whatsappBody: "El equipo se encuentra en espera de llegada/disponibilidad de repuesto para completar su reparación.",
    };
  }
  if (norm.includes("reparacion")) {
    return {
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      inactiveBtnClass: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
      activeBtnClass: "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200",
      readyForPickup: false,
      whatsappHeader: "🔧 *EN REPARACIÓN*",
      whatsappBody: "El equipo se encuentra en proceso de diagnóstico e intervención técnica en taller.",
    };
  }
  if (norm === "asignada") {
    return {
      badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
      inactiveBtnClass: "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100",
      activeBtnClass: "bg-indigo-700 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-200",
      readyForPickup: false,
      whatsappHeader: "👨‍🔧 *ASIGNADA A TÉCNICO*",
      whatsappBody: "La orden ya fue asignada a un técnico especialista para su revisión.",
    };
  }
  if (norm.includes("en asignacion")) {
    return {
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      inactiveBtnClass: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
      activeBtnClass: "bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-300",
      readyForPickup: false,
      whatsappHeader: "📋 *EN ASIGNACIÓN*",
      whatsappBody: "La orden fue registrada y aguarda asignación al equipo técnico.",
    };
  }
  if (norm.includes("sin reparo") || norm.includes("liquidacion") || norm.includes("rechaz")) {
    return {
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      inactiveBtnClass: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100",
      activeBtnClass: "bg-rose-700 text-white border-rose-700 shadow-xs ring-2 ring-rose-200",
      isDanger: norm.includes("sin reparo"),
      readyForPickup: norm.includes("sin reparo"),
      whatsappHeader: `⚠️ *${(estado || "SIN REPARO").toUpperCase()}*`,
      whatsappBody: "Se requiere gestión comercial, autorización o retiro según el dictamen técnico informado.",
    };
  }
  if (norm.includes("presupuest")) {
    return {
      badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
      inactiveBtnClass: "bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100",
      activeBtnClass: "bg-cyan-700 text-white border-cyan-700 shadow-xs ring-2 ring-cyan-200",
      readyForPickup: false,
      whatsappHeader: `💰 *${(estado || "PRESUPUESTADA").toUpperCase()}*`,
      whatsappBody: "Se emitió el presupuesto correspondiente y aguarda confirmación del cliente.",
    };
  }
  if (norm.includes("stock")) {
    return {
      badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-300",
      inactiveBtnClass: "bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200",
      activeBtnClass: "bg-zinc-800 text-white border-zinc-800 shadow-xs ring-2 ring-zinc-300",
      readyForPickup: false,
      whatsappHeader: `📦 *${(estado || "ENVIADO STOCK").toUpperCase()}*`,
      whatsappBody: "El equipo fue derivado internamente a Stock.",
    };
  }

  return {
    ...DEFAULT_ESTADO_VISUAL,
    whatsappHeader: `📌 *${(estado || "EN PROCESO").toUpperCase()}*`,
  };
}

interface DictamenQcOption {
  id: string;
  label: string;
  whatsappHeader: string;
  whatsappBody: string;
  readyForPickup: boolean;
  chipInactive: string;
  chipActive: string;
}

const DICTAMEN_QC_OPTIONS: DictamenQcOption[] = [
  {
    id: "AUTO",
    label: "Automático (según estado)",
    whatsappHeader: "",
    whatsappBody: "",
    readyForPickup: false,
    chipInactive: "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100",
    chipActive: "bg-zinc-900 text-white border-zinc-900 shadow-xs ring-2 ring-zinc-300",
  },
  {
    id: "REPARADO",
    label: "Reparado con éxito",
    whatsappHeader: "✅ *REPARADO CON ÉXITO*",
    whatsappBody:
      "El equipo fue reparado satisfactoriamente, superó las pruebas técnicas y está listo para ser retirado.",
    readyForPickup: true,
    chipInactive: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
    chipActive: "bg-sky-700 text-white border-sky-700 shadow-xs ring-2 ring-sky-200",
  },
  {
    id: "QC_PRUEBAS",
    label: "Control de Calidad (QC)",
    whatsappHeader: "🔬 *EN CONTROL DE CALIDAD (QC)*",
    whatsappBody:
      "El equipo se encuentra en fase final de pruebas de verificación y control de calidad.",
    readyForPickup: true,
    chipInactive: "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100",
    chipActive: "bg-purple-700 text-white border-purple-700 shadow-xs ring-2 ring-purple-200",
  },
  {
    id: "SIN_DEFECTO",
    label: "Sin defectos / Normal",
    whatsappHeader: "ℹ️ *SIN DEFECTO COMPROBADO*",
    whatsappBody:
      "El equipo funciona dentro de los parámetros normales de fábrica y no reprodujo la falla reportada. Conserva su garantía vigente.",
    readyForPickup: true,
    chipInactive: "bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100",
    chipActive: "bg-cyan-700 text-white border-cyan-700 shadow-xs ring-2 ring-cyan-200",
  },
  {
    id: "SIN_REPARO_REPUESTO",
    label: "Sin reparo · Falta de repuesto",
    whatsappHeader: "⏳ *SIN REPARO POR FALTA DE REPUESTO*",
    whatsappBody:
      "No fue posible completar la reparación por falta de disponibilidad del repuesto requerido. Corresponde gestión de cambio / nota de crédito o retiro.",
    readyForPickup: true,
    chipInactive: "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100",
    chipActive: "bg-orange-600 text-white border-orange-600 shadow-xs ring-2 ring-orange-200",
  },
  {
    id: "SIN_REPARO_IRREPARABLE",
    label: "Sin reparo · No reparable",
    whatsappHeader: "❌ *SIN REPARO · NO REPARABLE*",
    whatsappBody:
      "El diagnóstico técnico determinó que el daño no es reparable. Se deriva a gestión de garantía, cambio comercial o retiro.",
    readyForPickup: true,
    chipInactive: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100",
    chipActive: "bg-rose-700 text-white border-rose-700 shadow-xs ring-2 ring-rose-200",
  },
  {
    id: "MALA_MANIPULACION",
    label: "Mala manipulación (Cliente)",
    whatsappHeader: "🚫 *MALA MANIPULACIÓN / FUERA DE GARANTÍA*",
    whatsappBody:
      "Se constató daño físico, golpe, humedad o manipulación indebida por parte del cliente, por lo que no aplica cobertura de garantía de fábrica.",
    readyForPickup: true,
    chipInactive: "bg-red-50 text-red-800 border-red-200 hover:bg-red-100",
    chipActive: "bg-red-700 text-white border-red-700 shadow-xs ring-2 ring-red-200",
  },
  {
    id: "RMA_NC",
    label: "Derivado a RMA / Nota de crédito",
    whatsappHeader: "⚠️ *DERIVADO A RMA / NOTA DE CRÉDITO*",
    whatsappBody:
      "El equipo fue derivado a gestión de garantía con fabricante/importador para cambio o emisión de nota de crédito comercial.",
    readyForPickup: true,
    chipInactive: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
    chipActive: "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200",
  },
  {
    id: "PRESUPUESTO_PENDIENTE",
    label: "Presupuesto · Aguarda aprobación",
    whatsappHeader: "💰 *PRESUPUESTO EMITIDO · AGUARDA APROBACIÓN*",
    whatsappBody:
      "La reparación se encuentra fuera de garantía y se emitió presupuesto técnico aguardando aprobación del cliente.",
    readyForPickup: false,
    chipInactive: "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100",
    chipActive: "bg-teal-700 text-white border-teal-700 shadow-xs ring-2 ring-teal-200",
  },
  {
    id: "PRESUPUESTO_RECHAZADO",
    label: "Presupuesto rechazado",
    whatsappHeader: "↩️ *PRESUPUESTO RECHAZADO*",
    whatsappBody:
      "El presupuesto informado no fue aprobado; el equipo se encuentra disponible para retiro sin reparar.",
    readyForPickup: true,
    chipInactive: "bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200",
    chipActive: "bg-stone-700 text-white border-stone-700 shadow-xs ring-2 ring-stone-300",
  },
  {
    id: "DESGASTE_NATURAL",
    label: "Desgaste natural / Consumible",
    whatsappHeader: "🔋 *DESGASTE NATURAL / CONSUMIBLE*",
    whatsappBody:
      "La incidencia corresponde a desgaste normal de uso o componente consumible fuera de cobertura de garantía.",
    readyForPickup: true,
    chipInactive: "bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
    chipActive: "bg-yellow-600 text-white border-yellow-600 shadow-xs ring-2 ring-yellow-200",
  },
  {
    id: "GARANTIA_VENCIDA",
    label: "Garantía vencida",
    whatsappHeader: "📅 *GARANTÍA VENCIDA*",
    whatsappBody:
      "El equipo superó el período de garantía oficial vigente; disponible servicio particular bajo presupuesto o retiro.",
    readyForPickup: true,
    chipInactive: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200",
    chipActive: "bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-300",
  },
];

interface DictamenRecepcionResult {
  dictamenId: string;
  estadoActual: string;
  estadoConfig: EstadoVisualConfig;
  header: string;
  headerPlain: string;
  body: string;
  detalleTexto: string;
  accText: string;
  sourceLabel: string;
  readyForPickup: boolean;
}

/**
 * Resuelve de forma única el Dictamen Técnico y los accesorios a mostrar tanto
 * en la vista previa del modal (ojito) como en el mensaje final de WhatsApp.
 */
function resolveDictamenRecepcion(
  estado?: string,
  mensaje?: string,
  accesorios?: string,
  dictamenTipo?: string
): DictamenRecepcionResult {
  const estadoActual = (estado || "En Asignacion").trim();
  const estNorm = estadoActual
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const msgRaw = (mensaje || "").trim();
  const estadoConfig = getEstadoVisualConfig(estadoActual);

  let detalleTexto = msgRaw;
  let accText = (accesorios || "").trim();
  if (!accText && msgRaw.includes("Accesorios:")) {
    const parts = msgRaw.split(/Accesorios:/i);
    detalleTexto = parts[0].trim();
    accText = parts[1].trim();
  }
  if (!accText || accText.toLowerCase() === "sin accesorios") {
    accText = "Sin accesorios adicionales";
  }

  if (detalleTexto.toUpperCase().includes("SIN DETALLES ADICIONALES")) {
    detalleTexto = "";
  }

  // 1. Selección explícita de Dictamen QC desde el modal (prioridad absoluta)
  const explicitOption =
    dictamenTipo && dictamenTipo !== "AUTO"
      ? DICTAMEN_QC_OPTIONS.find((opt) => opt.id === dictamenTipo)
      : undefined;

  if (explicitOption) {
    return {
      dictamenId: explicitOption.id,
      estadoActual,
      estadoConfig,
      header: explicitOption.whatsappHeader,
      headerPlain: explicitOption.whatsappHeader.replace(/\*/g, ""),
      body: explicitOption.whatsappBody,
      detalleTexto,
      accText,
      sourceLabel: `Dictamen QC: "${explicitOption.label}"`,
      readyForPickup: explicitOption.readyForPickup,
    };
  }

  // 2. Modo Automático: primero evaluar estados explícitos de SATI y luego frases exactas (sin subcadenas como "funcional" -> "NC")
  const esEstadoCerradoReparado =
    estNorm === "reparada" || estNorm === "entregada";

  const msgNorm = msgRaw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const tieneSinDefectoTexto =
    /\b(?:sin\s+defecto(?:s)?|no\s+presenta\s+falla(?:s)?|funcionamiento\s+normal)\b/i.test(
      msgNorm
    );
  const tieneMalaManipulacionTexto =
    /\b(?:mala\s+manipulacion|mal\s+uso|golpeado|sulfatad[oa]|ingreso\s+de\s+liquido)\b/i.test(
      msgNorm
    );
  const tieneSinReparoRepuestoEstado =
    estNorm.includes("sin reparo") && estNorm.includes("repuesto");
  const tieneSinReparoIrreparableEstado =
    estNorm.includes("sin reparo") && estNorm.includes("no reparable");
  const tieneSinReparoEstado = estNorm.includes("sin reparo");
  const tieneSinReparoTextoExacto =
    !esEstadoCerradoReparado &&
    /\b(?:sin\s+reparo|no\s+reparable|no\s+reparado|cambio\s+por\s+nuevo|nota\s+de\s+credito|n\/?c|rma)\b/i.test(
      msgNorm
    );

  let header = estadoConfig.whatsappHeader;
  let body = estadoConfig.whatsappBody;
  let sourceLabel = `Automático · Estado "${estadoActual}"`;
  let readyForPickup = estadoConfig.readyForPickup;

  const pickOption = (id: string, reason: string) => {
    const opt = DICTAMEN_QC_OPTIONS.find((o) => o.id === id);
    if (!opt) return;
    header = opt.whatsappHeader;
    body = opt.whatsappBody;
    readyForPickup = opt.readyForPickup;
    sourceLabel = reason;
  };

  if (tieneSinReparoRepuestoEstado) {
    pickOption("SIN_REPARO_REPUESTO", `Automático · Estado "${estadoActual}"`);
  } else if (tieneSinReparoIrreparableEstado) {
    pickOption("SIN_REPARO_IRREPARABLE", `Automático · Estado "${estadoActual}"`);
  } else if (tieneSinReparoEstado) {
    pickOption("RMA_NC", `Automático · Estado "${estadoActual}"`);
  } else if (tieneMalaManipulacionTexto) {
    pickOption("MALA_MANIPULACION", 'Detectado en Informe Técnico ("Mala manipulación / Daño físico")');
  } else if (tieneSinDefectoTexto) {
    pickOption("SIN_DEFECTO", 'Detectado en Informe Técnico ("Sin defectos / Normal")');
  } else if (tieneSinReparoTextoExacto) {
    pickOption("RMA_NC", 'Detectado en Informe Técnico ("Sin reparo / RMA / N/C")');
  }

  return {
    dictamenId: "AUTO",
    estadoActual,
    estadoConfig,
    header,
    headerPlain: header.replace(/\*/g, ""),
    body,
    detalleTexto,
    accText,
    sourceLabel,
    readyForPickup,
  };
}

type ViewScope = "DANESA" | "CLIENTES_ASU" | "TODOS";
type TransitFilter = "TODOS" | "EN_CAMINO" | "INGRESADO_CDE" | "FALTA_INGRESAR" | "RECIBIDOS";
type RecibidosDateFilter = "TODAS" | "HOY" | "AYER" | "ULTIMOS_7" | "ESTE_MES";

function matchesRecibidosDate(ticket: RecepcionTicket, filter: RecibidosDateFilter): boolean {
  if (filter === "TODAS") return true;

  const dateStr = ticket.fechaRecibidoDeposito || ticket.fechaEntregada || ticket.fechaIngreso;
  if (!dateStr) return false;

  const d = parseFechaDMY(dateStr);
  if (!d) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));

  if (filter === "HOY") {
    return diffDays === 0;
  }
  if (filter === "AYER") {
    return diffDays === 1;
  }
  if (filter === "ULTIMOS_7") {
    return diffDays >= 0 && diffDays <= 7;
  }
  if (filter === "ESTE_MES") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

function isTicketRecibido(t: RecepcionTicket): boolean {
  const est = (t.estado || "").toLowerCase();
  if (est.includes("entregada")) return false;
  return Boolean(t.recibidoEnDeposito);
}

function isTicketEnCamino(t: RecepcionTicket): boolean {
  if (isTicketRecibido(t)) return false;
  const est = (t.estado || "").toLowerCase();
  if (est.includes("entregada")) return false;
  return Boolean(t.enCamino);
}

function isTicketIngresadoEnCde(t: RecepcionTicket): boolean {
  if (isTicketRecibido(t)) return false;
  const est = (t.estado || "").toLowerCase();
  if (est.includes("entregada")) return false;
  if (t.enCamino) return false;
  return Boolean(t.ingresadoEnCde);
}

function isTicketFaltaIngresar(t: RecepcionTicket): boolean {
  if (isTicketRecibido(t)) return false;
  const est = (t.estado || "").toLowerCase();
  if (est.includes("entregada")) return false;
  const rawMsg = (t.mensaje || "").trim().toLowerCase();
  const tieneMensaje = Boolean(
    rawMsg &&
    rawMsg !== "sin observaciones técnicas registradas." &&
    rawMsg !== "sin observaciones técnicas registradas" &&
    rawMsg !== "sin observaciones" &&
    rawMsg.length >= 5
  );
  const esReparada = est.includes("reparad") || est === "qc";
  return tieneMensaje && esReparada;
}

export default function RecepcionDashboardPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<RecepcionTicket[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Acceso al Módulo Depósito Danesa / CDE
  const [showDepositoAuthModal, setShowDepositoAuthModal] = useState(false);
  const [depositoPassword, setDepositoPassword] = useState("");
  const [depositoAuthError, setDepositoAuthError] = useState<string | null>(null);
  const [showDepPass, setShowDepPass] = useState(false);

  const handleOpenDeposito = () => {
    const active = getActiveUser();
    if (active && (active.id === "deposito.danesa" || active.role === "ADMIN")) {
      router.push("/recepcion/cde");
      return;
    }
    setDepositoPassword("");
    setDepositoAuthError(null);
    setShowDepositoAuthModal(true);
  };

  const handleVerifyDeposito = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyDepositoPassword(depositoPassword)) {
      setDepositoAuthError("Contraseña incorrecta para SATI ASU - CDE.");
      return;
    }
    if (verifyAdminPassword(depositoPassword)) {
      authenticate("admin", depositoPassword);
    } else {
      authenticate("deposito.danesa", depositoPassword);
    }
    setShowDepositoAuthModal(false);
    router.push("/recepcion/cde");
  };

  // Filtros y ámbito estilo SATI ASU - CDE
  const [viewScope, setViewScope] = useState<ViewScope>("DANESA");
  const [transitFilter, setTransitFilter] = useState<TransitFilter>("TODOS");
  const [recibidosDateFilter, setRecibidosDateFilter] = useState<RecibidosDateFilter>("TODAS");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [categoryFamily, setCategoryFamily] = useState("TODOS");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"ID_DESC" | "ID_ASC" | "CLIENTE_ASC" | "MARCA_ASC">("ID_DESC");
  const [currentPage, setCurrentPage] = useState(1);

  // Modales y notificaciones
  const [selectedTicket, setSelectedTicket] = useState<RecepcionTicket | null>(null);
  const [modalMensaje, setModalMensaje] = useState<string>("");
  const [modalDictamenTipo, setModalDictamenTipo] = useState<string>("AUTO");
  const [modalAccesorios, setModalAccesorios] = useState<string>("");
  const [modalAccessoriesList, setModalAccessoriesList] = useState<string[]>([]);
  const [modalNewAccessory, setModalNewAccessory] = useState<string>("");
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const draftHydratedRef = useRef(false);
  const pendingModalDraftRef = useRef<{
    idOrden: string;
    modalMensaje: string;
    modalDictamenTipo?: string;
    modalAccessoriesList: string[];
    modalNewAccessory: string;
  } | null>(null);

  const parseAccesoriosString = (raw: string | undefined): string[] => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase().includes("sin accesorios")) return [];
    return trimmed.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  };

  useEffect(() => {
    if (selectedTicket) {
      const pending = pendingModalDraftRef.current;
      if (pending && pending.idOrden === selectedTicket.idOrden) {
        setModalMensaje(pending.modalMensaje);
        setModalDictamenTipo(pending.modalDictamenTipo || selectedTicket.dictamenTipo || "AUTO");
        setModalAccessoriesList(pending.modalAccessoriesList);
        setModalAccesorios(pending.modalAccessoriesList.join(", "));
        setModalNewAccessory(pending.modalNewAccessory);
        pendingModalDraftRef.current = null;
        return;
      }

      const rawMsg = selectedTicket.mensaje || "";
      let accRaw = selectedTicket.accesorios || "";
      let cleanMsg = rawMsg;

      // Si no hay accesorios explícitos pero el mensaje contiene "Accesorios: ...", extraerlo
      if (!accRaw && rawMsg.includes("Accesorios:")) {
        const parts = rawMsg.split(/Accesorios:/i);
        cleanMsg = parts[0].trim();
        accRaw = parts[1].trim();
      }

      setModalMensaje(cleanMsg);
      setModalDictamenTipo(selectedTicket.dictamenTipo || "AUTO");
      setModalAccesorios(accRaw);
      setModalAccessoriesList(parseAccesoriosString(accRaw));
      setModalNewAccessory("");
    }
  }, [selectedTicket]);

  const handleAddModalAccessory = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (!modalAccessoriesList.includes(trimmed)) {
      const updated = [...modalAccessoriesList, trimmed];
      setModalAccessoriesList(updated);
      setModalAccesorios(updated.join(", "));
    }
    setModalNewAccessory("");
  };

  const handleRemoveModalAccessory = (index: number) => {
    const updated = modalAccessoriesList.filter((_, i) => i !== index);
    setModalAccessoriesList(updated);
    setModalAccesorios(updated.join(", "));
  };

  const handleClearModalAccessories = () => {
    setModalAccessoriesList([]);
    setModalAccesorios("");
  };
  const [showPrintModal, setShowPrintModal] = useState<RecepcionTicket | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Estado para subida de CSV y reporte de cambios
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [csvReport, setCsvReport] = useState<
    (ResultadoCargaCSV & { fileName: string; timestamp: string }) | null
  >(null);

  const syncRecepcionAndCdeFromCloud = async (showFeedback = false) => {
    const baseAsu = getStoredTickets();
    const baseCde = getStoredCdeTickets();
    try {
      const [dbAsu, dbCde] = await Promise.all([
        fetchTicketsFromMySQL({ throwOnError: showFeedback }).catch((err) => {
          if (showFeedback) throw err;
          return baseAsu;
        }),
        fetchCdeTicketsFromMySQL({ throwOnError: showFeedback }).catch((err) => {
          if (showFeedback) throw err;
          return baseCde;
        }),
      ]);
      const finalAsu = dbAsu && dbAsu.length > 0 ? dbAsu : baseAsu;
      const finalCde = dbCde && dbCde.length > 0 ? dbCde : baseCde;
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const enriched = crossMatchAsuWithCde(finalAsu, finalCde, checkins, overrides, cross);
      setTickets(enriched);
      if (showFeedback) {
        showToast(`Sincronizado con MySQL en la nube (${finalAsu.length} órdenes ASU · ${finalCde.length} CDE).`);
      }
    } catch (err) {
      if (showFeedback) {
        showToast(err instanceof Error ? err.message : "Error al sincronizar Recepción con MySQL.");
      }
    }
  };

  // Carga inicial reactiva desde MySQL + LocalStorage con Cruce Inteligente CDE
  useEffect(() => {
    setIsClient(true);
    const active = getActiveUser();
    if (!active) return;

    const storedAsu = getStoredTickets();
    const storedCde = getStoredCdeTickets();
    const liveCheckins = getStoredCdeCheckins();
    const liveOverrides = getStoredSatiOverrides();
    const liveCross = getStoredSatiCrossMatches();

    const baseAsu = storedAsu && storedAsu.length > 0 ? storedAsu : INITIAL_RECEPCION_DATA;
    const initEnriched = crossMatchAsuWithCde(
      baseAsu,
      storedCde,
      liveCheckins,
      liveOverrides,
      liveCross
    );
    setTickets(initEnriched);

    // Restaurar filtros y edición de modal pendiente si hubo recarga / actualización de deploy
    const draft = loadWorkDraft<{
      viewScope?: ViewScope;
      transitFilter?: TransitFilter;
      recibidosDateFilter?: RecibidosDateFilter;
      statusFilter?: string;
      categoryFamily?: string;
      selectedCategories?: string[];
      searchTerm?: string;
      sortBy?: "ID_DESC" | "ID_ASC" | "CLIENTE_ASC" | "MARCA_ASC";
      currentPage?: number;
      selectedTicketId?: string | null;
      modalMensaje?: string;
      modalDictamenTipo?: string;
      modalAccessoriesList?: string[];
      modalNewAccessory?: string;
    }>("recepcion_workspace");

    if (draft) {
      if (draft.viewScope) setViewScope(draft.viewScope);
      if (draft.transitFilter) setTransitFilter(draft.transitFilter);
      if (draft.recibidosDateFilter) setRecibidosDateFilter(draft.recibidosDateFilter);
      if (draft.statusFilter) setStatusFilter(draft.statusFilter);
      if (draft.categoryFamily) setCategoryFamily(draft.categoryFamily);
      if (Array.isArray(draft.selectedCategories)) setSelectedCategories(draft.selectedCategories);
      if (typeof draft.searchTerm === "string") setSearchTerm(draft.searchTerm);
      if (draft.sortBy) setSortBy(draft.sortBy);
      if (typeof draft.currentPage === "number" && draft.currentPage >= 1) {
        setCurrentPage(draft.currentPage);
      }
      if (draft.selectedTicketId) {
        const matched = initEnriched.find((t) => t.idOrden === draft.selectedTicketId);
        if (matched) {
          pendingModalDraftRef.current = {
            idOrden: matched.idOrden,
            modalMensaje: draft.modalMensaje || "",
            modalDictamenTipo: draft.modalDictamenTipo || matched.dictamenTipo || "AUTO",
            modalAccessoriesList: Array.isArray(draft.modalAccessoriesList)
              ? draft.modalAccessoriesList
              : [],
            modalNewAccessory: draft.modalNewAccessory || "",
          };
          setSelectedTicket(matched);
        }
      }
    }
    draftHydratedRef.current = true;

    const pendingWarning = consumeCloudSyncWarning();
    if (pendingWarning) {
      showToast(pendingWarning);
    }

    void syncRecepcionAndCdeFromCloud(false);

    const handleFocus = () => {
      if (getActiveUser()) {
        void syncRecepcionAndCdeFromCloud(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const buildWorkspaceDraft = () => ({
    viewScope,
    transitFilter,
    recibidosDateFilter,
    statusFilter,
    categoryFamily,
    selectedCategories,
    searchTerm,
    sortBy,
    currentPage,
    selectedTicketId: selectedTicket?.idOrden || null,
    modalMensaje,
    modalDictamenTipo,
    modalAccessoriesList,
    modalNewAccessory,
  });

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    saveWorkDraft("recepcion_workspace", buildWorkspaceDraft());
  }, [
    viewScope,
    transitFilter,
    recibidosDateFilter,
    statusFilter,
    categoryFamily,
    selectedCategories,
    searchTerm,
    sortBy,
    currentPage,
    selectedTicket,
    modalMensaje,
    modalDictamenTipo,
    modalAccessoriesList,
    modalNewAccessory,
  ]);

  useFlushDraftBeforeLogout(() => {
    if (draftHydratedRef.current) {
      saveWorkDraft("recepcion_workspace", buildWorkspaceDraft());
    }
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5500);
  };

  // Manejar carga de uno o múltiples archivos CSV / Excel a la vez para actualizar estados ASU y CDE
  const processUploadedFiles = async (fileList: FileList | File[]) => {
    const selectedFiles = Array.from(fileList);
    if (selectedFiles.length === 0) return;

    setIsUploadingCSV(true);
    try {
      const { preparedSheets, fileNamesLabel } = await readMultipleSpreadsheetsForSati(selectedFiles);
      const parsed = await classifyAndParseMultiSatiPreparedAsync(preparedSheets);

      if (parsed.totalRows === 0 && parsed.depurationStats.totalRawFilas === 0) {
        throw new Error(
          "No se detectaron órdenes válidas en los archivos seleccionados. Verifique que sean CSV o Excel (.xlsx) exportados de SATI con columnas de orden."
        );
      }

      if (parsed.totalRows === 0 && parsed.depurationStats.totalRawFilas > 0) {
        const nowStr = new Date().toLocaleTimeString("es-PY", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setCsvReport({
          updatedTickets: tickets,
          totalFilasLeidas: 0,
          totalActualizadas: 0,
          totalNuevas: 0,
          totalSinCambios: 0,
          cambios: [],
          depurationStats: parsed.depurationStats,
          fileName: fileNamesLabel,
          timestamp: nowStr,
        });
        showToast(
          `Se analizaron ${parsed.depurationStats.totalRawFilas.toLocaleString()} fila(s) crudas y todas fueron omitidas por depuración automática (históricas / filtros de cliente / paréntesis).`
        );
        return;
      }

      const hasAsu = parsed.asuRows.length > 0;
      const hasCde = parsed.cdeRows.length > 0;

      // Sincronización obligatoria directa a MySQL en la nube (Railway) según alcance (ASU, CDE o ambos juntos)
      const [resAsu, resCde] = await Promise.all([
        hasAsu ? sincronizarRecepcionCsvOnline(parsed, tickets) : Promise.resolve(null),
        hasCde ? sincronizarCdeCsvOnline(parsed) : Promise.resolve(null),
      ]);

      await yieldToBrowser();
      const updatedAsu = resAsu ? resAsu.updatedTickets : tickets;
      const cdeTickets = resCde ? resCde.updatedTickets : getStoredCdeTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const enriched = crossMatchAsuWithCde(
        updatedAsu,
        cdeTickets,
        checkins,
        overrides,
        cross
      );
      setTickets(enriched);

      const resultado = {
        updatedTickets: updatedAsu,
        totalFilasLeidas:
          (resAsu?.totalFilasLeidas ?? 0) + (resCde?.totalFilasLeidas ?? 0),
        totalActualizadas:
          (resAsu?.totalActualizadas ?? 0) + (resCde?.totalActualizadas ?? 0),
        totalNuevas: (resAsu?.totalNuevas ?? 0) + (resCde?.totalNuevas ?? 0),
        totalSinCambios:
          (resAsu?.totalSinCambios ?? 0) + (resCde?.totalSinCambios ?? 0),
        depurationStats: parsed.depurationStats,
        cambios: [
          ...(resAsu?.cambios ?? []),
          ...(resCde?.cambios ?? []).map((c) => ({
            idOrden: c.idOrden,
            cliente: c.cliente,
            equipo: c.equipo,
            estadoAnterior: c.estadoAnterior,
            estadoNuevo: c.estadoNuevo,
            fechaEntregada: c.fechaEntregada,
          })),
        ],
      };

      const nowStr = new Date().toLocaleTimeString("es-PY", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setCsvReport({
        ...resultado,
        fileName: fileNamesLabel,
        timestamp: nowStr,
      });

      const totalModificadas = resultado.totalActualizadas + resultado.totalNuevas;
      if (totalModificadas > 0) {
        showToast(
          `Importación guardada en MySQL: ${resultado.totalActualizadas} orden(es) cambiaron de estado${
            resultado.totalNuevas > 0 ? ` y ${resultado.totalNuevas} nueva(s)` : ""
          } (${resultado.totalSinCambios} sin cambios).`
        );
      } else {
        showToast(
          `Archivo(s) verificados en MySQL (${resultado.totalFilasLeidas.toLocaleString()} órdenes): No se detectaron cambios de estado.`
        );
      }
    } catch (err) {
      console.error("Error al procesar o sincronizar los archivos CSV/Excel:", err);
      showToast(
        err instanceof Error
          ? err.message
          : "Error al leer o sincronizar los archivos con MySQL."
      );
    } finally {
      setIsUploadingCSV(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await processUploadedFiles(e.target.files);
    }
  };

  // Reset a los datos originales de la recepción
  const handleResetData = () => {
    if (confirm("¿Desea restablecer los registros a los datos originales del sistema SATI?")) {
      const reset = resetTickets();
      const cdeTickets = getStoredCdeTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const enriched = crossMatchAsuWithCde(reset, cdeTickets, checkins, overrides, cross);
      setTickets(enriched);
      setCsvReport(null);
      setCurrentPage(1);
      showToast("Datos originales SATI restablecidos correctamente (2,004 órdenes).");
    }
  };

  // Guardar notas o comentarios del informe técnico, dictamen y accesorios de la orden
  const handleGuardarMensaje = () => {
    if (!selectedTicket) return;
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    const updated = updateTicketDetails(selectedTicket.idOrden, {
      mensaje: modalMensaje,
      accesorios: accFinal,
      dictamenTipo: modalDictamenTipo,
    });
    setTickets(updated);
    setSelectedTicket({
      ...selectedTicket,
      mensaje: modalMensaje,
      accesorios: accFinal,
      dictamenTipo: modalDictamenTipo,
    });
    showToast(
      `Detalles técnicos y accesorios de la orden #${selectedTicket.idOrden} guardados correctamente.`
    );
  };

  // Actualizar dictamen técnico / resolución QC de una orden en vivo
  const handleCambiarDictamen = (idOrden: string, dictamenId: string) => {
    setModalDictamenTipo(dictamenId);
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    const updated = updateTicketDetails(idOrden, {
      dictamenTipo: dictamenId,
      mensaje: modalMensaje,
      accesorios: accFinal,
    });
    setTickets(updated);
    if (selectedTicket && selectedTicket.idOrden === idOrden) {
      setSelectedTicket({
        ...selectedTicket,
        dictamenTipo: dictamenId,
        mensaje: modalMensaje,
        accesorios: accFinal,
      });
    }
  };

  // Actualizar estado de una orden sincronizado con el filtro y modal
  const handleCambiarEstado = (idOrden: string, nuevoEstado: string) => {
    const isDelivered = nuevoEstado.trim().toLowerCase() === "entregada";
    const nowDate = new Date().toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    const updated = updateTicketDetails(idOrden, {
      estado: nuevoEstado,
      mensaje: modalMensaje,
      accesorios: accFinal,
      dictamenTipo: modalDictamenTipo,
      fechaEntregada: isDelivered
        ? selectedTicket?.fechaEntregada || nowDate
        : selectedTicket?.fechaEntregada,
    });
    setTickets(updated);
    if (selectedTicket && selectedTicket.idOrden === idOrden) {
      setSelectedTicket({
        ...selectedTicket,
        estado: nuevoEstado,
        mensaje: modalMensaje,
        accesorios: accFinal,
        dictamenTipo: modalDictamenTipo,
        fechaEntregada: isDelivered
          ? selectedTicket.fechaEntregada || nowDate
          : selectedTicket.fechaEntregada,
      });
    }
    showToast(`Orden #${idOrden} actualizada a estado: ${nuevoEstado}`);
  };

  // Generar mensaje con el estado exacto seleccionado, dictamen QC y detalle técnico para enviar al grupo de Recepción
  const generarMensajeWhatsAppRecepcion = (ticket: RecepcionTicket) => {
    const dictamen = resolveDictamenRecepcion(
      ticket.estado,
      ticket.mensaje,
      ticket.accesorios,
      ticket.dictamenTipo
    );
    const estLower = dictamen.estadoActual.toLowerCase();

    let statusText = `${dictamen.header}\n${dictamen.body}`;
    if (dictamen.detalleTexto) {
      statusText += `\n📝 *Detalle:* ${dictamen.detalleTexto}`;
    }

    const introLine =
      estLower === "entregada"
        ? `Confirmación de entrega del equipo de *${ticket.cliente || "Cliente"}* en el sector de Post-Venta`
        : dictamen.readyForPickup
        ? `El equipo de *${ticket.cliente || "Cliente"}* ya se encuentra en el sector de Post-Venta y listo para el retiro`
        : `Actualización del servicio técnico para el equipo de *${ticket.cliente || "Cliente"}* en el sector de Post-Venta`;

    return `${introLine}

📋 *Orden SATI:* #${ticket.idOrden}
🏷️ *Cód. Producto:* ${ticket.codigoProducto || "N/A"}
💻 *Equipo:* ${ticket.marca} ${ticket.modelo || "Equipo"}
📦 *Categoría:* ${ticket.tipoComponente || "GENERAL"}
🔢 *Serie:* ${ticket.serial && ticket.serial !== "S/N" && !ticket.serial.toUpperCase().includes("SIN SERIAL") ? ticket.serial : "SIN SERIAL"}
📌 *Estado:* ${dictamen.estadoActual}

📊 *Dictamen Técnico:*
${statusText}

📦 *Accesorios incluidos:*
${dictamen.accText}`;
  };

  const handleAbrirParaNotificar = (ticket: RecepcionTicket) => {
    setSelectedTicket(ticket);
    const rawMsg = (ticket.mensaje || "").trim();
    const esVacio =
      !rawMsg ||
      rawMsg.toLowerCase() === "sin observaciones técnicas registradas." ||
      rawMsg.toLowerCase() === "sin observaciones técnicas registradas" ||
      rawMsg.toLowerCase() === "sin observaciones" ||
      rawMsg.length < 4;

    if (isTicketRecibido(ticket)) {
      showToast(`✅ Orden #${ticket.idOrden}: Recibido · Listo para retiro de cliente.`);
    } else if (esVacio) {
      showToast(`📋 Complete el informe técnico de la orden #${ticket.idOrden} y pulse "Notificar por WhatsApp" para marcar como recibido.`);
    }
    setTimeout(() => {
      modalTextareaRef.current?.focus();
    }, 150);
  };

  const handleNotificarWhatsAppRecepcion = async (ticket: RecepcionTicket) => {
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    // 1. Validar estrictamente que el informe técnico / mensaje esté completado antes de marcar recibido
    const msgParaValidar = (
      selectedTicket && selectedTicket.idOrden === ticket.idOrden
        ? modalMensaje
        : ticket.mensaje || ""
    ).trim();

    const esMsgVacio =
      !msgParaValidar ||
      msgParaValidar.toLowerCase() === "sin observaciones técnicas registradas." ||
      msgParaValidar.toLowerCase() === "sin observaciones técnicas registradas" ||
      msgParaValidar.toLowerCase() === "sin observaciones" ||
      msgParaValidar.length < 4;

    if (esMsgVacio) {
      if (!selectedTicket || selectedTicket.idOrden !== ticket.idOrden) {
        setSelectedTicket(ticket);
      }
      showToast("⚠️ Debe completar el informe técnico / mensaje antes de notificar y marcar como recibido.");
      setTimeout(() => {
        modalTextareaRef.current?.focus();
      }, 100);
      return;
    }

    // Si el mensaje, accesorios o dictamen en el modal fueron modificados, guardarlos antes de notificar
    let currentTicket = ticket;
    if (selectedTicket && selectedTicket.idOrden === ticket.idOrden) {
      if (
        modalMensaje !== ticket.mensaje ||
        accFinal !== (ticket.accesorios || "") ||
        modalDictamenTipo !== (ticket.dictamenTipo || "AUTO")
      ) {
        const updated = updateTicketDetails(ticket.idOrden, {
          mensaje: modalMensaje,
          accesorios: accFinal,
          dictamenTipo: modalDictamenTipo,
        });
        setTickets(updated);
        currentTicket = {
          ...ticket,
          mensaje: modalMensaje,
          accesorios: accFinal,
          dictamenTipo: modalDictamenTipo,
        };
        setSelectedTicket(currentTicket);
      }
    }
    const msg = generarMensajeWhatsAppRecepcion(currentTicket);

    // Capturar fecha y hora exacta del momento en que se toca el botón para el cruce
    const now = new Date();
    const fechaHoyCorta = now.toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const horaCorta = now.toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const fechaNotificacion = `${fechaHoyCorta} ${horaCorta}`;

    try {
      // 1. Enviar mensaje por WhatsApp
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "RECEPCION",
          body: msg,
        }),
      });

      const data = await res.json();

      // 2. Sincronizar y cruzar de inmediato con SATI ASU - CDE en MySQL
      let matchedCdeId: string | undefined = undefined;
      try {
        const dbRes = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "NOTIFICAR_Y_RECIBIR_SATI",
            idOrden: ticket.idOrden,
            serial: ticket.serial,
            codigoProducto: ticket.codigoProducto,
            cliente: ticket.cliente,
            fechaNotificacion,
          }),
        });
        const dbJson = await dbRes.json();
        if (dbJson.ok && dbJson.matchedCdeId) {
          matchedCdeId = dbJson.matchedCdeId;
        }
      } catch (dbErr) {
        console.warn("[MySQL Error Notificar y Recibir]", dbErr);
      }

      // 3. Persistir en almacenamiento local para reflejo inmediato en el navegador
      toggleCheckinDeposito(
        ticket.idOrden,
        {
          idOrden: ticket.idOrden,
          idOrdenAsu: ticket.idOrden,
          idOrdenCde: matchedCdeId,
        },
        true,
        fechaNotificacion
      );
      saveSatiTicketOverride(ticket.idOrden, {
        fechaRecibidoAsu: fechaNotificacion,
        idOrdenAsu: ticket.idOrden,
        idOrdenCde: matchedCdeId,
      });
      if (matchedCdeId) {
        saveSatiCrossMatchLocal(ticket.idOrden, matchedCdeId);
        toggleCheckinDeposito(
          matchedCdeId,
          {
            idOrden: matchedCdeId,
            idOrdenAsu: ticket.idOrden,
            idOrdenCde: matchedCdeId,
          },
          true,
          fechaNotificacion
        );
      }

      // 4. Actualizar estado reactivo en pantalla
      setTickets((prev) =>
        prev.map((t) =>
          t.idOrden === ticket.idOrden
            ? {
                ...t,
                recibidoEnDeposito: true,
                fechaRecibidoDeposito: fechaNotificacion,
                idOrdenCde: matchedCdeId || t.idOrdenCde,
              }
            : t
        )
      );
      if (selectedTicket && selectedTicket.idOrden === ticket.idOrden) {
        setSelectedTicket((prev) =>
          prev
            ? {
                ...prev,
                recibidoEnDeposito: true,
                fechaRecibidoDeposito: fechaNotificacion,
                idOrdenCde: matchedCdeId || (prev as any).idOrdenCde,
              }
            : null
        );
      }

      if (res.ok && data?.success) {
        showToast(
          matchedCdeId
            ? `✅ Orden #${ticket.idOrden}: Recibido · Listo para que retire el cliente (cruzado con CDE #${matchedCdeId}).`
            : `✅ Orden #${ticket.idOrden}: Recibido · Listo para que retire el cliente (notificado al grupo).`
        );
      } else {
        const errorMsg = data?.error || "Error al entregar mensaje";
        console.error("[WHATSAPP ERROR]", errorMsg);
        showToast(
          `✅ Orden #${ticket.idOrden}: Recibido · Listo para retiro (aviso WhatsApp: ${errorMsg}).`
        );
      }
    } catch (err: unknown) {
      console.error("[WHATSAPP FETCH ERROR]", err);
      showToast(
        `Error de conexión al enviar aviso de la Orden #${ticket.idOrden}.`
      );
    }
  };

  // Segmentación por ámbito (Danesa SA / Clientes ASU / Todos)
  // En Clientes ASU nunca se incluyen órdenes con estados internos (Enviado a destrucción, Enviado a stock, Liquidación, Vendido)
  const isClienteAsuValido = (t: RecepcionTicket) =>
    !isTicketDanesa(t.cliente) && !isEstadoInternoNoCliente(t.estado);

  const scopeTickets = useMemo(() => {
    if (viewScope === "DANESA") {
      return tickets.filter((t) => isTicketDanesa(t.cliente));
    }
    if (viewScope === "CLIENTES_ASU") {
      return tickets.filter(isClienteAsuValido);
    }
    return tickets;
  }, [tickets, viewScope]);

  // Conteos totales por ámbito para las pestañas superiores
  const totalDanesa = useMemo(
    () => tickets.filter((t) => isTicketDanesa(t.cliente)).length,
    [tickets]
  );
  const totalClientesAsu = useMemo(
    () => tickets.filter(isClienteAsuValido).length,
    [tickets]
  );
  const totalUniversal = tickets.length;

  // Métricas del ámbito seleccionado
  const metrics = useMemo(() => {
    const list = scopeTickets;
    const total = list.length || 1;
    const entregadas = list.filter((t) => (t.estado || "").toLowerCase() === "entregada").length;
    const enReparacion = list.filter(
      (t) =>
        (t.estado || "").toLowerCase().includes("reparación") ||
        (t.estado || "").toLowerCase().includes("asignad") ||
        (t.estado || "").toLowerCase().includes("asignacion")
    ).length;
    const reparadas = list.filter((t) => (t.estado || "").toLowerCase() === "reparada").length;
    const qc = list.filter((t) => (t.estado || "").toUpperCase() === "QC").length;

    // Top marcas
    const brandCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};

    list.forEach((t) => {
      const b = (t.marca || "OTRAS").trim().toUpperCase();
      brandCounts[b] = (brandCounts[b] || 0) + 1;

      const c = (t.tipoComponente || "OTRO").trim().toUpperCase();
      catCounts[c] = (catCounts[c] || 0) + 1;
    });

    const topBrands = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100 * 10) / 10,
      }));

    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100 * 10) / 10,
      }));

    return {
      total: list.length,
      entregadas,
      enReparacion,
      reparadas,
      qc,
      topBrands,
      topCategories,
    };
  }, [scopeTickets]);

  // Conteos dinámicos del ámbito para los botones de flujo operativo
  const scopeEnCamino = useMemo(() => {
    return scopeTickets.filter(isTicketEnCamino).length;
  }, [scopeTickets]);

  const scopeIngresadoCde = useMemo(() => {
    return scopeTickets.filter(isTicketIngresadoEnCde).length;
  }, [scopeTickets]);

  const scopeFaltaIngresar = useMemo(() => {
    return scopeTickets.filter(isTicketFaltaIngresar).length;
  }, [scopeTickets]);

  const scopeRecibidosList = useMemo(() => {
    return scopeTickets.filter(isTicketRecibido);
  }, [scopeTickets]);

  const scopeRecibidosCount = scopeRecibidosList.length;

  const countRecibidosTodas = scopeRecibidosCount;
  const countRecibidosHoy = useMemo(
    () => scopeRecibidosList.filter((t) => matchesRecibidosDate(t, "HOY")).length,
    [scopeRecibidosList]
  );
  const countRecibidosAyer = useMemo(
    () => scopeRecibidosList.filter((t) => matchesRecibidosDate(t, "AYER")).length,
    [scopeRecibidosList]
  );
  const countRecibidos7d = useMemo(
    () => scopeRecibidosList.filter((t) => matchesRecibidosDate(t, "ULTIMOS_7")).length,
    [scopeRecibidosList]
  );
  const countRecibidosMes = useMemo(
    () => scopeRecibidosList.filter((t) => matchesRecibidosDate(t, "ESTE_MES")).length,
    [scopeRecibidosList]
  );

  // Opciones dinámicas para CleanSelect de Estados (unificadas con el modal de detalle)
  const statusOptions = useMemo<CleanSelectOption[]>(() => {
    const counts: Record<string, number> = {};
    ESTADOS_RECEPCION_CORE.forEach((st) => {
      counts[st] = 0;
    });
    scopeTickets.forEach((t) => {
      const st = (t.estado || "En Asignacion").trim();
      if (viewScope === "CLIENTES_ASU" && isEstadoInternoNoCliente(st)) {
        return;
      }
      counts[st] = (counts[st] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b, "es"));
    return [
      { value: "TODOS", label: "Todos los estados", count: scopeTickets.length },
      ...sorted.map((st) => ({
        value: st,
        label: st,
        count: counts[st],
      })),
    ];
  }, [scopeTickets, viewScope]);

  // Mismos estados exactos para seleccionar dentro del modal del ojito
  const modalStatusOptions = useMemo<string[]>(() => {
    const list = statusOptions
      .filter((opt) => opt.value !== "TODOS")
      .map((opt) => opt.value);
    const current = (selectedTicket?.estado || "").trim();
    if (current && !list.some((st) => st.toLowerCase() === current.toLowerCase())) {
      list.push(current);
      list.sort((a, b) => a.localeCompare(b, "es"));
    }
    return list;
  }, [statusOptions, selectedTicket]);

  // Conteo de categorías normalizadas para filtro jerárquico con buscador
  const categoryCounts = useMemo<CategoryCountItem[]>(() => {
    const counts: Record<string, number> = {};
    scopeTickets.forEach((t) => {
      const c = normalizeComponentName(t.tipoComponente || "OTRO");
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category, "es"));
  }, [scopeTickets]);

  // Opciones de ordenamiento
  const sortOptions = useMemo<CleanSelectOption[]>(
    () => [
      { value: "ID_DESC", label: "Más recientes (ID ↓)" },
      { value: "ID_ASC", label: "Más antiguos (ID ↑)" },
      { value: "CLIENTE_ASC", label: "Cliente (A-Z)" },
      { value: "MARCA_ASC", label: "Marca (A-Z)" },
    ],
    []
  );

  // Filtrado y ordenamiento de tickets
  const filteredTickets = useMemo(() => {
    let result = scopeTickets;

    // 1. Filtro de Tránsito / Flujo Operativo
    if (transitFilter === "EN_CAMINO") {
      result = result.filter(isTicketEnCamino);
    } else if (transitFilter === "INGRESADO_CDE") {
      result = result.filter(isTicketIngresadoEnCde);
    } else if (transitFilter === "FALTA_INGRESAR") {
      result = result.filter(isTicketFaltaIngresar);
    } else if (transitFilter === "RECIBIDOS") {
      result = result.filter(isTicketRecibido);
      if (recibidosDateFilter !== "TODAS") {
        result = result.filter((t) => matchesRecibidosDate(t, recibidosDateFilter));
      }
    }

    // 2. Filtro de Estado
    if (statusFilter !== "TODOS") {
      result = result.filter(
        (t) => (t.estado || "").trim().toLowerCase() === statusFilter.trim().toLowerCase()
      );
    }

    // 3. Filtro Jerárquico de Categoría / Rubro
    if (categoryFamily !== "TODOS" || selectedCategories.length > 0) {
      result = result.filter((t) =>
        matchesCategoryFilter(t.tipoComponente, categoryFamily, selectedCategories)
      );
    }

    // 4. Búsqueda por texto libre (incluyendo orden de CDE y prefijo "(JC)" opcional)
    if (searchTerm.trim()) {
      result = result.filter((t) => matchesSmartSatiSearch(t, searchTerm));
    }

    // 5. Ordenamiento
    result = [...result].sort((a, b) => {
      if (sortBy === "ID_DESC") {
        return (Number(b.idOrden) || 0) - (Number(a.idOrden) || 0);
      }
      if (sortBy === "ID_ASC") {
        return (Number(a.idOrden) || 0) - (Number(b.idOrden) || 0);
      }
      if (sortBy === "CLIENTE_ASC") {
        return (a.cliente || "").localeCompare(b.cliente || "");
      }
      if (sortBy === "MARCA_ASC") {
        return (a.marca || "").localeCompare(b.marca || "");
      }
      return 0;
    });

    return result;
  }, [
    scopeTickets,
    transitFilter,
    recibidosDateFilter,
    statusFilter,
    categoryFamily,
    selectedCategories,
    searchTerm,
    sortBy,
  ]);

  // Reset a página 1 al filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [
    viewScope,
    transitFilter,
    recibidosDateFilter,
    statusFilter,
    categoryFamily,
    selectedCategories,
    searchTerm,
    sortBy,
  ]);

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  const getStatusBadge = (estado: string, fechaEntrega?: string) => {
    const label = (estado || "Pendiente").trim();
    const visual = getEstadoVisualConfig(label);

    if (visual.isDelivered) {
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${visual.badgeClass}`}>
            {label}
          </span>
          {fechaEntrega && (
            <span
              className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 block"
              title={`Fecha de entrega al cliente: ${fechaEntrega}`}
            >
              {fechaEntrega}
            </span>
          )}
        </div>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${visual.badgeClass}`}>
        {visual.isDanger && <ShieldAlert className="w-3 h-3 text-rose-600" />}
        <span>{label}</span>
      </span>
    );
  };

  return (
    <AuthGuard requiredModule="recepcion">
      <main className="min-h-dvh bg-[#fbf9f9] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 min-w-0">
        
        {/* Notificación Toast Flotante */}
        {notification && (
          <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border border-zinc-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {notification}
          </div>
        )}

        {/* Cabecera unificada */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              Recepción Post-Venta &amp; Retornos
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
              Monitoreo y trazabilidad de retornos de laboratorio técnico, garantías SATI y entregas a clientes NISSEI Ciudad del Este.
            </p>
          </div>

          {/* Al lado del cuadrito Recepción Post-Venta: Apartado para subir CSV / Excel y actualizar estados */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SPREADSHEET_FILE_ACCEPT}
              onChange={handleCSVFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!isUploadingCSV && e.dataTransfer.files?.length) {
                  void processUploadedFiles(e.dataTransfer.files);
                }
              }}
              disabled={isUploadingCSV}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer"
              title="Subir uno o varios archivos CSV o Excel (.xlsx) a la vez (ASU y/o CDE)"
            >
              <span className="w-6 h-6 rounded bg-emerald-700 text-white flex items-center justify-center">
                <Upload className="w-3.5 h-3.5" />
              </span>
              <div className="text-left leading-tight">
                <strong className="block text-xs font-bold text-zinc-900">
                  {isUploadingCSV ? "Subiendo a MySQL..." : "Subir CSV / Excel"}
                </strong>
                <span className="text-[11px] text-zinc-500 font-normal">
                  {isUploadingCSV ? "Sincronizando online" : "Uno o varios (ASU / CDE)"}
                </span>
              </div>
            </button>

            <AuthBadge
              requiredModule="recepcion"
              onSyncMysql={() => void syncRecepcionAndCdeFromCloud(true)}
            />
          </div>
        </div>

        {/* Panel de Notificación y Recuento de Actualización por CSV */}
        {csvReport && (
          <section
            className={`rounded-xl border p-4 sm:p-5 shadow-sm space-y-4 ${
              csvReport.cambios.length > 0
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-zinc-100/80 border-zinc-300"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    csvReport.cambios.length > 0
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-white"
                  }`}
                >
                  {csvReport.cambios.length > 0 ? (
                    <FileSpreadsheet className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-zinc-900">
                      {csvReport.cambios.length > 0
                        ? `¡Actualización completada! Se detectaron ${csvReport.cambios.length} cambio(s) en el CSV`
                        : "Archivo CSV verificado: No se detectaron cambios de estado"}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-zinc-200 text-zinc-600">
                      {csvReport.fileName} · {csvReport.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {csvReport.cambios.length > 0
                      ? `Se actualizaron ${csvReport.totalActualizadas} estado(s) y se cargaron ${csvReport.totalNuevas} orden(es) que no estaban en Recepción directamente al dashboard y a MySQL.`
                      : `Se compararon las ${csvReport.totalFilasLeidas.toLocaleString()} órdenes del archivo CSV y todas coinciden con los estados actuales del dashboard.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCsvReport(null)}
                className="self-end sm:self-center px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-600 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar resumen</span>
              </button>
            </div>

            {/* Tarjetas de Recuento de la Carga CSV */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Órdenes leídas en CSV</span>
                <strong className="text-lg font-extrabold text-zinc-900 font-mono">
                  {csvReport.totalFilasLeidas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Estados actualizados</span>
                <strong className="text-lg font-extrabold text-emerald-700 font-mono">
                  {csvReport.totalActualizadas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Nuevas agregadas (Recepción + MySQL)</span>
                <strong className="text-lg font-extrabold text-sky-700 font-mono">
                  {csvReport.totalNuevas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Órdenes sin cambios</span>
                <strong className="text-lg font-extrabold text-zinc-600 font-mono">
                  {csvReport.totalSinCambios.toLocaleString()}
                </strong>
              </div>
            </div>

            <SatiDepurationSummary stats={csvReport.depurationStats} />

            {/* Tabla detallada de las órdenes que cambiaron de estado o se agregaron */}
            {csvReport.cambios.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-3.5 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800">
                    Detalle de órdenes actualizadas y nuevas agregadas ({csvReport.cambios.length})
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Haz clic en una orden para buscarla en la tabla
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100">
                  {csvReport.cambios.map((c, idx) => (
                    <div
                      key={`${c.idOrden}-${idx}`}
                      onClick={() => setSearchTerm(c.idOrden)}
                      className="px-3.5 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          #{c.idOrden}
                        </span>
                        <div>
                          <strong className="text-zinc-900">{c.cliente}</strong>
                          <span className="text-zinc-500 ml-2 font-mono text-[11px]">
                            {c.equipo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {c.estadoAnterior.includes("NUEVA") ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            + NUEVA EN RECEPCIÓN Y MYSQL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-500 line-through border border-zinc-200">
                            {c.estadoAnterior}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                        {getStatusBadge(c.estadoNuevo)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 5 KPIs Principales con datos reales */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 2xl:gap-6">
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">
              {viewScope === "DANESA"
                ? "Envíos Danesa SA"
                : viewScope === "CLIENTES_ASU"
                ? "Órdenes Clientes ASU"
                : "Total Órdenes SATI"}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.total.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                {viewScope === "TODOS" ? "100% Real" : `de ${totalUniversal.toLocaleString()} tot.`}
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">
              {viewScope === "DANESA"
                ? "Nuestra Sucursal ASU"
                : viewScope === "CLIENTES_ASU"
                ? "Clientes Particulares ASU"
                : "Base SATI CDE"}
            </span>
          </div>

          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">Entregadas al Cliente</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-emerald-700 tabular-nums">
                {metrics.entregadas.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-medium tabular-nums">
                {Math.round((metrics.entregadas / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Completadas con Éxito</span>
          </div>

          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">En Reparación en Taller</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-amber-700 tabular-nums">
                {metrics.enReparacion.toLocaleString()}
              </span>
              <span className="text-xs text-amber-600 font-medium tabular-nums">
                {Math.round((metrics.enReparacion / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">En Bancos Técnicos</span>
          </div>

          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">Reparadas / Listas Entrega</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-sky-700 tabular-nums">
                {metrics.reparadas.toLocaleString()}
              </span>
              <span className="text-xs text-sky-600 font-medium tabular-nums">
                {Math.round((metrics.reparadas / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Listas para Notificar</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">En Control Calidad (QC)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-purple-700 tabular-nums">
                {metrics.qc}
              </span>
              <span className="text-xs text-purple-600 font-medium tabular-nums">
                {Math.round((metrics.qc / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Test de Ciclado Activo</span>
          </div>
        </section>

        {/* Analítica Operativa Real: Top Marcas & Categorías */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 1: Top Marcas */}
          <div className="bg-white p-5 rounded-xl border border-[#e5e5e5] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#121212]">Top Marcas de Equipos en Recepción</h3>
                <p className="text-xs text-[#888888]">Distribución según marcas con mayor flujo de servicio</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-mono">
                Sucursal CDE
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {metrics.topBrands.map((brand, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#121212] font-semibold">{brand.name}</span>
                    <span className="text-[#666666] font-mono">
                      {brand.count} equipos ({brand.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#f0f0f0] rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-slate-900"
                          : idx === 1
                          ? "bg-slate-700"
                          : idx === 2
                          ? "bg-slate-500"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.min(100, brand.pct * 3.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-xs text-[#888888] flex justify-between border-t border-[#f0f0f0]">
              <span>Mayor flujo de garantía: {metrics.topBrands[0]?.name || "N/A"}</span>
              <span className="font-mono">Auditoría SATI Activa</span>
            </div>
          </div>

          {/* Gráfico 2: Categorías de Productos */}
          <div className="bg-white p-5 rounded-xl border border-[#e5e5e5] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#121212]">Volumen por Tipo de Componente</h3>
                <p className="text-xs text-[#888888]">Carga operativa ingresada por familia de producto</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-mono">
                Carga Operativa
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {metrics.topCategories.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#121212] font-semibold">{cat.name}</span>
                    <span className="text-[#666666] font-mono">
                      {cat.count} equipos ({cat.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#f0f0f0] rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-emerald-600"
                          : idx === 1
                          ? "bg-blue-600"
                          : idx === 2
                          ? "bg-indigo-600"
                          : "bg-teal-600"
                      }`}
                      style={{ width: `${Math.min(100, cat.pct * 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-xs text-[#888888] flex justify-between border-t border-[#f0f0f0]">
              <span>Líder en volumen: {metrics.topCategories[0]?.name || "N/A"}</span>
              <span className="font-mono">Tasa de resolución: 89.2%</span>
            </div>
          </div>
        </section>

        {/* Barra de Filtros, Selector de Ámbito Reestructurado y Búsqueda */}
        <section className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">

            {/* Selector de Ámbito con las 3 pestañas solicitadas para Recepción Post-Venta */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200 flex-wrap">
              {(
                [
                  {
                    key: "DANESA" as ViewScope,
                    label: "Danesa SA (Nuestra Sucursal)",
                    count: totalDanesa,
                    icon: <Package className="w-3.5 h-3.5" />,
                  },
                  {
                    key: "CLIENTES_ASU" as ViewScope,
                    label: "Clientes ASU",
                    count: totalClientesAsu,
                    icon: <UserCheck className="w-3.5 h-3.5" />,
                  },
                  {
                    key: "TODOS" as ViewScope,
                    label: "Todos",
                    count: totalUniversal,
                    icon: <Layers className="w-3.5 h-3.5" />,
                  },
                ]
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setViewScope(s.key);
                    setTransitFilter("TODOS");
                    setRecibidosDateFilter("TODAS");
                    setStatusFilter("TODOS");
                    setCategoryFamily("TODOS");
                    setSelectedCategories([]);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    viewScope === s.key ? "bg-zinc-900 text-white shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                  <span
                    className={`px-1.5 rounded text-[10px] font-mono font-normal ${
                      viewScope === s.key ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {s.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>

            {/* Buscador de Órdenes + Escáner de Código de Barras */}
            <OrderSearchInput
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Filtros Secundarios con Flujo de Tránsito y CleanSelect */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100">
            {/* Filtro de Flujo: Todos los servicios / En camino / Ingresada en CDE / Falta ingresar / Recibidos */}
            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setTransitFilter("TODOS");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  transitFilter === "TODOS"
                    ? "bg-white font-bold text-zinc-900 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Todos los servicios
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransitFilter("EN_CAMINO");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  transitFilter === "EN_CAMINO"
                    ? "bg-amber-500 text-white font-bold shadow-xs"
                    : "text-amber-700 hover:bg-amber-100/60"
                }`}
                title="Órdenes con cruce inteligente en CDE con fecha de despacho confirmada, en tránsito de retorno hacia ASU"
              >
                <SpeedTruck
                  className={`w-3.5 h-3.5 ${transitFilter === "EN_CAMINO" ? "text-white" : "text-amber-700"}`}
                  smokeColor={transitFilter === "EN_CAMINO" ? "bg-white/80" : "bg-amber-400"}
                />
                <span>En camino ({scopeEnCamino})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransitFilter("INGRESADO_CDE");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  transitFilter === "INGRESADO_CDE"
                    ? "bg-indigo-600 text-white font-bold shadow-xs"
                    : "text-indigo-700 hover:bg-indigo-100/60"
                }`}
                title="Órdenes que ya ingresaron a laboratorio CDE pero aún no tienen fecha de despacho"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Ingresadas en CDE ({scopeIngresadoCde})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransitFilter("FALTA_INGRESAR");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  transitFilter === "FALTA_INGRESAR"
                    ? "bg-purple-600 text-white font-bold shadow-xs"
                    : "text-purple-700 hover:bg-purple-100/60"
                }`}
                title="Equipos reparados o QC con informe técnico escrito pero pendientes de recibir físicamente"
              >
                <Inbox className="w-3 h-3" />
                <span>Falta ingresar ({scopeFaltaIngresar})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransitFilter("RECIBIDOS");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  transitFilter === "RECIBIDOS"
                    ? "bg-emerald-600 text-white font-bold shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-100/60"
                }`}
              >
                <Check className="w-3 h-3" />
                <span>Recibidos ({scopeRecibidosCount})</span>
              </button>
            </div>

            {/* Filtro de Fecha de Recepción cuando se selecciona Recibidos */}
            {transitFilter === "RECIBIDOS" && (
              <div className="flex items-center gap-1 bg-emerald-50/80 p-1 rounded-xl border border-emerald-200 text-xs flex-wrap">
                <span className="text-[11px] font-bold text-emerald-900 px-2 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Fecha:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecibidosDateFilter("TODAS");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    recibidosDateFilter === "TODAS"
                      ? "bg-emerald-700 text-white font-bold shadow-xs"
                      : "text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Todas ({countRecibidosTodas})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecibidosDateFilter("HOY");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    recibidosDateFilter === "HOY"
                      ? "bg-emerald-700 text-white font-bold shadow-xs"
                      : "text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Hoy ({countRecibidosHoy})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecibidosDateFilter("AYER");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    recibidosDateFilter === "AYER"
                      ? "bg-emerald-700 text-white font-bold shadow-xs"
                      : "text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Ayer ({countRecibidosAyer})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecibidosDateFilter("ULTIMOS_7");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    recibidosDateFilter === "ULTIMOS_7"
                      ? "bg-emerald-700 text-white font-bold shadow-xs"
                      : "text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Últimos 7 días ({countRecibidos7d})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecibidosDateFilter("ESTE_MES");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    recibidosDateFilter === "ESTE_MES"
                      ? "bg-emerald-700 text-white font-bold shadow-xs"
                      : "text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Este mes ({countRecibidosMes})
                </button>
              </div>
            )}

            {/* Filtro de Estado con CleanSelect */}
            <CleanSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              className="max-w-[180px]"
            />

            {/* Filtro Jerárquico de Categoría / Rubro con buscador y subdesplegables */}
            <CategoryFilterSelect
              categories={categoryCounts}
              totalCount={scopeTickets.length}
              selectedFamily={categoryFamily}
              selectedCategories={selectedCategories}
              onChange={(famId, cats) => {
                setCategoryFamily(famId);
                setSelectedCategories(cats);
                setCurrentPage(1);
              }}
            />

            {/* Ordenamiento */}
            <CleanSelect
              options={sortOptions}
              value={sortBy}
              onChange={(val) => {
                setSortBy(val as any);
                setCurrentPage(1);
              }}
              icon={<ArrowUpDown className="w-3.5 h-3.5" />}
              className="max-w-[195px]"
            />

            {/* Resetear Filtros */}
            {(statusFilter !== "TODOS" || categoryFamily !== "TODOS" || selectedCategories.length > 0 || transitFilter !== "TODOS" || recibidosDateFilter !== "TODAS" || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("TODOS");
                  setCategoryFamily("TODOS");
                  setSelectedCategories([]);
                  setTransitFilter("TODOS");
                  setRecibidosDateFilter("TODAS");
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer ml-auto"
                title="Restablecer todos los filtros a sus valores predeterminados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer filtros</span>
              </button>
            )}
          </div>
        </section>

        {/* Tabla de Tickets de Recepción */}
        <section className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {viewScope === "DANESA"
                  ? `Envíos Danesa SA (Nuestra Sucursal ASU) (${filteredTickets.length})`
                  : viewScope === "CLIENTES_ASU"
                  ? `Órdenes de Clientes ASU (${filteredTickets.length})`
                  : `Tickets de Recepción & Retornos Post-Venta (${filteredTickets.length})`}
              </h3>
              <p className="text-xs text-zinc-500">
                {viewScope === "DANESA"
                  ? "Envíos directos de Danesa SA a laboratorio técnico y retornos"
                  : viewScope === "CLIENTES_ASU"
                  ? "Servicios técnicos y garantías de clientes NISSEI Asunción"
                  : "Registros sincronizados con la base central de NISSEI SATI"}
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono text-zinc-600 bg-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-200 tabular-nums">
                Página {currentPage} de {totalPages} ({filteredTickets.length} resultados)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wide border-b border-zinc-200 font-mono">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nº Orden</th>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Equipo &amp; Categoría</th>
                  <th className="py-3 px-4 font-semibold">Nº Serie / IMEI</th>
                  <th className="py-3 px-4 font-semibold">Mensaje / Detalle Técnico</th>
                  <th className="py-3 px-4 font-semibold">Ingreso / Salida</th>
                  <th className="py-3 px-4 font-semibold">Estado</th>
                  <th className="py-3 px-4 font-semibold min-w-[150px] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No se encontraron órdenes que coincidan con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => (
                    <tr key={ticket.idOrden} className="hover:bg-zinc-50/75 transition-colors">
                      {/* Nº Orden */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-900 font-mono tabular-nums">#{ticket.idOrden}</span>
                          {isTicketRecibido(ticket) ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title={`Recibido en depósito: ${ticket.fechaRecibidoDeposito || ''}`}
                            >
                              ✓ RECIBIDO · LISTO RETIRO
                            </span>
                          ) : isTicketEnCamino(ticket) ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200"
                              title={`En camino por transportadora desde CDE (Despachado: ${ticket.fechaDespachoCde || 'En tránsito'}${ticket.idOrdenCde ? ` · CDE #${ticket.idOrdenCde}` : ''})`}
                            >
                              <SpeedTruck className="w-3 h-3 text-amber-600" smokeColor="bg-amber-400" />
                              <span>EN CAMINO</span>
                            </span>
                          ) : isTicketIngresadoEnCde(ticket) ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                              title={`Ingresada en laboratorio técnico CDE: ${ticket.fechaIngresoCde || 'En taller CDE'}${ticket.idOrdenCde ? ` · CDE #${ticket.idOrdenCde}` : ''}`}
                            >
                              <Building2 className="w-3 h-3 text-indigo-600" />
                              <span>INGRESADA EN CDE</span>
                            </span>
                          ) : isTicketFaltaIngresar(ticket) ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200"
                              title="Equipo con informe técnico listo pero pendiente de ingreso físico en recepción"
                            >
                              <Inbox className="w-3 h-3 text-purple-600" />
                              <span>FALTA INGRESAR</span>
                            </span>
                          ) : null}
                          {isTicketNuevoIngreso(ticket) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              NUEVO INGRESO
                            </span>
                          )}
                          {isTicketEntregadoReciente(ticket) ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              RECIÉN ENTREGADO
                            </span>
                          ) : (
                            isTicketEstadoCambiadoReciente(ticket) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                ESTADO CAMBIADO
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-zinc-500 font-mono tabular-nums">Cód: {ticket.codigoProducto || "N/A"}</span>
                          {ticket.idOrdenCde && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              <span>CDE #{ticket.idOrdenCde}</span>
                              {ticket.fechaDespachoCde ? (
                                <span className="text-amber-800 font-semibold">· Despacho: {ticket.fechaDespachoCde}</span>
                              ) : ticket.fechaIngresoCde ? (
                                <span className="text-zinc-600 font-normal">· Ingreso CDE: {ticket.fechaIngresoCde}</span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">{ticket.cliente || "Cliente Particular"}</div>
                        {isTicketDanesa(ticket.cliente) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 mt-0.5">
                            <Package className="w-3 h-3 text-amber-700" />
                            <span>Danesa SA</span>
                          </span>
                        )}
                      </td>

                      {/* Equipo & Categoría */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 truncate max-w-[200px]" title={`${ticket.marca} ${ticket.modelo}`}>
                          <span className="font-bold">{ticket.marca}</span> {ticket.modelo}
                        </div>
                        <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[11px] bg-zinc-100 text-zinc-700 font-mono">
                          {ticket.tipoComponente || "GENERAL"}
                        </span>
                      </td>

                      {/* Nº Serie */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                        {ticket.serial || "S/N"}
                      </td>

                      {/* Mensaje / Detalle */}
                      {(() => {
                        const formattedMensaje = formatSatiSentenceCase(ticket.mensaje);
                        return (
                          <td className="py-3 px-4 text-zinc-600 max-w-xs truncate" title={formattedMensaje}>
                            {formattedMensaje || "Sin observaciones técnicas registradas."}
                          </td>
                        );
                      })()}

                      {/* Fechas */}
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap tabular-nums">
                        <div className="text-zinc-900">Ingreso: {ticket.fechaIngreso || "N/A"}</div>
                        {ticket.fechaEntregada && (
                          <div className="text-[10px] text-zinc-500">Entrega: {ticket.fechaEntregada}</div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(ticket.estado, ticket.fechaEntregada || ticket.fechaRecibidoDeposito)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {isTicketRecibido(ticket) ? (
                            <button
                              type="button"
                              onClick={() => handleAbrirParaNotificar(ticket)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                              title={`Recibido · Listo para que retire el cliente (${ticket.fechaRecibidoDeposito || ''}). Click para ver detalle o re-notificar.`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              <span>Listo retiro</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAbrirParaNotificar(ticket)}
                              className="p-1.5 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors flex items-center justify-center cursor-pointer"
                              title="Completar informe técnico para recibir y notificar al grupo"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setShowPrintModal(ticket)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center"
                            title="Imprimir Boleta SATI"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {ticket.estado.toLowerCase() === "entregada" ? (
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded font-mono text-xs">
                              Entregado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCambiarEstado(ticket.idOrden, "Entregada")}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-black text-white rounded font-medium text-xs transition-colors shadow-sm"
                            >
                              Entregar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación */}
          <div className="p-4 border-t border-[#e5e5e5] bg-[#fcfbfb] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#666666]">
              Mostrando{" "}
              <strong className="text-[#121212]">
                {filteredTickets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}
              </strong>{" "}
              a{" "}
              <strong className="text-[#121212]">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}
              </strong>{" "}
              de <strong className="text-[#121212]">{filteredTickets.length.toLocaleString()}</strong> tickets
            </span>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                « Primera
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-mono font-semibold bg-white border border-[#e5e5e5] rounded">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Última »
              </button>
            </div>
          </div>
        </section>

        {/* Sección: Depósito Danesa · Monitoreo de Transportadora & Rendimiento Casa Matriz CDE */}
        <section className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-zinc-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
              <SpeedTruck className="w-5 h-5 text-zinc-800" smokeColor="bg-zinc-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[10px] font-mono uppercase font-bold text-zinc-700 tracking-wider">
                  Módulo Depósito Danesa
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  Casa Matriz CDE ↔ Sucursal ASU
                </span>
              </div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">
                Monitoreo de Transportadora &amp; Rendimiento Taller Central CDE
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Consulte el estado de los equipos enviados a Casa Matriz CDE (
                <code className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 font-mono text-[11px]">
                  recepcion-cde.csv
                </code>
                ), tiempos de resolución de laboratorio, veredictos técnicos y confirmación de llegada de cajas físicas al día siguiente en depósito.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={handleOpenDeposito}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Box className="w-4 h-4 text-zinc-300" />
              <span>Acceder a SATI ASU - CDE</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300" />
            </button>
          </div>
        </section>

        {/* Modal de Autenticación de SATI ASU - CDE */}
        {showDepositoAuthModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-900">
                    <SpeedTruck className="w-4 h-4 text-amber-900" smokeColor="bg-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">SATI ASU - CDE</h3>
                    <span className="text-[10px] text-zinc-500 font-mono">Control Casa Matriz CDE &amp; Transporte</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDepositoAuthModal(false)}
                  className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleVerifyDeposito} className="space-y-3.5">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Ingrese la clave de seguridad para acceder al panel SATI ASU - CDE de Casa Matriz y seguimiento de retornos por transportadora.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 block">
                    Contraseña de SATI ASU - CDE
                  </label>
                  <div className="relative">
                    <input
                      type={showDepPass ? "text" : "password"}
                      value={depositoPassword}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDepositoPassword(val);
                        setDepositoAuthError(null);
                        if (verifyDepositoPassword(val)) {
                          if (verifyAdminPassword(val)) {
                            authenticate("admin", val);
                          } else {
                            authenticate("deposito.danesa", val);
                          }
                          setShowDepositoAuthModal(false);
                          router.push("/recepcion/cde");
                        }
                      }}
                      placeholder="Ingrese contraseña de acceso..."
                      autoFocus
                      className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 pr-8 focus:border-zinc-900 focus:bg-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDepPass(!showDepPass)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700"
                    >
                      {showDepPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {depositoAuthError && (
                  <p className="text-xs text-rose-600 font-medium">
                    {depositoAuthError}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDepositoAuthModal(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    Ingresar al Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Detalle Completo de la Orden */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg 2xl:max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 border border-[#e5e5e5] max-h-[92dvh] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                <div>
                  <span className="text-[11px] font-mono text-[#888888] uppercase">DETALLE DE ORDEN SATI</span>
                  <h3 className="text-lg 2xl:text-xl font-bold text-[#121212]">
                    Orden #{selectedTicket.idOrden} · {selectedTicket.marca} {selectedTicket.modelo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-[#888888] hover:text-[#121212] text-xl font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#f9f9f9] p-3.5 rounded-xl border border-[#f0f0f0]">
                  <div>
                    <span className="text-[#888888] block text-[11px]">Cliente</span>
                    <strong className="text-[#121212] text-sm">{selectedTicket.cliente}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Código de Producto</span>
                    <strong className="text-[#121212] font-mono">{selectedTicket.codigoProducto || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Fecha de Ingreso</span>
                    <strong className="text-[#121212] font-mono">{selectedTicket.fechaIngreso || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Fecha de Entrega</span>
                    {selectedTicket.recibidoEnDeposito ? (
                      <strong className="text-emerald-700 font-bold flex items-center gap-1 font-sans text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Recibido · Listo para que retire el cliente</span>
                      </strong>
                    ) : (
                      <strong className="text-[#121212] font-mono">{selectedTicket.fechaEntregada || "Pendiente de retiro"}</strong>
                    )}
                  </div>
                  {selectedTicket.fechaVenta && (
                    <div>
                      <span className="text-[#888888] block text-[11px]">Fecha de Venta</span>
                      <strong className="text-[#121212] font-mono">{selectedTicket.fechaVenta}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-[#888888] block text-[11px]">Estado Actual</span>
                    <div className="mt-0.5">{getStatusBadge(selectedTicket.estado)}</div>
                  </div>
                </div>

                <div>
                  <span className="text-[#888888] block mb-1 text-[11px]">Identificación del Hardware</span>
                  <div className="p-3 bg-white border border-[#e5e5e5] rounded-xl space-y-1">
                    <div className="font-bold text-sm text-[#121212]">
                      {selectedTicket.marca} {selectedTicket.modelo}
                    </div>
                    <div className="text-[11px] text-[#555555] font-mono flex items-center justify-between">
                      <span>Categoría: {selectedTicket.tipoComponente}</span>
                      <span>S/N: <strong>{selectedTicket.serial || "N/A"}</strong></span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#888888] font-bold text-[11px] uppercase tracking-wider">
                      Informe Técnico / Mensaje de Servicio
                    </span>
                    <button
                      type="button"
                      onClick={handleGuardarMensaje}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                      title="Guardar observaciones y accesorios"
                    >
                      <Save className="w-3 h-3" />
                      <span>Guardar cambios</span>
                    </button>
                  </div>
                  <textarea
                    ref={modalTextareaRef}
                    value={modalMensaje}
                    onChange={(e) => setModalMensaje(e.target.value)}
                    placeholder="Añada o modifique aquí el informe técnico, observaciones del laboratorio, pruebas ejecutadas..."
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-300 focus:border-zinc-900 rounded-xl text-xs text-[#222222] leading-relaxed outline-none transition-all placeholder:text-zinc-400 font-sans shadow-sm"
                  />
                </div>

                {/* Sección de Accesorios Incluidos / Devueltos con el Equipo */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#888888] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#555555]" />
                      Accesorios Incluidos / Devueltos con el Equipo
                    </span>
                    {modalAccessoriesList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearModalAccessories}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        Limpiar todos
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-white border border-slate-300 rounded-xl space-y-2.5 shadow-sm">
                    {/* Chips de accesorios actuales */}
                    <div className="flex flex-wrap items-center gap-1.5 min-h-[26px]">
                      {modalAccessoriesList.length > 0 ? (
                        modalAccessoriesList.map((acc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg text-xs font-medium border border-zinc-200 transition-colors"
                          >
                            <Tag className="w-3 h-3 text-zinc-500" />
                            <span>{acc}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveModalAccessory(idx)}
                              className="ml-1 text-zinc-400 hover:text-rose-600 font-bold leading-none cursor-pointer"
                              title="Quitar accesorio"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400 italic">
                          Sin accesorios registrados (se notificará &quot;Sin accesorios adicionales&quot;)
                        </span>
                      )}
                    </div>

                    {/* Input para agregar accesorio personalizado */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={modalNewAccessory}
                        onChange={(e) => setModalNewAccessory(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddModalAccessory(modalNewAccessory);
                          }
                        }}
                        placeholder="Escriba un accesorio (ej: Cargador 230W, Funda, Caja) y presione Enter o +"
                        className="flex-1 px-3 py-1.5 text-xs bg-zinc-50 border border-slate-200 focus:border-zinc-900 rounded-lg outline-none transition-colors placeholder:text-zinc-400 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddModalAccessory(modalNewAccessory)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        title="Agregar accesorio a la lista"
                      >
                        + Agregar
                      </button>
                    </div>

                    {/* Sugerencias rápidas con un toque */}
                    <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-dashed border-zinc-200 text-[11px]">
                      <span className="text-zinc-400 mr-1 font-mono text-[10px]">RÁPIDOS:</span>
                      {[
                        "Cargador Original",
                        "Caja Original",
                        "Cable USB",
                        "Funda / Estuche",
                        "Control Remoto",
                        "Batería",
                        "Adaptador de Corriente",
                      ].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleAddModalAccessory(sug)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            modalAccessoriesList.includes(sug)
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
                          }`}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Acciones de cambio de estado en el modal (sincronizado con el filtro de estados) */}
                <div className="p-3 bg-[#fdfdfd] border border-[#e5e5e5] rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#555555]">
                      Cambiar estado:
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Se incluirá al notificar al cliente
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {modalStatusOptions.map((st) => {
                      const isActive =
                        (selectedTicket.estado || "").trim().toLowerCase() ===
                        st.trim().toLowerCase();
                      const visual = getEstadoVisualConfig(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleCambiarEstado(selectedTicket.idOrden, st)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            isActive ? visual.activeBtnClass : visual.inactiveBtnClass
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3 stroke-[3] shrink-0" />}
                          <span>{st}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selector de Dictamen Técnico / Resolución QC + Vista previa en vivo para WhatsApp */}
                {(() => {
                  const accPreview =
                    modalAccessoriesList.length > 0
                      ? modalAccessoriesList.join(", ")
                      : modalAccesorios;
                  const preview = resolveDictamenRecepcion(
                    selectedTicket.estado,
                    modalMensaje,
                    accPreview,
                    modalDictamenTipo
                  );
                  return (
                    <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                          Dictamen Técnico · Resolución QC (WhatsApp)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {preview.sourceLabel}
                        </span>
                      </div>

                      {/* Selector rápido de resoluciones QC */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {DICTAMEN_QC_OPTIONS.map((opt) => {
                          const selected = modalDictamenTipo === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleCambiarDictamen(selectedTicket.idOrden, opt.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                                selected ? opt.chipActive : opt.chipInactive
                              }`}
                            >
                              {selected && <Check className="w-3 h-3 stroke-[3] shrink-0" />}
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-xs text-zinc-800 space-y-1 bg-white/90 p-2.5 rounded-lg border border-emerald-100">
                        <div className="font-bold text-zinc-900">{preview.headerPlain}</div>
                        <p className="text-zinc-600 leading-relaxed">{preview.body}</p>
                        {preview.detalleTexto ? (
                          <p className="text-zinc-700 pt-1 border-t border-dashed border-zinc-200">
                            <span className="font-semibold">Detalle:</span> {preview.detalleTexto}
                          </p>
                        ) : (
                          <p className="text-zinc-400 italic pt-1 border-t border-dashed border-zinc-200">
                            Complete &quot;Informe Técnico / Mensaje de Servicio&quot; arriba para incluir el detalle.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-3 border-t border-[#e5e5e5] flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleNotificarWhatsAppRecepcion(selectedTicket)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-colors ${
                    selectedTicket.recibidoEnDeposito
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {selectedTicket.recibidoEnDeposito ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>Recibido · Listo para retiro (Re-notificar)</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span>Notificar por WhatsApp &amp; Marcar Recibido</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 bg-[#1c1c1e] text-white rounded-xl text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Impresión de Boleta */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-[#e5e5e5]">
              <div className="text-center border-b border-[#e5e5e5] pb-3">
                <h2 className="text-xl font-black text-[#121212]">Nissei Post-Venta</h2>
                <div className="mt-2 inline-block px-3 py-1 bg-[#eeeeee] font-mono text-xs rounded font-bold">
                  COMPROBANTE DEL SERVICIO POST - VENTA NISSEI
                </div>
              </div>

              <div className="text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#888888]">Nº ORDEN:</span>
                  <span className="font-bold">#{showPrintModal.idOrden}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">CÓDIGO PROD:</span>
                  <span className="font-bold">{showPrintModal.codigoProducto || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">CLIENTE:</span>
                  <span className="font-semibold">{showPrintModal.cliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">EQUIPO:</span>
                  <span>{showPrintModal.marca} {showPrintModal.modelo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">Nº SERIE:</span>
                  <span>{showPrintModal.serial || "S/N"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">ESTADO:</span>
                  <span className="font-bold uppercase">{showPrintModal.estado}</span>
                </div>
                {showPrintModal.accesorios && (
                  <div className="border-t border-dashed border-[#cccccc] pt-2 flex justify-between gap-2">
                    <span className="text-[#888888]">ACCESORIOS:</span>
                    <span className="font-semibold text-right max-w-[240px] text-[11px]">
                      {showPrintModal.accesorios}
                    </span>
                  </div>
                )}
                <div className="border-t border-dashed border-[#cccccc] pt-2">
                  <span className="text-[#888888] block mb-1">INFORME TÉCNICO:</span>
                  <span className="text-[11px] font-sans text-slate-700 block leading-tight">
                    {formatSatiSentenceCase(showPrintModal.mensaje) || "Sin observaciones."}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-[#e5e5e5] flex justify-between items-center">
                <button
                  onClick={() => setShowPrintModal(null)}
                  className="px-4 py-2 border border-[#e5e5e5] rounded-xl text-xs font-semibold text-[#555555]"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-5 py-2 bg-[#121212] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-black"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprobante
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
    </AuthGuard>
  );
}
