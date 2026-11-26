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
  BarChart3,
  Activity,
  ShieldCheck,
  Timer,
  Users,
  Loader2,
  MapPin,
  ChevronDown,
  Cable,
} from "lucide-react";
import {
  UbicacionCascadaSelector,
  extractUbicacionFromText,
} from "@/components/common/UbicacionCascadaSelector";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import CategoryFilterSelect, { CategoryCountItem } from "@/components/common/CategoryFilterSelect";
import { OrderSearchInput } from "@/components/common/OrderSearchInput";
import { matchesCategoryFilter, normalizeComponentName } from "@/data/recepcionCategories";
import {
  QUICK_ACCESSORIES_BY_TYPE_STORAGE_KEY,
  getComponentAccessoryKey,
  getDefaultAccessoriesForComponent,
} from "@/data/recepcionAccesorioPresets";
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
  updateTicketDetailsAsync,
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
import { SatiThermalPrintModal } from "@/components/common/SatiThermalPrintModal";
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
  "Cambio por nuevo",
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
  badgeClass: "bg-[#FFFDF9] text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
  inactiveBtnClass: "bg-[#FFFDF9] text-black border-2 border-black hover:bg-[#FFD23F] font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
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
      badgeClass: "bg-[#2A9D8F]/25 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#2A9D8F]/25 text-black border-2 border-black hover:bg-[#2A9D8F]/45 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      isDelivered: true,
      readyForPickup: true,
      whatsappHeader: "✅ *ENTREGADA*",
      whatsappBody: "Confirmamos que el equipo figura como entregado conforme en el sector de Post-Venta.",
    };
  }
  if (norm.includes("cambio") && norm.includes("nuevo")) {
    return {
      badgeClass: "bg-[#2A9D8F]/30 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#2A9D8F]/25 text-black border-2 border-black hover:bg-[#2A9D8F]/45 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: true,
      whatsappHeader: "✨ *APROBADO CAMBIO POR NUEVO (GARANTÍA)*",
      whatsappBody: "El proveedor autorizó la garantía oficial y se realizó el cambio por un equipo nuevo. La nueva unidad se encuentra lista para su entrega o retiro.",
    };
  }
  if (norm.includes("nota de credito") || norm.includes("nota de credito")) {
    return {
      badgeClass: "bg-indigo-200 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-indigo-100 text-black border-2 border-black hover:bg-indigo-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: true,
      whatsappHeader: "💳 *NOTA DE CRÉDITO COMERCIAL (PROVEEDOR)*",
      whatsappBody: "El proveedor aprobó la emisión de Nota de Crédito comercial por el valor del producto para su aplicación en el salón comercial.",
    };
  }
  if (norm === "reparada") {
    return {
      badgeClass: "bg-sky-200 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-sky-100 text-black border-2 border-black hover:bg-sky-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: true,
      whatsappHeader: "✅ *REPARADO CON ÉXITO*",
      whatsappBody: "El equipo fue reparado satisfactoriamente, superó las pruebas técnicas y está listo para ser retirado.",
    };
  }
  if (norm === "qc" || norm.includes("control de calidad")) {
    return {
      badgeClass: "bg-purple-200 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-purple-100 text-black border-2 border-black hover:bg-purple-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: true,
      whatsappHeader: "🔬 *EN CONTROL DE CALIDAD (QC)*",
      whatsappBody: "El equipo se encuentra en etapa final de pruebas y control de calidad en Post-Venta.",
    };
  }
  if (norm.includes("pendiente") && norm.includes("repuesto")) {
    return {
      badgeClass: "bg-[#FFD23F]/40 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#FFD23F]/30 text-black border-2 border-black hover:bg-[#FFD23F]/55 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: false,
      whatsappHeader: "⏳ *PENDIENTE POR REPUESTO*",
      whatsappBody: "El equipo se encuentra en espera de llegada/disponibilidad de repuesto para completar su reparación.",
    };
  }
  if (norm.includes("reparacion")) {
    return {
      badgeClass: "bg-[#FFD23F]/50 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#FFD23F]/35 text-black border-2 border-black hover:bg-[#FFD23F]/60 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: false,
      whatsappHeader: "🔧 *EN REPARACIÓN*",
      whatsappBody: "El equipo se encuentra en proceso de diagnóstico e intervención técnica en taller.",
    };
  }
  if (norm === "asignada") {
    return {
      badgeClass: "bg-indigo-200 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-indigo-100 text-black border-2 border-black hover:bg-indigo-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: false,
      whatsappHeader: "👨‍🔧 *ASIGNADA A TÉCNICO*",
      whatsappBody: "La orden ya fue asignada a un técnico especialista para su revisión.",
    };
  }
  if (norm.includes("en asignacion")) {
    return {
      badgeClass: "bg-[#FFFDF9] text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#FFFDF9] text-black border-2 border-black hover:bg-neutral-100 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: false,
      whatsappHeader: "📋 *EN ASIGNACIÓN*",
      whatsappBody: "La orden fue registrada y aguarda asignación al equipo técnico.",
    };
  }
  if (norm.includes("sin reparo") || norm.includes("liquidacion") || norm.includes("rechaz")) {
    return {
      badgeClass: "bg-[#E76F51]/30 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#E76F51]/20 text-black border-2 border-black hover:bg-[#E76F51]/40 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      isDanger: norm.includes("sin reparo"),
      readyForPickup: norm.includes("sin reparo"),
      whatsappHeader: `⚠️ *${(estado || "SIN REPARO").toUpperCase()}*`,
      whatsappBody: "Se requiere gestión comercial, autorización o retiro según el dictamen técnico informado.",
    };
  }
  if (norm.includes("presupuest")) {
    return {
      badgeClass: "bg-cyan-200 text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-cyan-100 text-black border-2 border-black hover:bg-cyan-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      readyForPickup: false,
      whatsappHeader: `💰 *${(estado || "PRESUPUESTADA").toUpperCase()}*`,
      whatsappBody: "Se emitió el presupuesto correspondiente y aguarda confirmación del cliente.",
    };
  }
  if (norm.includes("stock")) {
    return {
      badgeClass: "bg-[#FAF6EE] text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]",
      inactiveBtnClass: "bg-[#FAF6EE] text-black border-2 border-black hover:bg-neutral-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
      activeBtnClass: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
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

/**
 * Rango de agrupación por familia de color para ordenar los estados primero por color
 * y luego alfabéticamente por su nombre.
 */
function getEstadoColorRank(estado?: string): number {
  const norm = (estado || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  // 1. Verde (Emerald)
  if (norm === "entregada" || (norm.includes("cambio") && norm.includes("nuevo"))) {
    return 1;
  }
  // 2. Azul / Celeste (Sky & Cyan)
  if (norm === "reparada" || norm.includes("presupuest")) {
    return 2;
  }
  // 3. Índigo / Púrpura (Indigo & Purple)
  if (
    norm === "asignada" ||
    norm === "qc" ||
    norm.includes("control de calidad") ||
    norm.includes("nota de credito")
  ) {
    return 3;
  }
  // 4. Ámbar / Naranja (Amber & Orange)
  if (norm.includes("reparacion") || (norm.includes("pendiente") && norm.includes("repuesto"))) {
    return 4;
  }
  // 5. Rojo / Rosa (Rose)
  if (norm.includes("sin reparo") || norm.includes("liquidacion") || norm.includes("rechaz")) {
    return 5;
  }
  // 6. Gris / Neutro (Slate & Zinc)
  return 6;
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
    chipInactive: "bg-[#FFFDF9] text-black border-2 border-black hover:bg-neutral-100 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  // 1. Familia Verde / Esmeralda / Teal (Orden alfabético)
  {
    id: "CAMBIO_NUEVO",
    label: "Cambio por nuevo",
    whatsappHeader: "✨ *CAMBIO POR EQUIPO NUEVO*",
    whatsappBody:
      "El proveedor autorizó la garantía oficial y se realizó el cambio por un equipo nuevo. La nueva unidad se encuentra lista para su entrega o retiro.",
    readyForPickup: true,
    chipInactive: "bg-[#2A9D8F]/25 text-black border-2 border-black hover:bg-[#2A9D8F]/45 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  {
    id: "PRESUPUESTO_PENDIENTE",
    label: "Presupuesto · Aguarda aprobación",
    whatsappHeader: "💰 *PRESUPUESTO EMITIDO · AGUARDA APROBACIÓN*",
    whatsappBody:
      "La reparación se encuentra fuera de garantía y se emitió presupuesto técnico aguardando aprobación del cliente.",
    readyForPickup: false,
    chipInactive: "bg-teal-100 text-black border-2 border-black hover:bg-teal-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  // 2. Familia Azul / Celeste (Orden alfabético)
  {
    id: "REPARADO",
    label: "Reparado con éxito",
    whatsappHeader: "✅ *REPARADO CON ÉXITO*",
    whatsappBody:
      "El equipo fue reparado satisfactoriamente, superó las pruebas técnicas y está listo para ser retirado.",
    readyForPickup: true,
    chipInactive: "bg-sky-100 text-black border-2 border-black hover:bg-sky-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  {
    id: "SIN_DEFECTO",
    label: "Sin defectos / Normal",
    whatsappHeader: "ℹ️ *SIN DEFECTO COMPROBADO*",
    whatsappBody:
      "El equipo funciona dentro de los parámetros normales de fábrica y no reprodujo la falla reportada. Conserva su garantía vigente.",
    readyForPickup: true,
    chipInactive: "bg-cyan-100 text-black border-2 border-black hover:bg-cyan-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  // 3. Familia Púrpura
  {
    id: "QC_PRUEBAS",
    label: "Control de Calidad (QC)",
    whatsappHeader: "🔬 *EN CONTROL DE CALIDAD (QC)*",
    whatsappBody:
      "El equipo se encuentra en fase final de pruebas de verificación y control de calidad.",
    readyForPickup: true,
    chipInactive: "bg-purple-100 text-black border-2 border-black hover:bg-purple-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  // 4. Familia Ámbar / Amarillo / Naranja (Orden alfabético)
  {
    id: "RMA_NC",
    label: "Derivado a RMA / Nota de crédito",
    whatsappHeader: "⚠️ *DERIVADO A RMA / NOTA DE CRÉDITO*",
    whatsappBody:
      "El equipo fue derivado a gestión de garantía con fabricante/importador para cambio o emisión de nota de crédito comercial.",
    readyForPickup: true,
    chipInactive: "bg-amber-100 text-black border-2 border-black hover:bg-amber-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  {
    id: "DESGASTE_NATURAL",
    label: "Desgaste natural / Consumible",
    whatsappHeader: "🔋 *DESGASTE NATURAL / CONSUMIBLE*",
    whatsappBody:
      "La incidencia corresponde a desgaste normal de uso o componente consumible fuera de cobertura de garantía.",
    readyForPickup: true,
    chipInactive: "bg-[#FFD23F]/40 text-black border-2 border-black hover:bg-[#FFD23F]/65 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  {
    id: "SIN_REPARO_REPUESTO",
    label: "Sin reparo · Falta de repuesto",
    whatsappHeader: "⏳ *SIN REPARO POR FALTA DE REPUESTO*",
    whatsappBody:
      "No fue posible completar la reparación por falta de disponibilidad del repuesto requerido. Corresponde gestión de cambio / nota de crédito o retiro.",
    readyForPickup: true,
    chipInactive: "bg-orange-100 text-black border-2 border-black hover:bg-orange-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  // 5. Familia Rojo / Rosa (Orden alfabético)
  {
    id: "MALA_MANIPULACION",
    label: "Mala manipulación (Cliente)",
    whatsappHeader: "🚫 *MALA MANIPULACIÓN / FUERA DE GARANTÍA*",
    whatsappBody:
      "Se constató daño físico, golpe, humedad o manipulación indebida por parte del cliente, por lo que no aplica cobertura de garantía de fábrica.",
    readyForPickup: true,
    chipInactive: "bg-[#E76F51]/25 text-black border-2 border-black hover:bg-[#E76F51]/45 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  {
    id: "SIN_REPARO_IRREPARABLE",
    label: "Sin reparo · No reparable",
    whatsappHeader: "❌ *SIN REPARO · NO REPARABLE*",
    whatsappBody:
      "El diagnóstico técnico determinó que el daño no es reparable. Se deriva a gestión de garantía, cambio comercial o retiro.",
    readyForPickup: true,
    chipInactive: "bg-[#E76F51]/25 text-black border-2 border-black hover:bg-[#E76F51]/45 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  // 6. Familia Gris / Neutro (Orden alfabético)
  {
    id: "GARANTIA_VENCIDA",
    label: "Garantía vencida",
    whatsappHeader: "📅 *GARANTÍA VENCIDA*",
    whatsappBody:
      "El equipo superó el período de garantía oficial vigente; disponible servicio particular bajo presupuesto o retiro.",
    readyForPickup: true,
    chipInactive: "bg-neutral-100 text-black border-2 border-black hover:bg-neutral-200 font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
  },
  {
    id: "PRESUPUESTO_RECHAZADO",
    label: "Presupuesto rechazado",
    whatsappHeader: "↩️ *PRESUPUESTO RECHAZADO*",
    whatsappBody:
      "El presupuesto informado no fue aprobado; el equipo se encuentra disponible para retiro sin reparar.",
    readyForPickup: true,
    chipInactive: "bg-[#FFFDF9] text-[#E76F51] border-2 border-black hover:bg-[#E76F51] hover:text-white font-heading font-extrabold shadow-[2px_2px_0px_#000]",
    chipActive: "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]",
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

  const tieneCambioPorNuevoTexto =
    /\b(?:cambi[oa]\s+por\s+nuevo|cambio\s+de\s+equipo|reemplazo\s+por\s+nuevo|unidad\s+nueva|entrega\s+nuevo|swap)\b/i.test(
      msgNorm
    );

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
    /\b(?:sin\s+reparo|no\s+reparable|no\s+reparado)\b/i.test(
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

  if (estNorm.includes("cambio") && estNorm.includes("nuevo")) {
    pickOption("CAMBIO_NUEVO", `Automático · Estado "${estadoActual}"`);
  } else if (tieneCambioPorNuevoTexto) {
    pickOption("CAMBIO_NUEVO", 'Detectado en Informe Técnico ("Cambio por nuevo")');
  } else if (tieneSinReparoRepuestoEstado) {
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
type TransitFilter = "TODOS" | "EN_CAMINO" | "INGRESADO_CDE" | "FALTA_INGRESAR" | "RECIBIDOS" | "A_DEPOSITO";
type RecibidosDateFilter = "TODAS" | "HOY" | "AYER" | "ULTIMOS_7" | "ESTE_MES";

function getEffectiveRetentionDate(ticket: RecepcionTicket): Date | null {
  // Si el equipo retornó de reparación/CDE y fue recibido en ASU:
  if (ticket.recibidoEnDeposito) {
    const rawRetorno = ticket.fechaRecibidoDeposito || ticket.fechaDespachoCde;
    if (rawRetorno) {
      const d = parseFechaDMY(rawRetorno);
      if (d) return d;
    }
  }
  // Si no retornó de reparación, el plazo rige desde el ingreso original a sucursal
  if (ticket.fechaIngreso) {
    return parseFechaDMY(ticket.fechaIngreso);
  }
  return null;
}

function isTicketVencidoDeposito(ticket: RecepcionTicket): boolean {
  // Stock propio / Danesa SA no aplica a plazo de 90 días por retiro de cliente
  if (isTicketDanesa(ticket.cliente)) return false;

  // Solo aplica a equipos aún en poder de la sucursal (no entregados al cliente final)
  const st = (ticket.estado || "").toLowerCase();
  if (st.includes("entregad")) return false;

  const refDate = getEffectiveRetentionDate(ticket);
  if (!refDate) return false;

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 90;
}

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
  const [dashboardView, setDashboardView] = useState<"OPERATIVO" | "LOGISTICA" | "TODOS">("OPERATIVO");

  // Modales y notificaciones
  const [selectedTicket, setSelectedTicket] = useState<RecepcionTicket | null>(null);
  const [modalMensaje, setModalMensaje] = useState<string>("");
  const [modalDictamenTipo, setModalDictamenTipo] = useState<string>("AUTO");
  const [modalAccesorios, setModalAccesorios] = useState<string>("");
  const [modalAccessoriesList, setModalAccessoriesList] = useState<string[]>([]);
  const [modalNewAccessory, setModalNewAccessory] = useState<string>("");
  const [quickAccessoriesByType, setQuickAccessoriesByType] = useState<Record<string, string[]>>({});
  const [isAddingQuickShortcut, setIsAddingQuickShortcut] = useState(false);
  const [newQuickShortcutText, setNewQuickShortcutText] = useState("");
  const [isCableDropdownOpen, setIsCableDropdownOpen] = useState(false);
  const cableDropdownRef = useRef<HTMLDivElement | null>(null);
  const [modalUbicacion, setModalUbicacion] = useState<string>("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const draftHydratedRef = useRef(false);
  const pendingModalDraftRef = useRef<{
    idOrden: string;
    modalMensaje: string;
    modalDictamenTipo?: string;
    modalAccessoriesList: string[];
    modalNewAccessory: string;
    modalUbicacion?: string;
  } | null>(null);

  const activeComponentKey = useMemo(
    () => getComponentAccessoryKey(selectedTicket?.tipoComponente),
    [selectedTicket?.tipoComponente]
  );

  const activeComponentLabel = useMemo(() => {
    const raw = selectedTicket?.tipoComponente?.trim();
    return raw || "General";
  }, [selectedTicket?.tipoComponente]);

  const defaultQuickAccessoriesForType = useMemo(
    () => getDefaultAccessoriesForComponent(selectedTicket?.tipoComponente),
    [selectedTicket?.tipoComponente]
  );

  const hasCustomQuickAccessories = useMemo(
    () => Object.prototype.hasOwnProperty.call(quickAccessoriesByType, activeComponentKey),
    [quickAccessoriesByType, activeComponentKey]
  );

  const quickAccessories = useMemo(() => {
    if (hasCustomQuickAccessories) {
      return quickAccessoriesByType[activeComponentKey];
    }
    return defaultQuickAccessoriesForType;
  }, [
    hasCustomQuickAccessories,
    quickAccessoriesByType,
    activeComponentKey,
    defaultQuickAccessoriesForType,
  ]);

  const CABLE_ACCESSORY_OPTIONS = useMemo(() => [
    {
      value: "USB-C a USB-C",
      label: "USB-C a USB-C",
      badge: "Tipo C",
      description: "Conector reversible en ambos extremos",
    },
    {
      value: "USB-A a USB-C",
      label: "USB-A a USB-C",
      badge: "Tipo A-C",
      description: "Cable USB tradicional a Tipo-C",
    },
    {
      value: "Cable de carga",
      label: "Cable de carga",
      badge: "Carga",
      description: "Cable de alimentación o cargador estándar",
    },
  ], []);

  const isCableShortcut = (val: string) => {
    const lower = val.toLowerCase().trim();
    return (
      lower === "cable de carga" ||
      lower === "cable usb" ||
      lower === "cable" ||
      lower === "usb-c a usb-c" ||
      lower === "usb-a a usb-c"
    );
  };

  const anyCableAdded = useMemo(() => {
    return CABLE_ACCESSORY_OPTIONS.some((opt) =>
      modalAccessoriesList.includes(opt.value)
    );
  }, [CABLE_ACCESSORY_OPTIONS, modalAccessoriesList]);

  const handleToggleCableOption = (val: string) => {
    const isAdded = modalAccessoriesList.includes(val);
    if (isAdded) {
      const idx = modalAccessoriesList.indexOf(val);
      if (idx !== -1) {
        handleRemoveModalAccessory(idx);
      }
    } else {
      handleAddModalAccessory(val);
    }
    setIsCableDropdownOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        cableDropdownRef.current &&
        !cableDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCableDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCableDropdownOpen(false);
      }
    }
    if (isCableDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCableDropdownOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_ACCESSORIES_BY_TYPE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const sanitized: Record<string, string[]> = {};
          for (const [k, list] of Object.entries(parsed)) {
            if (Array.isArray(list)) {
              sanitized[k] = list.map((s) => String(s).trim()).filter(Boolean);
            }
          }
          setQuickAccessoriesByType(sanitized);
          return;
        }
      }
      setQuickAccessoriesByType({});
    } catch {
      setQuickAccessoriesByType({});
    }
  }, []);

  const saveQuickAccessoryShortcut = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || isCableShortcut(trimmed)) return;
    setQuickAccessoriesByType((prev) => {
      const currentList = Object.prototype.hasOwnProperty.call(prev, activeComponentKey)
        ? prev[activeComponentKey]
        : getDefaultAccessoriesForComponent(selectedTicket?.tipoComponente);
      if (currentList.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const nextMap = {
        ...prev,
        [activeComponentKey]: [...currentList, trimmed],
      };
      try {
        localStorage.setItem(QUICK_ACCESSORIES_BY_TYPE_STORAGE_KEY, JSON.stringify(nextMap));
      } catch {}
      return nextMap;
    });
  };

  const removeQuickAccessoryShortcut = (val: string) => {
    setQuickAccessoriesByType((prev) => {
      const currentList = Object.prototype.hasOwnProperty.call(prev, activeComponentKey)
        ? prev[activeComponentKey]
        : getDefaultAccessoriesForComponent(selectedTicket?.tipoComponente);
      const nextList = currentList.filter((p) => p !== val);
      const nextMap = {
        ...prev,
        [activeComponentKey]: nextList,
      };
      try {
        localStorage.setItem(QUICK_ACCESSORIES_BY_TYPE_STORAGE_KEY, JSON.stringify(nextMap));
      } catch {}
      return nextMap;
    });
  };

  const resetQuickAccessoriesForCurrentType = () => {
    setQuickAccessoriesByType((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, activeComponentKey)) {
        return prev;
      }
      const nextMap = { ...prev };
      delete nextMap[activeComponentKey];
      try {
        localStorage.setItem(QUICK_ACCESSORIES_BY_TYPE_STORAGE_KEY, JSON.stringify(nextMap));
      } catch {}
      return nextMap;
    });
  };

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
        setModalUbicacion(
          pending.modalUbicacion !== undefined
            ? pending.modalUbicacion
            : (selectedTicket.ubicacion || extractUbicacionFromText(selectedTicket.mensaje))
        );
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
      setIsAddingQuickShortcut(false);
      setNewQuickShortcutText("");
      setModalUbicacion(selectedTicket.ubicacion || extractUbicacionFromText(rawMsg));
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
    // Guardar automáticamente como acceso directo para próximas órdenes
    saveQuickAccessoryShortcut(trimmed);
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
  const [autoPrintTicket, setAutoPrintTicket] = useState(false);
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
      modalUbicacion?: string;
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
          // Si la orden tiene edición manual o draft pendiente, respetarlo; de lo contrario usar mensaje enriquecido
          const cdeMsg = (matched.mensaje || "").trim();
          const draftMsg = (draft.modalMensaje || "").trim();
          const shouldUseDraftMsg =
            Boolean(matched.mensajeEditadoManualmente) ||
            Boolean(draftMsg && (!cdeMsg || draftMsg === cdeMsg || !matched.idOrdenCde));

          const draftAccList =
            Array.isArray(draft.modalAccessoriesList) && draft.modalAccessoriesList.length > 0
              ? draft.modalAccessoriesList
              : parseAccesoriosString(matched.accesorios);

          pendingModalDraftRef.current = {
            idOrden: matched.idOrden,
            modalMensaje: shouldUseDraftMsg && draftMsg ? draftMsg : (matched.mensaje || cdeMsg),
            modalDictamenTipo: draft.modalDictamenTipo || matched.dictamenTipo || "AUTO",
            modalAccessoriesList: draftAccList,
            modalNewAccessory: draft.modalNewAccessory || "",
            modalUbicacion:
              draft.modalUbicacion !== undefined
                ? draft.modalUbicacion
                : (matched.ubicacion || extractUbicacionFromText(matched.mensaje)),
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
    modalUbicacion,
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
    modalUbicacion,
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

  // Guardar notas o comentarios del informe técnico, dictamen, ubicación y accesorios de la orden
  const handleGuardarMensaje = async () => {
    if (!selectedTicket || isSavingDetails) return;
    setIsSavingDetails(true);
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    try {
      const updated = await updateTicketDetailsAsync(selectedTicket.idOrden, {
        estado: selectedTicket.estado,
        fechaEntregada: selectedTicket.fechaEntregada,
        mensaje: modalMensaje,
        accesorios: accFinal,
        ubicacion: modalUbicacion.trim(),
        dictamenTipo: modalDictamenTipo,
        mensajeEditadoManualmente: true,
        idOrdenCde: selectedTicket.idOrdenCde,
      });
      const cdeTickets = getStoredCdeTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const enriched = crossMatchAsuWithCde(updated, cdeTickets, checkins, overrides, cross);
      setTickets(enriched);
      const enrichedSelected = enriched.find((t) => t.idOrden === selectedTicket.idOrden);
      setSelectedTicket(enrichedSelected || {
        ...selectedTicket,
        mensaje: modalMensaje,
        accesorios: accFinal,
        ubicacion: modalUbicacion.trim(),
        dictamenTipo: modalDictamenTipo,
        mensajeEditadoManualmente: true,
      });
      showToast(
        `✓ Cambios guardados (accesorios, ubicación e informe de la orden #${selectedTicket.idOrden} sincronizados con éxito).`
      );
    } catch (err) {
      console.error("Error guardando detalles de orden:", err);
      showToast(
        `✓ Cambios guardados localmente para la orden #${selectedTicket.idOrden}.`
      );
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Asignar ubicación física del producto en cascada (Estantes / Muebles) y persistir de inmediato
  const handleCambiarUbicacion = async (idOrden: string, nuevaUbicacion: string) => {
    setModalUbicacion(nuevaUbicacion);
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    try {
      const updated = await updateTicketDetailsAsync(idOrden, {
        estado: selectedTicket?.estado,
        fechaEntregada: selectedTicket?.fechaEntregada,
        mensaje: modalMensaje,
        accesorios: accFinal,
        ubicacion: nuevaUbicacion,
        dictamenTipo: modalDictamenTipo,
        mensajeEditadoManualmente: true,
        idOrdenCde: selectedTicket?.idOrdenCde,
      });
      const cdeTickets = getStoredCdeTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const enriched = crossMatchAsuWithCde(updated, cdeTickets, checkins, overrides, cross);
      setTickets(enriched);
      if (selectedTicket && selectedTicket.idOrden === idOrden) {
        const enrichedSelected = enriched.find((t) => t.idOrden === idOrden);
        setSelectedTicket(enrichedSelected || {
          ...selectedTicket,
          ubicacion: nuevaUbicacion,
          mensaje: modalMensaje,
          accesorios: accFinal,
          dictamenTipo: modalDictamenTipo,
          mensajeEditadoManualmente: true,
        });
      }
      if (nuevaUbicacion) {
        showToast(`📍 Ubicación asignada: "${nuevaUbicacion}" en orden #${idOrden}`);
      } else {
        showToast(`📍 Ubicación removida de la orden #${idOrden}`);
      }
    } catch (err) {
      console.error("Error al actualizar ubicación:", err);
      showToast(`📍 Ubicación actualizada localmente para la orden #${idOrden}.`);
    }
  };

  // Actualizar dictamen técnico / resolución QC de una orden en vivo
  const handleCambiarDictamen = (idOrden: string, dictamenId: string) => {
    setModalDictamenTipo(dictamenId);
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    const updated = updateTicketDetails(idOrden, {
      estado: selectedTicket?.estado,
      dictamenTipo: dictamenId,
      mensaje: modalMensaje,
      accesorios: accFinal,
      ubicacion: modalUbicacion.trim(),
      mensajeEditadoManualmente: true,
      idOrdenCde: selectedTicket?.idOrdenCde,
    });
    const cdeTickets = getStoredCdeTickets();
    const checkins = getStoredCdeCheckins();
    const overrides = getStoredSatiOverrides();
    const cross = getStoredSatiCrossMatches();
    const enriched = crossMatchAsuWithCde(updated, cdeTickets, checkins, overrides, cross);
    setTickets(enriched);
    if (selectedTicket && selectedTicket.idOrden === idOrden) {
      const enrichedSelected = enriched.find((t) => t.idOrden === idOrden);
      setSelectedTicket(enrichedSelected || {
        ...selectedTicket,
        dictamenTipo: dictamenId,
        mensaje: modalMensaje,
        accesorios: accFinal,
        ubicacion: modalUbicacion.trim(),
        mensajeEditadoManualmente: true,
      });
    }
  };

  // Actualizar estado de una orden sincronizado con el filtro y modal
  const handleCambiarEstado = async (idOrden: string, nuevoEstado: string) => {
    const isDelivered = nuevoEstado.trim().toLowerCase() === "entregada";
    const nowDate = new Date().toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const targetTicket = tickets.find((t) => t.idOrden === idOrden) || selectedTicket;
    const isTargetSelected = selectedTicket && selectedTicket.idOrden === idOrden;

    const accFinal = isTargetSelected
      ? (modalAccessoriesList.length > 0 ? modalAccessoriesList.join(", ") : modalAccesorios.trim())
      : (targetTicket?.accesorios || "");

    const ubicacionFinal = isTargetSelected
      ? modalUbicacion.trim()
      : (targetTicket?.ubicacion || "");

    const msgFinal = isTargetSelected ? modalMensaje : (targetTicket?.mensaje || "");
    const dictamenFinal = isTargetSelected ? modalDictamenTipo : (targetTicket?.dictamenTipo || "AUTO");
    const cdeId = isTargetSelected ? selectedTicket?.idOrdenCde : targetTicket?.idOrdenCde;

    const fechaEnt = isDelivered
      ? (isTargetSelected ? selectedTicket?.fechaEntregada : targetTicket?.fechaEntregada) || nowDate
      : (isTargetSelected ? selectedTicket?.fechaEntregada : targetTicket?.fechaEntregada);

    try {
      const updated = await updateTicketDetailsAsync(idOrden, {
        estado: nuevoEstado,
        mensaje: msgFinal,
        accesorios: accFinal,
        ubicacion: ubicacionFinal,
        dictamenTipo: dictamenFinal,
        mensajeEditadoManualmente: true,
        idOrdenCde: cdeId,
        fechaEntregada: fechaEnt,
      });
      const cdeTickets = getStoredCdeTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const enriched = crossMatchAsuWithCde(updated, cdeTickets, checkins, overrides, cross);
      setTickets(enriched);
      if (isTargetSelected) {
        const enrichedSelected = enriched.find((t) => t.idOrden === idOrden);
        setSelectedTicket(enrichedSelected || {
          ...selectedTicket,
          estado: nuevoEstado,
          mensaje: msgFinal,
          accesorios: accFinal,
          ubicacion: ubicacionFinal,
          dictamenTipo: dictamenFinal,
          mensajeEditadoManualmente: true,
          fechaEntregada: fechaEnt,
        });
      }
      showToast(`✓ Orden #${idOrden} actualizada a estado: ${nuevoEstado}`);
    } catch (err) {
      console.error("Error al actualizar estado:", err);
      showToast(`✓ Estado de orden #${idOrden} actualizado localmente.`);
    }
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

    const fechaIngresoVal = ticket.fechaIngreso && ticket.fechaIngreso.trim() ? ticket.fechaIngreso.trim() : "N/A";
    const fechaVentaVal = ticket.fechaVenta && ticket.fechaVenta.trim() ? ticket.fechaVenta.trim() : "N/A";
    const ubicacionVal = (
      ticket.ubicacion ||
      extractUbicacionFromText(ticket.mensaje) ||
      ""
    ).trim();

    return `${introLine}

📋 *Orden SATI:* #${ticket.idOrden}
🏷️ *Cód. Producto:* ${ticket.codigoProducto || "N/A"}
💻 *Equipo:* ${ticket.marca} ${ticket.modelo || "Equipo"}
📦 *Categoría:* ${ticket.tipoComponente || "GENERAL"}
🔢 *Serie:* ${ticket.serial && ticket.serial !== "S/N" && !ticket.serial.toUpperCase().includes("SIN SERIAL") ? ticket.serial : "SIN SERIAL"}
📅 *Fecha de Ingreso:* ${fechaIngresoVal}
🛒 *Fecha de Venta:* ${fechaVentaVal}
📌 *Estado:* ${dictamen.estadoActual}${ubicacionVal ? `\n📍 *Ubicación:* ${ubicacionVal}` : ""}

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
    const isDanesa = isTicketDanesa(ticket.cliente);

    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    // 1. Validar informe técnico solo para clientes externos particulares
    if (!isDanesa) {
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
    }

    // Si el mensaje, accesorios, ubicación o dictamen en el modal fueron modificados, guardarlos antes de notificar
    let currentTicket = ticket;
    if (selectedTicket && selectedTicket.idOrden === ticket.idOrden) {
      if (
        modalMensaje !== ticket.mensaje ||
        accFinal !== (ticket.accesorios || "") ||
        modalUbicacion.trim() !== (ticket.ubicacion || "") ||
        modalDictamenTipo !== (ticket.dictamenTipo || "AUTO")
      ) {
        const updated = updateTicketDetails(ticket.idOrden, {
          mensaje: modalMensaje,
          accesorios: accFinal,
          ubicacion: modalUbicacion.trim(),
          dictamenTipo: modalDictamenTipo,
          mensajeEditadoManualmente: true,
        });
        const cdeTickets = getStoredCdeTickets();
        const checkins = getStoredCdeCheckins();
        const overrides = getStoredSatiOverrides();
        const cross = getStoredSatiCrossMatches();
        const enriched = crossMatchAsuWithCde(updated, cdeTickets, checkins, overrides, cross);
        setTickets(enriched);
        const enrichedCurrent = enriched.find((t) => t.idOrden === ticket.idOrden);
        currentTicket = enrichedCurrent || {
          ...ticket,
          mensaje: modalMensaje,
          accesorios: accFinal,
          ubicacion: modalUbicacion.trim(),
          dictamenTipo: modalDictamenTipo,
          mensajeEditadoManualmente: true,
        };
        setSelectedTicket(currentTicket);
      }
    }

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
      // 1. Enviar mensaje por WhatsApp SOLO si NO es producto propio (Danesa SA)
      let resOk = true;
      let dataSuccess = true;
      let errorMsg = "";

      if (!isDanesa) {
        const ticketConUbicacion =
          selectedTicket && selectedTicket.idOrden === ticket.idOrden
            ? {
                ...currentTicket,
                ubicacion: modalUbicacion.trim() || currentTicket.ubicacion,
              }
            : currentTicket;
        const msg = generarMensajeWhatsAppRecepcion(ticketConUbicacion);
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "RECEPCION",
            body: msg,
          }),
        });

        const data = await res.json();
        resOk = res.ok;
        dataSuccess = Boolean(data?.success);
        if (!dataSuccess) {
          errorMsg = data?.error || "Error al entregar mensaje";
        }
      }

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

      if (isDanesa) {
        showToast(
          matchedCdeId
            ? `✅ Orden #${ticket.idOrden}: Marcado como Recibido en Sucursal (Stock Propio Danesa · cruzado con CDE #${matchedCdeId}).`
            : `✅ Orden #${ticket.idOrden}: Marcado como Recibido en Sucursal (Stock Propio Danesa · sin envío a WhatsApp).`
        );
      } else if (resOk && dataSuccess) {
        showToast(
          matchedCdeId
            ? `✅ Orden #${ticket.idOrden}: Recibido · Listo para que retire el cliente (cruzado con CDE #${matchedCdeId}).`
            : `✅ Orden #${ticket.idOrden}: Recibido · Listo para que retire el cliente (notificado al grupo).`
        );
      } else {
        console.error("[WHATSAPP ERROR]", errorMsg);
        showToast(
          `✅ Orden #${ticket.idOrden}: Recibido · Listo para retiro (aviso WhatsApp: ${errorMsg || "pendiente"}).`
        );
      }
    } catch (err: unknown) {
      console.error("[RECEPCION CHECKIN ERROR]", err);
      showToast(
        `Error de conexión al marcar recepción de la Orden #${ticket.idOrden}.`
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

  // Métricas del ámbito seleccionado y analítica extendida para Dashboards
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

    // 1. Top marcas y categorías
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

    // 2. Distribución de Resoluciones Técnicas & Dictamen QC
    let reparadoCount = 0;
    let cambioNuevoCount = 0;
    let sinDefectoCount = 0;
    let rmaCount = 0;
    let presupuestoCount = 0;
    let sinReparoCount = 0;

    list.forEach((t) => {
      const msg = (t.mensaje || "").toLowerCase();
      const st = (t.estado || "").toLowerCase();
      const dt = t.dictamenTipo || "";

      if (
        dt === "CAMBIO_NUEVO" ||
        st.includes("cambio por nuevo") ||
        /\b(?:cambi[oa]\s+por\s+nuevo|cambio\s+de\s+equipo|reemplazo\s+por\s+nuevo|unidad\s+nueva|swap)\b/i.test(msg)
      ) {
        cambioNuevoCount++;
      } else if (
        dt === "SIN_DEFECTO" ||
        /\b(?:sin\s+defecto(?:s)?|no\s+presenta\s+falla(?:s)?|funcionamiento\s+normal)\b/i.test(msg)
      ) {
        sinDefectoCount++;
      } else if (
        dt === "RMA_PROVEEDOR" ||
        dt === "NOTA_CREDITO" ||
        st.includes("nota de crédito") ||
        st.includes("rma") ||
        /\b(?:nota\s+de\s+credito|rma|en\s+tramite\s+proveedor)\b/i.test(msg)
      ) {
        rmaCount++;
      } else if (
        dt.includes("PRESUPUESTO") ||
        st.includes("presupuest") ||
        /\b(?:presupuesto|ptto)\b/i.test(msg)
      ) {
        presupuestoCount++;
      } else if (
        st.includes("sin reparo") ||
        dt.includes("SIN_REPARO") ||
        /\b(?:sin\s+reparo|no\s+reparable|no\s+reparado)\b/i.test(msg)
      ) {
        sinReparoCount++;
      } else if (
        st.includes("reparada") ||
        st.includes("entregad") ||
        dt === "REPARADO_EXITO"
      ) {
        reparadoCount++;
      }
    });

    const topResolutions = [
      {
        name: "Reparado con Éxito",
        count: reparadoCount,
        pct: Math.round((reparadoCount / total) * 100 * 10) / 10,
        barColor: "bg-emerald-500",
        badge: "En Laboratorio",
      },
      {
        name: "Cambio por Nuevo (Garantía)",
        count: cambioNuevoCount,
        pct: Math.round((cambioNuevoCount / total) * 100 * 10) / 10,
        barColor: "bg-cyan-500",
        badge: "Proveedor Oficial",
      },
      {
        name: "Presupuesto / En Gestión",
        count: presupuestoCount,
        pct: Math.round((presupuestoCount / total) * 100 * 10) / 10,
        barColor: "bg-purple-500",
        badge: "Gestión Comercial",
      },
      {
        name: "Sin Reparo / Irreparable",
        count: sinReparoCount,
        pct: Math.round((sinReparoCount / total) * 100 * 10) / 10,
        barColor: "bg-rose-500",
        badge: "Falla No Viable",
      },
      {
        name: "Sin Defectos / Normal",
        count: sinDefectoCount,
        pct: Math.round((sinDefectoCount / total) * 100 * 10) / 10,
        barColor: "bg-blue-500",
        badge: "Test QC OK",
      },
      {
        name: "Derivado a RMA / Proveedor",
        count: rmaCount,
        pct: Math.round((rmaCount / total) * 100 * 10) / 10,
        barColor: "bg-amber-500",
        badge: "Trámite Externo",
      },
    ];

    const totalResueltosDirectos = reparadoCount + cambioNuevoCount + sinDefectoCount;
    const totalEvaluadosQC = totalResueltosDirectos + sinReparoCount;
    const tasaExitoQC = totalEvaluadosQC > 0
      ? Math.round((totalResueltosDirectos / totalEvaluadosQC) * 100 * 10) / 10
      : 92.5;

    // 3. Tiempos de Permanencia & Semáforo SATI (equipos activos no entregados)
    const activeTickets = list.filter((t) => !(t.estado || "").toLowerCase().includes("entregad"));
    const activeTotal = activeTickets.length || 1;
    const now = new Date();

    let bandMenor15 = 0;
    let band15a30 = 0;
    let band31a60 = 0;
    let band61a90 = 0;
    let bandMayor90 = 0;
    let sumDias = 0;
    let countDias = 0;

    activeTickets.forEach((t) => {
      const refDate = getEffectiveRetentionDate(t);
      if (!refDate) return;
      const diff = Math.max(0, Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)));
      sumDias += diff;
      countDias++;

      if (diff < 15) bandMenor15++;
      else if (diff <= 30) band15a30++;
      else if (diff <= 60) band31a60++;
      else if (diff <= 90) band61a90++;
      else bandMayor90++;
    });

    const avgRetentionDays = countDias > 0 ? Math.round(sumDias / countDias) : 28;

    const retentionBands = [
      {
        name: "< 15 días (Flujo Óptimo)",
        count: bandMenor15,
        pct: Math.round((bandMenor15 / activeTotal) * 100 * 10) / 10,
        barColor: "bg-emerald-500",
        filterKey: "TODOS" as const,
      },
      {
        name: "15 - 30 días (Plazo Regular SATI)",
        count: band15a30,
        pct: Math.round((band15a30 / activeTotal) * 100 * 10) / 10,
        barColor: "bg-blue-500",
        filterKey: "TODOS" as const,
      },
      {
        name: "31 - 60 días (Atención Requerida)",
        count: band31a60,
        pct: Math.round((band31a60 / activeTotal) * 100 * 10) / 10,
        barColor: "bg-amber-500",
        filterKey: "TODOS" as const,
      },
      {
        name: "61 - 90 días (Demora Prolongada)",
        count: band61a90,
        pct: Math.round((band61a90 / activeTotal) * 100 * 10) / 10,
        barColor: "bg-orange-500",
        filterKey: "TODOS" as const,
      },
      {
        name: "> 90 días (Vencido Depósito SATI)",
        count: bandMayor90,
        pct: Math.round((bandMayor90 / activeTotal) * 100 * 10) / 10,
        barColor: "bg-rose-600",
        filterKey: "A_DEPOSITO" as const,
      },
    ];

    // 4. Logística CDE ⇄ ASU
    const enCaminoCount = list.filter(isTicketEnCamino).length;
    const recibidosAsuCount = list.filter(isTicketRecibido).length;
    const ingresadoCdeCount = list.filter(isTicketIngresadoEnCde).length;
    const faltaIngresarCount = list.filter(isTicketFaltaIngresar).length;
    const entregadasTotalCount = list.filter((t) => (t.estado || "").toLowerCase().includes("entregad")).length;

    const logisticsBands = [
      {
        name: "Recibidos en Depósito ASU",
        count: recibidosAsuCount,
        pct: Math.round((recibidosAsuCount / total) * 100 * 10) / 10,
        barColor: "bg-emerald-600",
        filterKey: "RECIBIDOS" as const,
      },
      {
        name: "En Tránsito desde Casa Matriz CDE",
        count: enCaminoCount,
        pct: Math.round((enCaminoCount / total) * 100 * 10) / 10,
        barColor: "bg-blue-600",
        filterKey: "EN_CAMINO" as const,
      },
      {
        name: "En Laboratorio Técnico Matriz CDE",
        count: ingresadoCdeCount,
        pct: Math.round((ingresadoCdeCount / total) * 100 * 10) / 10,
        barColor: "bg-amber-500",
        filterKey: "INGRESADO_CDE" as const,
      },
      {
        name: "Pendientes de Envío a CDE",
        count: faltaIngresarCount,
        pct: Math.round((faltaIngresarCount / total) * 100 * 10) / 10,
        barColor: "bg-purple-500",
        filterKey: "FALTA_INGRESAR" as const,
      },
      {
        name: "Entregas Efectivas al Cliente",
        count: entregadasTotalCount,
        pct: Math.round((entregadasTotalCount / total) * 100 * 10) / 10,
        barColor: "bg-slate-700",
        filterKey: "TODOS" as const,
      },
    ];

    // 5. Clientes & Segmentación
    const danesaTotal = list.filter((t) => isTicketDanesa(t.cliente)).length;
    const particularesTotal = list.filter(isClienteAsuValido).length;
    const danesaPct = Math.round((danesaTotal / total) * 100 * 10) / 10;
    const particularesPct = Math.round((particularesTotal / total) * 100 * 10) / 10;

    const clientCounts: Record<string, number> = {};
    list.forEach((t) => {
      const c = (t.cliente || "Consumidor Final").trim();
      if (isTicketDanesa(c)) return;
      clientCounts[c] = (clientCounts[c] || 0) + 1;
    });

    const topClients = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / (particularesTotal || 1)) * 100 * 10) / 10,
      }));

    return {
      total: list.length,
      entregadas,
      enReparacion,
      reparadas,
      qc,
      topBrands,
      topCategories,
      topResolutions,
      tasaExitoQC,
      retentionBands,
      avgRetentionDays,
      bandMayor90,
      activeTotal,
      logisticsBands,
      enCaminoCount,
      recibidosAsuCount,
      danesaTotal,
      particularesTotal,
      danesaPct,
      particularesPct,
      topClients,
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

  const scopeVencidosDepositoCount = useMemo(() => {
    return scopeTickets.filter(isTicketVencidoDeposito).length;
  }, [scopeTickets]);

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

  // Mismos estados exactos para seleccionar dentro del modal del ojito (ordenados por familia de color y nombre alfabético)
  const modalStatusOptions = useMemo<string[]>(() => {
    const list = statusOptions
      .filter((opt) => opt.value !== "TODOS")
      .map((opt) => opt.value);
    const current = (selectedTicket?.estado || "").trim();
    if (current && !list.some((st) => st.toLowerCase() === current.toLowerCase())) {
      list.push(current);
    }
    list.sort((a, b) => {
      const rankDiff = getEstadoColorRank(a) - getEstadoColorRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.localeCompare(b, "es");
    });
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
    } else if (transitFilter === "A_DEPOSITO") {
      result = result.filter(isTicketVencidoDeposito);
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
        <div className="inline-flex flex-col items-start gap-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#2A9D8F] text-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
            {label}
          </span>
          {fechaEntrega && (
            <span
              className="text-[10px] font-mono font-bold text-black bg-[#FFD23F] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] block"
              title={`Fecha de entrega al cliente: ${fechaEntrega}`}
            >
              {fechaEntrega}
            </span>
          )}
        </div>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${
        visual.isDanger
          ? "bg-[#E76F51] text-white"
          : visual.readyForPickup
          ? "bg-[#FFD23F] text-black"
          : "bg-[#FFFDF9] text-black"
      }`}>
        {visual.isDanger && <ShieldAlert className="w-3.5 h-3.5 text-white" />}
        <span>{label}</span>
      </span>
    );
  };

  return (
    <AuthGuard requiredModule="recepcion">
      <main className="min-h-dvh bg-[#FAF6EE] text-[#111111] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 min-w-0">
        
        {/* Notificación Toast Flotante */}
        {notification && (
          <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 bg-[#FFD23F] text-black px-4 py-2.5 rounded-lg text-xs font-heading font-extrabold shadow-[4px_4px_0px_#000] border-2 border-black flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Cabecera unificada Neo-Brutalista Retro */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 lg:gap-4 pb-4 border-b-2 border-black">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FFD23F] text-black text-xs font-mono font-bold border-2 border-black shadow-[2px_2px_0px_#000] mb-1.5 sm:mb-2">
              <span>SATI · TALLER CDE &amp; ASU</span>
            </div>
            <h1 className="text-xl sm:text-2xl xl:text-3xl font-heading font-extrabold text-[#111111] tracking-tight">
              Recepción Post-Venta &amp; Retornos
            </h1>
            <p className="text-xs sm:text-sm text-neutral-800 mt-1 max-w-3xl font-medium">
              Monitoreo y trazabilidad de retornos de laboratorio técnico, garantías SATI y comprobantes con código de barras CODE128.
            </p>
          </div>

          {/* Subir CSV / Excel y sincronización */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 self-start lg:self-center lg:justify-end w-full sm:w-auto">
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
              className="inline-flex items-center gap-2 px-3 h-10 sm:h-11 min-w-0 sm:min-w-[172px] xl:min-w-[190px] flex-1 sm:flex-initial rounded-lg bg-[#FFFDF9] hover:bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer select-none whitespace-nowrap"
              title="Subir uno o varios archivos CSV o Excel (.xlsx) a la vez (ASU y/o CDE)"
            >
              <span className="w-7 h-7 rounded-md bg-black text-[#FFD23F] flex items-center justify-center font-bold border border-black shrink-0">
                <Upload className="w-3.5 h-3.5" />
              </span>
              <div className="text-left leading-tight truncate flex-1 min-w-0">
                <strong className="block text-xs font-heading font-extrabold text-black truncate">
                  {isUploadingCSV ? "Subiendo a MySQL..." : "Subir CSV / Excel"}
                </strong>
                <span className="text-[10px] text-neutral-700 font-mono font-bold block truncate">
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
            className={`rounded-xl border-2 border-black p-3.5 sm:p-5 shadow-[4px_4px_0px_#000] space-y-3.5 sm:space-y-4 ${
              csvReport.cambios.length > 0 ? "bg-[#FFD23F]/25" : "bg-[#FFFDF9]"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0 ${
                    csvReport.cambios.length > 0 ? "bg-black text-[#FFD23F]" : "bg-black text-white"
                  }`}
                >
                  {csvReport.cambios.length > 0 ? (
                    <FileSpreadsheet className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-heading font-extrabold text-black">
                      {csvReport.cambios.length > 0
                        ? `¡Actualización completada! Se detectaron ${csvReport.cambios.length} cambio(s) en el CSV`
                        : "Archivo CSV verificado: No se detectaron cambios de estado"}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFFDF9] border-2 border-black text-black shadow-[1px_1px_0px_#000] break-all sm:break-normal">
                      {csvReport.fileName} · {csvReport.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-800 mt-0.5 font-medium">
                    {csvReport.cambios.length > 0
                      ? `Se actualizaron ${csvReport.totalActualizadas} estado(s) y se cargaron ${csvReport.totalNuevas} orden(es) que no estaban en Recepción directamente al dashboard y a MySQL.`
                      : `Se compararon las ${csvReport.totalFilasLeidas.toLocaleString()} órdenes del archivo CSV y todas coinciden con los estados actuales del dashboard.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCsvReport(null)}
                className="self-end sm:self-center shrink-0 px-3 py-1.5 rounded-lg bg-[#FFFDF9] hover:bg-[#E76F51] hover:text-white border-2 border-black text-xs font-heading font-extrabold text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar resumen</span>
              </button>
            </div>

            {/* Tarjetas de Recuento de la Carga CSV */}
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] min-w-0">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase truncate">Órdenes leídas en CSV</span>
                <strong className="text-lg sm:text-xl font-mono font-extrabold text-black tabular-nums">
                  {csvReport.totalFilasLeidas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] min-w-0">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase truncate">Estados actualizados</span>
                <strong className="text-lg sm:text-xl font-mono font-extrabold text-[#2A9D8F] tabular-nums">
                  {csvReport.totalActualizadas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] min-w-0">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase truncate">Nuevas agregadas (Recepción + MySQL)</span>
                <strong className="text-lg sm:text-xl font-mono font-extrabold text-sky-700 tabular-nums">
                  {csvReport.totalNuevas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] min-w-0">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase truncate">Órdenes sin cambios</span>
                <strong className="text-lg sm:text-xl font-mono font-extrabold text-neutral-700 tabular-nums">
                  {csvReport.totalSinCambios.toLocaleString()}
                </strong>
              </div>
            </div>

            <SatiDepurationSummary stats={csvReport.depurationStats} />

            {/* Tabla detallada de las órdenes que cambiaron de estado o se agregaron */}
            {csvReport.cambios.length > 0 && (
              <div className="bg-[#FFFDF9] rounded-lg border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]">
                <div className="px-3.5 py-2 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-heading font-extrabold text-black">
                    Detalle de órdenes actualizadas y nuevas agregadas ({csvReport.cambios.length})
                  </span>
                  <span className="text-[11px] font-mono font-bold text-neutral-700">
                    Haz clic en una orden para buscarla en la tabla
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-black/10">
                  {csvReport.cambios.map((c, idx) => (
                    <div
                      key={`${c.idOrden}-${idx}`}
                      onClick={() => setSearchTerm(c.idOrden)}
                      className="px-3.5 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FFD23F]/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-black bg-[#FFD23F] px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0px_#000] shrink-0">
                          #{c.idOrden}
                        </span>
                        <div className="min-w-0">
                          <strong className="text-black font-heading font-bold">{c.cliente}</strong>
                          <span className="text-neutral-700 ml-2 font-mono text-[11px] font-semibold break-words">
                            {c.equipo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap justify-end">
                        {c.estadoAnterior.includes("NUEVA") ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-200 text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                            + NUEVA EN RECEPCIÓN Y MYSQL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-200 text-neutral-700 line-through border-2 border-black/40">
                            {c.estadoAnterior}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-black shrink-0" />
                        {getStatusBadge(c.estadoNuevo)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 5 KPIs Principales con datos reales (Neo-Brutalismo Retro) */}
        <section className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-3.5 2xl:gap-5">
          <div className="bg-[#FFFDF9] p-3.5 sm:p-4 2xl:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] min-w-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black block truncate">
              {viewScope === "DANESA"
                ? "Envíos Danesa SA"
                : viewScope === "CLIENTES_ASU"
                ? "Órdenes Clientes ASU"
                : "Total Órdenes SATI"}
            </span>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap mt-1 min-w-0">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-heading font-extrabold text-black tabular-nums">
                {metrics.total.toLocaleString()}
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-black bg-[#2A9D8F]/25 px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] whitespace-nowrap">
                {viewScope === "TODOS" ? "100% Real" : `de ${totalUniversal.toLocaleString()} tot.`}
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-600 font-bold block mt-1 truncate">
              {viewScope === "DANESA"
                ? "Nuestra Sucursal ASU"
                : viewScope === "CLIENTES_ASU"
                ? "Clientes Particulares ASU"
                : "Base SATI CDE"}
            </span>
          </div>

          <div className="bg-[#FFFDF9] p-3.5 sm:p-4 2xl:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] min-w-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black block truncate">Entregadas al Cliente</span>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap mt-1 min-w-0">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-heading font-extrabold text-[#2A9D8F] tabular-nums">
                {metrics.entregadas.toLocaleString()}
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-black bg-[#2A9D8F]/25 px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] tabular-nums">
                {Math.round((metrics.entregadas / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-600 font-bold block mt-1 truncate">Completadas con Éxito</span>
          </div>

          <div className="bg-[#FFFDF9] p-3.5 sm:p-4 2xl:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] min-w-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black block truncate">En Reparación en Taller</span>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap mt-1 min-w-0">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-heading font-extrabold text-amber-700 tabular-nums">
                {metrics.enReparacion.toLocaleString()}
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-black bg-[#FFD23F]/40 px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] tabular-nums">
                {Math.round((metrics.enReparacion / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-600 font-bold block mt-1 truncate">En Bancos Técnicos</span>
          </div>

          <div className="bg-[#FFFDF9] p-3.5 sm:p-4 2xl:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] min-w-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black block truncate">Reparadas / Listas Entrega</span>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap mt-1 min-w-0">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-heading font-extrabold text-sky-700 tabular-nums">
                {metrics.reparadas.toLocaleString()}
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-black bg-sky-200 px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] tabular-nums">
                {Math.round((metrics.reparadas / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-600 font-bold block mt-1 truncate">Listas para Notificar</span>
          </div>

          <div className="xs:col-span-2 md:col-span-1 bg-[#FFFDF9] p-3.5 sm:p-4 2xl:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] min-w-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black block truncate">En Control Calidad (QC)</span>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap mt-1 min-w-0">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-heading font-extrabold text-purple-700 tabular-nums">
                {metrics.qc}
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-black bg-purple-200 px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] tabular-nums">
                {Math.round((metrics.qc / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-600 font-bold block mt-1 truncate">Test de Ciclado Activo</span>
          </div>
        </section>

        {/* Cabecera y Selector de Tableros de Analítica */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-[#FFFDF9] p-3.5 sm:p-4 2xl:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000]">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-[#FFD23F] border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_#000]">
              <BarChart3 className="w-5 h-5 text-black" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-heading font-extrabold text-black">
                  Tableros de Analítica & Rendimiento Operativo
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FFD23F] font-mono font-bold text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                  {dashboardView === "TODOS" ? "6 Paneles" : "4 Paneles"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                Métricas en tiempo real: marcas, componentes, dictámenes QC, permanencia y logística SATI.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 xl:inline-flex items-stretch xl:items-center gap-1.5 p-1 bg-[#FAF6EE] rounded-lg border-2 border-black text-xs font-mono shadow-[2px_2px_0px_#000] w-full xl:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setDashboardView("OPERATIVO")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                dashboardView === "OPERATIVO"
                  ? "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]"
                  : "bg-[#FFFDF9] text-black border-2 border-black font-heading font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Operativo & Calidad (4)</span>
            </button>
            <button
              type="button"
              onClick={() => setDashboardView("LOGISTICA")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                dashboardView === "LOGISTICA"
                  ? "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]"
                  : "bg-[#FFFDF9] text-black border-2 border-black font-heading font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
              }`}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span>Logística & Cuentas (4)</span>
            </button>
            <button
              type="button"
              onClick={() => setDashboardView("TODOS")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                dashboardView === "TODOS"
                  ? "bg-black text-[#FFD23F] border-2 border-black font-heading font-extrabold shadow-[2px_2px_0px_#000]"
                  : "bg-[#FFFDF9] text-black border-2 border-black font-heading font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Ver Todos (6 Dashboards)</span>
            </button>
          </div>
        </div>

        {/* Sección de Dashboards en Rejilla Responsiva */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 2xl:gap-6">

          {/* DASHBOARD 1: Top Marcas */}
          {(dashboardView === "OPERATIVO" || dashboardView === "TODOS") && (
            <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 min-w-0">
              <div className="flex justify-between items-start sm:items-center gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-heading font-extrabold text-black">
                    Top Marcas de Equipos en Recepción
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                    Distribución según marcas con mayor flujo de servicio
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#FFD23F] rounded-full text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                  Sucursal CDE
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {metrics.topBrands.map((brand, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSearchTerm(brand.name === searchTerm ? "" : brand.name)}
                    className="space-y-1.5 cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-[#FAF6EE] transition-colors group"
                    title={`Hacer clic para filtrar por ${brand.name}`}
                  >
                    <div className="flex justify-between text-xs sm:text-sm font-medium">
                      <span className="text-black font-heading font-bold group-hover:text-amber-800 transition-colors">
                        {brand.name}
                      </span>
                      <span className="text-neutral-800 font-mono font-bold">
                        {brand.count} equipos ({brand.pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? "bg-black"
                            : idx === 1
                            ? "bg-neutral-800"
                            : idx === 2
                            ? "bg-neutral-600"
                            : "bg-neutral-500"
                        }`}
                        style={{ width: `${Math.min(100, brand.pct * 3.5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 text-xs sm:text-sm text-neutral-800 flex justify-between items-center border-t-2 border-black border-dashed font-mono font-bold">
                <span>Mayor flujo de garantía: <strong className="text-black">{metrics.topBrands[0]?.name || "N/A"}</strong></span>
                <span className="text-neutral-700">Auditoría SATI Activa</span>
              </div>
            </div>
          )}

          {/* DASHBOARD 2: Volumen por Tipo de Componente */}
          {(dashboardView === "OPERATIVO" || dashboardView === "TODOS") && (
            <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 min-w-0">
              <div className="flex justify-between items-start sm:items-center gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-heading font-extrabold text-black">
                    Volumen por Tipo de Componente
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                    Carga operativa ingresada por familia de producto
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#FFD23F] rounded-full text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                  Carga Operativa
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {metrics.topCategories.map((cat, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCategoryFamily(cat.name === categoryFamily ? "TODOS" : cat.name)}
                    className="space-y-1.5 cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-[#FAF6EE] transition-colors group"
                    title={`Hacer clic para filtrar por categoría ${cat.name}`}
                  >
                    <div className="flex justify-between text-xs sm:text-sm font-medium">
                      <span className="text-black font-heading font-bold group-hover:text-emerald-800 transition-colors">
                        {cat.name}
                      </span>
                      <span className="text-neutral-800 font-mono font-bold">
                        {cat.count} equipos ({cat.pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? "bg-[#2A9D8F]"
                            : idx === 1
                            ? "bg-blue-600"
                            : idx === 2
                            ? "bg-indigo-600"
                            : "bg-[#E76F51]"
                        }`}
                        style={{ width: `${Math.min(100, cat.pct * 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 text-xs sm:text-sm text-neutral-800 flex justify-between items-center border-t-2 border-black border-dashed font-mono font-bold">
                <span>Líder en volumen: <strong className="text-black">{metrics.topCategories[0]?.name || "N/A"}</strong></span>
                <span className="text-neutral-700">Tasa de resolución: {metrics.tasaExitoQC}%</span>
              </div>
            </div>
          )}

          {/* DASHBOARD 3: Distribución de Resoluciones & Dictamen QC */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 min-w-0">
            <div className="flex justify-between items-start sm:items-center gap-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-heading font-extrabold text-black flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-[#2A9D8F] shrink-0" />
                  <span>Distribución de Resoluciones & Dictamen QC</span>
                </h3>
                <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                  Efectividad de cierre técnico y dictámenes de garantía
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#2A9D8F] text-white rounded-full border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 shrink-0 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                QC Efectivo
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {metrics.topResolutions.map((res, idx) => (
                <div key={idx} className="space-y-1.5 p-1 -mx-1 rounded-lg">
                  <div className="flex justify-between text-xs sm:text-sm font-medium">
                    <span className="text-black font-heading font-bold flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full border border-black ${res.barColor}`} />
                      {res.name}
                    </span>
                    <span className="text-neutral-800 font-mono font-bold">
                      {res.count} equipos ({res.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${res.barColor}`}
                      style={{ width: `${Math.min(100, res.pct * 2.2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 text-xs sm:text-sm text-neutral-800 flex justify-between items-center border-t-2 border-black border-dashed font-mono font-bold">
              <span>Tasa de resolución positiva: <strong className="text-[#2A9D8F]">{metrics.tasaExitoQC}%</strong></span>
              <span className="text-neutral-700">Garantía SATI Oficial</span>
            </div>
          </div>

          {/* DASHBOARD 4: Tiempos de Permanencia & Control de Plazos */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 min-w-0">
            <div className="flex justify-between items-start sm:items-center gap-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-heading font-extrabold text-black flex items-center gap-1.5">
                  <Timer className="w-5 h-5 text-[#E76F51] shrink-0" />
                  <span>Tiempos de Permanencia & Control de Plazos</span>
                </h3>
                <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                  Semáforo de antigüedad de equipos activos en taller / sucursal
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#FFD23F] rounded-full text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                SLA & Plazos
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {metrics.retentionBands.map((band, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (band.filterKey === "A_DEPOSITO") {
                      setTransitFilter(transitFilter === "A_DEPOSITO" ? "TODOS" : "A_DEPOSITO");
                    }
                  }}
                  className={`space-y-1.5 p-1.5 -mx-1.5 rounded-lg transition-colors ${
                    band.filterKey === "A_DEPOSITO"
                      ? "cursor-pointer hover:bg-rose-50 group"
                      : ""
                  }`}
                  title={band.filterKey === "A_DEPOSITO" ? "Hacer clic para filtrar órdenes vencidas de depósito (>90d)" : undefined}
                >
                  <div className="flex justify-between text-xs sm:text-sm font-medium">
                    <span className="text-black font-heading font-bold flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full border border-black ${band.barColor}`} />
                      <span className={band.filterKey === "A_DEPOSITO" ? "group-hover:text-rose-700 transition-colors" : ""}>
                        {band.name}
                      </span>
                    </span>
                    <span className="text-neutral-800 font-mono font-bold">
                      {band.count} equipos ({band.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${band.barColor}`}
                      style={{ width: `${Math.min(100, band.pct * 2.8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 text-xs sm:text-sm text-neutral-800 flex justify-between items-center border-t-2 border-black border-dashed font-mono font-bold">
              <span>Promedio de permanencia: <strong className="text-black">~{metrics.avgRetentionDays} días</strong></span>
              <span className="text-neutral-700">
                Plazo límite retiro: <strong className="text-[#E76F51] underline decoration-2">90 días</strong>
              </span>
            </div>
          </div>

          {/* DASHBOARD 5: Flujo Logístico & Retornos CDE ⇄ ASU */}
          {(dashboardView === "LOGISTICA" || dashboardView === "TODOS") && (
            <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 min-w-0">
              <div className="flex justify-between items-start sm:items-center gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-heading font-extrabold text-black flex items-center gap-1.5">
                    <Truck className="w-5 h-5 text-blue-600 shrink-0" />
                    <span>Flujo Logístico & Retornos CDE ⇄ ASU</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                    Trazabilidad física de transferencias entre Matriz CDE y Sucursal
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#FFD23F] rounded-full text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                  Inter-Sucursal
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {metrics.logisticsBands.map((log, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (log.filterKey !== "TODOS") {
                        setTransitFilter(transitFilter === log.filterKey ? "TODOS" : log.filterKey);
                      }
                    }}
                    className={`space-y-1.5 p-1.5 -mx-1.5 rounded-lg transition-colors ${
                      log.filterKey !== "TODOS" ? "cursor-pointer hover:bg-[#FAF6EE] group" : ""
                    }`}
                    title={log.filterKey !== "TODOS" ? `Hacer clic para filtrar por ${log.name}` : undefined}
                  >
                    <div className="flex justify-between text-xs sm:text-sm font-medium">
                      <span className="text-black font-heading font-bold flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full border border-black ${log.barColor}`} />
                        <span className={log.filterKey !== "TODOS" ? "group-hover:text-blue-800 transition-colors" : ""}>
                          {log.name}
                        </span>
                      </span>
                      <span className="text-neutral-800 font-mono font-bold">
                        {log.count} equipos ({log.pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${log.barColor}`}
                        style={{ width: `${Math.min(100, log.pct * 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 text-xs sm:text-sm text-neutral-800 flex justify-between items-center border-t-2 border-black border-dashed font-mono font-bold">
                <span>En camino activo: <strong className="text-blue-700 font-bold">{metrics.enCaminoCount} equipos</strong></span>
                <span className="text-neutral-700">Recibidos en ASU: <strong className="text-[#2A9D8F] font-bold">{metrics.recibidosAsuCount}</strong></span>
              </div>
            </div>
          )}

          {/* DASHBOARD 6: Segmentación de Clientes & Cuentas */}
          {(dashboardView === "LOGISTICA" || dashboardView === "TODOS") && (
            <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 min-w-0">
              <div className="flex justify-between items-start sm:items-center gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-heading font-extrabold text-black flex items-center gap-1.5">
                    <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span>Distribución por Origen & Tipo de Cliente</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-700 font-medium">
                    Carga asignada a particulares vs stock interno Danesa S.A.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#FFD23F] rounded-full text-black border border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                  Cartera SATI
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {/* Granularidad Principal: Particulares vs Danesa */}
                <div
                  onClick={() => setViewScope(viewScope === "CLIENTES_ASU" ? "TODOS" : "CLIENTES_ASU")}
                  className="space-y-1.5 cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-[#FAF6EE] transition-colors group"
                  title="Hacer clic para filtrar por Clientes Particulares ASU"
                >
                  <div className="flex justify-between text-xs sm:text-sm font-medium">
                    <span className="text-black font-heading font-bold group-hover:text-blue-700 transition-colors">
                      Clientes Particulares Asunción
                    </span>
                    <span className="text-neutral-800 font-mono font-bold">
                      {metrics.particularesTotal} equipos ({metrics.particularesPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-blue-600"
                      style={{ width: `${Math.min(100, metrics.particularesPct)}%` }}
                    />
                  </div>
                </div>

                <div
                  onClick={() => setViewScope(viewScope === "DANESA" ? "TODOS" : "DANESA")}
                  className="space-y-1.5 cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-[#FAF6EE] transition-colors group"
                  title="Hacer clic para filtrar por Stock Propio Danesa SA"
                >
                  <div className="flex justify-between text-xs sm:text-sm font-medium">
                    <span className="text-black font-heading font-bold group-hover:text-amber-700 transition-colors">
                      Stock Propio (Danesa S.A.)
                    </span>
                    <span className="text-neutral-800 font-mono font-bold">
                      {metrics.danesaTotal} equipos ({metrics.danesaPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shadow-[1px_1px_0px_#000]">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-[#FFD23F]"
                      style={{ width: `${Math.min(100, metrics.danesaPct)}%` }}
                    />
                  </div>
                </div>

                {/* Sub-lista de Top Cuentas */}
                <div className="pt-2 border-t-2 border-black border-dashed">
                  <span className="text-xs font-heading font-extrabold text-black uppercase tracking-wide block mb-2">
                    Top Clientes Particulares Frecuentes
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {metrics.topClients.slice(0, 4).map((cli, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSearchTerm(cli.name === searchTerm ? "" : cli.name)}
                        className="p-2.5 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FFD23F] cursor-pointer transition-colors active:translate-x-[1px] active:translate-y-[1px]"
                        title={`Filtrar por ${cli.name}`}
                      >
                        <div className="text-xs font-heading font-bold text-black truncate">
                          {cli.name}
                        </div>
                        <div className="text-[11px] text-neutral-800 font-mono font-bold mt-0.5">
                          {cli.count} órdenes registradas
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 text-xs sm:text-sm text-neutral-800 flex justify-between items-center border-t-2 border-black border-dashed font-mono font-bold">
                <span>Canal predominante: <strong className="text-black">{metrics.particularesPct >= metrics.danesaPct ? "Particulares" : "Danesa S.A."}</strong></span>
                <span className="text-neutral-700">Trazabilidad SATI 100%</span>
              </div>
            </div>
          )}

        </section>

        {/* Barra de Filtros, Selector de Ámbito Reestructurado y Búsqueda */}
        <section className="p-3.5 sm:p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5 sm:space-y-4">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">

            {/* Selector de Ámbito con las 3 pestañas solicitadas para Recepción Post-Venta */}
            <div className="flex items-center gap-1.5 p-1.5 bg-[#FAF6EE] rounded-lg border-2 border-black flex-wrap shadow-[2px_2px_0px_#000]">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading transition-all flex items-center gap-2 cursor-pointer ${
                    viewScope === s.key
                      ? "bg-black text-[#FFD23F] border-2 border-black font-extrabold shadow-[2px_2px_0px_#000]"
                      : "bg-[#FFFDF9] text-black border-2 border-black font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border border-black ${
                      viewScope === s.key ? "bg-[#FFD23F] text-black" : "bg-[#FAF6EE] text-black"
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

          {/* Filtros Secundarios con Flujo de Tránsito y CleanSelect (Neo-Brutalismo Retro) */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t-2 border-black">
            {/* Filtro de Flujo: Todos los servicios / En camino / Ingresada en CDE / Falta ingresar / Recibidos */}
            <div className="flex items-center gap-1.5 bg-[#FAF6EE] p-1.5 rounded-lg border-2 border-black text-xs font-mono shadow-[2px_2px_0px_#000] flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setTransitFilter("TODOS");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer border-2 border-black ${
                  transitFilter === "TODOS"
                    ? "bg-[#FFD23F] text-black shadow-[2px_2px_0px_#000]"
                    : "bg-[#FFFDF9] text-black hover:bg-[#FAF6EE] shadow-[1px_1px_0px_#000]"
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
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-black ${
                  transitFilter === "EN_CAMINO"
                    ? "bg-[#FFD23F] text-black shadow-[2px_2px_0px_#000]"
                    : "bg-[#FFFDF9] text-black hover:bg-[#FAF6EE] shadow-[1px_1px_0px_#000]"
                }`}
                title="Órdenes con cruce inteligente en CDE con fecha de despacho confirmada, en tránsito de retorno hacia ASU"
              >
                <SpeedTruck
                  className={`w-3.5 h-3.5 ${transitFilter === "EN_CAMINO" ? "text-black" : "text-black"}`}
                  smokeColor={transitFilter === "EN_CAMINO" ? "bg-black" : "bg-amber-500"}
                />
                <span>En camino ({scopeEnCamino})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransitFilter("INGRESADO_CDE");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-black ${
                  transitFilter === "INGRESADO_CDE"
                    ? "bg-[#2A9D8F] text-white shadow-[2px_2px_0px_#000]"
                    : "bg-[#FFFDF9] text-black hover:bg-[#2A9D8F] hover:text-white shadow-[1px_1px_0px_#000]"
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
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-black ${
                  transitFilter === "FALTA_INGRESAR"
                    ? "bg-[#E76F51] text-white shadow-[2px_2px_0px_#000]"
                    : "bg-[#FFFDF9] text-black hover:bg-[#E76F51] hover:text-white shadow-[1px_1px_0px_#000]"
                }`}
                title="Equipos reparados o QC con informe técnico escrito pero pendientes de recibir físicamente"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Falta ingresar ({scopeFaltaIngresar})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransitFilter("RECIBIDOS");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-black ${
                  transitFilter === "RECIBIDOS"
                    ? "bg-[#2A9D8F] text-white shadow-[2px_2px_0px_#000]"
                    : "bg-[#FFFDF9] text-black hover:bg-[#2A9D8F] hover:text-white shadow-[1px_1px_0px_#000]"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Recibidos ({scopeRecibidosCount})</span>
              </button>

              {viewScope !== "DANESA" && (
                <button
                  type="button"
                  onClick={() => {
                    setTransitFilter("A_DEPOSITO");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-black ${
                    transitFilter === "A_DEPOSITO"
                      ? "bg-[#E76F51] text-white shadow-[2px_2px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#E76F51] hover:text-white shadow-[1px_1px_0px_#000]"
                  }`}
                  title="Equipos de clientes con más de 90 días en sucursal que deben remitirse al depósito central"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>A Depósito (+90d) ({scopeVencidosDepositoCount})</span>
                </button>
              )}
            </div>

            {/* Filtro de Fecha de Recepción cuando se selecciona Recibidos */}
            {transitFilter === "RECIBIDOS" && (
              <div className="flex items-center gap-1.5 bg-[#FAF6EE] p-1.5 rounded-lg border-2 border-black text-xs font-mono shadow-[2px_2px_0px_#000] flex-wrap">
                <span className="text-[11px] font-bold text-black px-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-black" />
                  <span>Fecha:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecibidosDateFilter("TODAS");
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer border-2 border-black ${
                    recibidosDateFilter === "TODAS"
                      ? "bg-black text-[#FFD23F] shadow-[1px_1px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000]"
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
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer border-2 border-black ${
                    recibidosDateFilter === "HOY"
                      ? "bg-black text-[#FFD23F] shadow-[1px_1px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000]"
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
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer border-2 border-black ${
                    recibidosDateFilter === "AYER"
                      ? "bg-black text-[#FFD23F] shadow-[1px_1px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000]"
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
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer border-2 border-black ${
                    recibidosDateFilter === "ULTIMOS_7"
                      ? "bg-black text-[#FFD23F] shadow-[1px_1px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000]"
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
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer border-2 border-black ${
                    recibidosDateFilter === "ESTE_MES"
                      ? "bg-black text-[#FFD23F] shadow-[1px_1px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000]"
                  }`}
                >
                  Este mes ({countRecibidosMes})
                </button>
              </div>
            )}

            {/* Grupo alineado de selectores desplegables y restablecer */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto sm:flex-1">
              {/* Filtro de Estado con CleanSelect */}
              <CleanSelect
                options={statusOptions}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto sm:max-w-[190px]"
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
                className="w-full sm:w-auto"
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
                className="w-full sm:w-auto sm:max-w-[205px]"
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
                  className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer sm:ml-auto"
                  title="Restablecer todos los filtros a sus valores predeterminados"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer filtros</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Tabla de Tickets de Recepción (Neo-Brutalismo Retro) */}
        <section className="bg-[#FFFDF9] rounded-xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
          <div className="p-4 sm:p-5 border-b-2 border-black bg-[#FAF6EE] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFD23F] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0 mt-0.5">
                <Inbox className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-heading font-extrabold text-black">
                    {viewScope === "DANESA"
                      ? "Envíos Danesa SA (Nuestra Sucursal ASU)"
                      : viewScope === "CLIENTES_ASU"
                      ? "Órdenes de Clientes ASU"
                      : "Tickets de Recepción & Retornos Post-Venta"}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#FFD23F] text-black border-2 border-black font-mono font-black text-xs shadow-[1.5px_1.5px_0px_#000] tabular-nums">
                    {filteredTickets.length.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-neutral-800 font-medium mt-0.5">
                  {viewScope === "DANESA"
                    ? "Envíos directos de Danesa SA a laboratorio técnico y retornos"
                    : viewScope === "CLIENTES_ASU"
                    ? "Servicios técnicos y garantías de clientes NISSEI Asunción"
                    : "Registros sincronizados con la base central de NISSEI SATI"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-black bg-[#FFFDF9] px-3 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-black" />
                <span>Página {currentPage} de {totalPages}</span>
                <span className="text-neutral-600 font-medium">({filteredTickets.length.toLocaleString()} resultados)</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF6EE] text-black uppercase tracking-wider border-b-2 border-black font-mono text-xs select-none font-black">
                <tr>
                  <th className="py-3.5 px-4 font-black text-black">Nº Orden</th>
                  <th className="py-3.5 px-4 font-black text-black">Cliente</th>
                  <th className="py-3.5 px-4 font-black text-black">Equipo &amp; Categoría</th>
                  <th className="py-3.5 px-4 font-black text-black">Nº Serie / IMEI</th>
                  <th className="py-3.5 px-4 font-black text-black">Mensaje / Detalle Técnico</th>
                  <th className="py-3.5 px-4 font-black text-black">Ingreso / Salida</th>
                  <th className="py-3.5 px-4 font-black text-black">Estado</th>
                  <th className="py-3.5 px-4 font-black text-black min-w-[160px] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-[#111111]">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-600 font-mono text-sm">
                      No se encontraron órdenes que coincidan con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => (
                    <tr key={ticket.idOrden} className="hover:bg-[#FAF6EE] transition-colors border-b border-black/10">
                      {/* Nº Orden */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-black font-mono text-sm tabular-nums">#{ticket.idOrden}</span>
                          {isTicketRecibido(ticket) ? (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#2A9D8F] text-white border border-black shadow-[1px_1px_0px_#000]"
                              title={`Recibido en depósito: ${ticket.fechaRecibidoDeposito || ''}`}
                            >
                              ✓ RECIBIDO · LISTO RETIRO
                            </span>
                          ) : isTicketEnCamino(ticket) ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]"
                              title={`En camino por transportadora desde CDE (Despachado: ${ticket.fechaDespachoCde || 'En tránsito'}${ticket.idOrdenCde ? ` · CDE #${ticket.idOrdenCde}` : ''})`}
                            >
                              <SpeedTruck className="w-3.5 h-3.5 text-black" smokeColor="bg-black" />
                              <span>EN CAMINO</span>
                            </span>
                          ) : isTicketIngresadoEnCde(ticket) ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFFDF9] text-black border border-black shadow-[1px_1px_0px_#000]"
                              title={`Ingresada en laboratorio técnico CDE: ${ticket.fechaIngresoCde || 'En taller CDE'}${ticket.idOrdenCde ? ` · CDE #${ticket.idOrdenCde}` : ''}`}
                            >
                              <Building2 className="w-3.5 h-3.5 text-black" />
                              <span>INGRESADA EN CDE</span>
                            </span>
                          ) : isTicketFaltaIngresar(ticket) ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FAF6EE] text-black border border-black shadow-[1px_1px_0px_#000]"
                              title="Equipo con informe técnico listo pero pendiente de ingreso físico en recepción"
                            >
                              <Inbox className="w-3.5 h-3.5 text-black" />
                              <span>FALTA INGRESAR</span>
                            </span>
                          ) : null}
                          {isTicketNuevoIngreso(ticket) && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]">
                              NUEVO INGRESO
                            </span>
                          )}
                          {isTicketEntregadoReciente(ticket) ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#2A9D8F] text-white border border-black shadow-[1px_1px_0px_#000]">
                              RECIÉN ENTREGADO
                            </span>
                          ) : (
                            isTicketEstadoCambiadoReciente(ticket) && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]">
                                ESTADO CAMBIADO
                              </span>
                            )
                          )}
                          {isTicketVencidoDeposito(ticket) && (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E76F51] text-white border border-black shadow-[1px_1px_0px_#000]"
                              title="Plazo de guarda de 90 días cumplido en sucursal. Remitir al depósito central para liberar espacio."
                            >
                              <Package className="w-3.5 h-3.5 text-white" />
                              <span>LLEVAR A DEPÓSITO (+90D)</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-neutral-600 font-mono font-semibold tabular-nums">Cód: {ticket.codigoProducto || "N/A"}</span>
                          {ticket.idOrdenCde && (
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-black bg-[#FFFDF9] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                              <span>CDE #{ticket.idOrdenCde}</span>
                              {ticket.fechaDespachoCde ? (
                                <span className="text-black font-semibold">· Despacho: {ticket.fechaDespachoCde}</span>
                              ) : ticket.fechaIngresoCde ? (
                                <span className="text-neutral-700 font-normal">· Ingreso CDE: {ticket.fechaIngresoCde}</span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-heading font-bold text-black text-sm">{ticket.cliente || "Cliente Particular"}</div>
                        {isTicketDanesa(ticket.cliente) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000] mt-1">
                            <Package className="w-3.5 h-3.5 text-black" />
                            <span>Danesa SA</span>
                          </span>
                        )}
                      </td>

                      {/* Equipo & Categoría */}
                      <td className="py-3.5 px-4">
                        <div className="font-heading font-bold text-black truncate max-w-[220px] text-sm" title={`${ticket.marca} ${ticket.modelo}`}>
                          <span className="font-extrabold">{ticket.marca}</span> {ticket.modelo}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#FAF6EE] text-black font-mono font-bold border border-black">
                            {ticket.tipoComponente || "GENERAL"}
                          </span>
                          {(() => {
                            const ub = ticket.ubicacion || extractUbicacionFromText(ticket.mensaje);
                            if (!ub) return null;
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#FFD23F] text-black border border-black font-mono font-bold shadow-[1px_1px_0px_#000]"
                                title={`Ubicación física: ${ub}`}
                              >
                                <MapPin className="w-3 h-3 text-black shrink-0" />
                                <span>{ub}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Nº Serie */}
                      <td className="py-3.5 px-4 font-mono text-xs text-neutral-800 font-bold whitespace-nowrap">
                        {ticket.serial || "S/N"}
                      </td>

                      {/* Mensaje / Detalle */}
                      {(() => {
                        const formattedMensaje = formatSatiSentenceCase(ticket.mensaje);
                        return (
                          <td className="py-3.5 px-4 text-neutral-800 max-w-xs truncate text-xs sm:text-sm font-medium" title={formattedMensaje}>
                            {formattedMensaje || "Sin observaciones técnicas registradas."}
                          </td>
                        );
                      })()}

                      {/* Fechas */}
                      <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap tabular-nums">
                        <div className="text-black font-bold">Ing: {ticket.fechaIngreso || "N/A"}</div>
                        {ticket.fechaEntregada && (
                          <div className="text-xs text-neutral-700 mt-0.5 font-semibold">Ent: {ticket.fechaEntregada}</div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(ticket.estado, ticket.fechaEntregada || ticket.fechaRecibidoDeposito)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {isTicketRecibido(ticket) ? (
                            <button
                              type="button"
                              onClick={() => handleAbrirParaNotificar(ticket)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#2A9D8F] text-white border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all whitespace-nowrap cursor-pointer"
                              title={`Recibido · Listo para que retire el cliente (${ticket.fechaRecibidoDeposito || ''}). Click para ver detalle o re-notificar.`}
                            >
                              <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
                              <span>Listo retiro</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAbrirParaNotificar(ticket)}
                              className="p-2 text-black bg-[#FFFDF9] hover:bg-[#FFD23F] rounded-lg transition-all flex items-center justify-center cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                              title="Completar informe técnico para recibir y notificar al grupo"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="p-2 text-black bg-[#FFFDF9] hover:bg-[#FFD23F] rounded-lg transition-all flex items-center justify-center cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={(e) => {
                              setAutoPrintTicket(e.shiftKey);
                              setShowPrintModal(ticket);
                            }}
                            className="p-2 text-black bg-[#FFFDF9] hover:bg-[#FFD23F] rounded-lg transition-all flex items-center justify-center cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                            title="Imprimir Boleta SATI (Shift+Clic para imprimir directo)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {ticket.estado.toLowerCase() === "entregada" ? (
                            <span className="px-2.5 py-1.5 bg-neutral-200 text-black border-2 border-black rounded-lg font-mono text-xs font-bold">
                              Entregado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCambiarEstado(ticket.idOrden, "Entregada")}
                              className="px-3 py-1.5 bg-[#FFD23F] hover:bg-yellow-400 text-black border-2 border-black rounded-lg font-heading font-extrabold text-xs transition-all shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
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
          <div className="p-3.5 sm:p-4 border-t-2 border-black bg-[#FAF6EE] flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
            <span className="text-xs font-mono text-black font-semibold text-center sm:text-left">
              Mostrando{" "}
              <strong className="text-black font-bold">
                {filteredTickets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}
              </strong>{" "}
              a{" "}
              <strong className="text-black font-bold">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}
              </strong>{" "}
              de <strong className="text-black font-bold">{filteredTickets.length.toLocaleString()}</strong> tickets
            </span>

            <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 sm:px-2.5 py-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                « <span className="hidden xs:inline">Primera</span>
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2.5 sm:px-3.5 py-1.5 text-xs font-mono font-extrabold bg-[#FFD23F] text-black border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg tabular-nums">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Página Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 sm:px-2.5 py-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                <span className="hidden xs:inline">Última</span> »
              </button>
            </div>
          </div>
        </section>

        {/* Sección: Depósito Danesa · Monitoreo de Transportadora & Rendimiento Casa Matriz CDE */}
        <section className="bg-[#FFFDF9] rounded-xl p-5 sm:p-6 shadow-[4px_4px_0px_#000] border-2 border-black flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-10 h-10 rounded-lg bg-[#FFD23F] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0 mt-0.5">
              <SpeedTruck className="w-5 h-5 text-black" smokeColor="bg-black" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FAF6EE] border-2 border-black text-[10px] font-mono uppercase font-bold text-black tracking-wider shadow-[1px_1px_0px_#000]">
                  Módulo Depósito Danesa
                </span>
                <span className="text-[11px] font-mono font-bold text-neutral-700">
                  Casa Matriz CDE ↔ Sucursal ASU
                </span>
              </div>
              <h2 className="text-base font-heading font-extrabold tracking-tight text-black">
                Monitoreo de Transportadora &amp; Rendimiento Taller Central CDE
              </h2>
              <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                Consulte el estado de los equipos enviados a Casa Matriz CDE (
                <code className="px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black text-black font-mono text-[11px] font-bold">
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD23F] hover:bg-yellow-400 text-black text-xs font-heading font-extrabold rounded-lg shadow-[3px_3px_0px_#000] border-2 border-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer whitespace-nowrap"
            >
              <Box className="w-4 h-4 text-black" />
              <span>Acceder a SATI ASU - CDE</span>
              <ArrowRight className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
        </section>

        {/* Modal de Autenticación de SATI ASU - CDE */}
        {showDepositoAuthModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#FFFDF9] rounded-xl max-w-sm w-full p-6 shadow-[6px_6px_0px_#000] space-y-4 border-2 border-black">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[#FFD23F] border border-black text-black shadow-[1px_1px_0px_#000]">
                    <SpeedTruck className="w-4 h-4 text-black" smokeColor="bg-black" />
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-extrabold text-black">SATI ASU - CDE</h3>
                    <span className="text-[10px] text-neutral-700 font-mono font-bold">Control Casa Matriz CDE &amp; Transporte</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDepositoAuthModal(false)}
                  className="text-neutral-500 hover:text-black text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleVerifyDeposito} className="space-y-3.5">
                <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                  Ingrese la clave de seguridad para acceder al panel SATI ASU - CDE de Casa Matriz y seguimiento de retornos por transportadora.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-heading font-bold text-black block">
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
                      className="w-full text-xs bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-2 pr-8 focus:bg-white outline-none font-mono font-bold shadow-[2px_2px_0px_#000]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDepPass(!showDepPass)}
                      className="absolute right-2.5 top-2.5 text-neutral-600 hover:text-black"
                    >
                      {showDepPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {depositoAuthError && (
                  <p className="text-xs text-[#E76F51] font-bold font-mono">
                    {depositoAuthError}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDepositoAuthModal(false)}
                    className="px-3 py-1.5 text-xs text-black font-bold hover:bg-neutral-200 rounded-lg border-2 border-transparent"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#FFD23F] hover:bg-yellow-400 text-black text-xs font-heading font-extrabold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                  >
                    Ingresar al Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Detalle Completo de la Orden (Diseño Horizontal Panorámico Adaptable) */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-1.5 sm:p-3 lg:p-4 animate-in fade-in">
            <div className="bg-[#FFFDF9] rounded-xl max-w-[98vw] xl:max-w-6xl 2xl:max-w-7xl w-full p-3 sm:p-4 lg:p-5 shadow-[4px_4px_0px_#000] sm:shadow-[6px_6px_0px_#000] space-y-3 border-2 border-black max-h-[95dvh] overflow-y-auto overscroll-contain">
              {/* Cabecera Horizontal Compacta */}
              <div className="flex items-start sm:items-center justify-between border-b-2 border-black pb-2.5 gap-2.5 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider font-bold">
                        DETALLE DE ORDEN SATI
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]">
                        {selectedTicket.tipoComponente}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-700 break-all sm:break-normal">
                        S/N: <strong className="text-black">{selectedTicket.serial || "N/A"}</strong>
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-lg 2xl:text-xl font-heading font-extrabold text-black break-words">
                      Orden #{selectedTicket.idOrden} · {selectedTicket.marca} {selectedTicket.modelo}
                    </h3>
                  </div>

                  {selectedTicket.idOrdenCde && (
                    <div className="px-2.5 py-1.5 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs text-black flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-black text-[#FFD23F] font-mono text-[11px] font-bold">
                        ASU #{selectedTicket.idOrden} ↔ CDE #{selectedTicket.idOrdenCde}
                      </span>
                      <span className="font-bold text-[11px]">
                        {selectedTicket.matchReason || "Match: Cliente & Equipo"}
                      </span>
                      {selectedTicket.estadoCde && (
                        <span className="text-neutral-700 text-[11px] sm:border-l-2 sm:border-black sm:pl-2">
                          CDE: <strong className="text-black font-extrabold">{selectedTicket.estadoCde}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                  {getStatusBadge(selectedTicket.estado)}
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="w-8 h-8 rounded-lg bg-[#FAF6EE] hover:bg-[#E76F51] hover:text-white text-black font-extrabold flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer shrink-0"
                    title="Cerrar ventana"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {isTicketVencidoDeposito(selectedTicket) && (
                <div className="bg-[#E76F51]/10 border-2 border-[#E76F51] px-3 py-2 rounded-lg flex items-center gap-2.5 text-black text-xs font-medium">
                  <Package className="w-4 h-4 text-[#E76F51] shrink-0" />
                  <div>
                    <strong className="font-extrabold">Equipo para remisión a depósito (+90 días): </strong>
                    <span>Cumplió el plazo máximo de 90 días de permanencia en sucursal ASU. Remitir al depósito central.</span>
                  </div>
                </div>
              )}

              {/* Barra Horizontal de Metadatos del Cliente y Fechas (100% Alineada y Nombre Completo) */}
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 bg-[#FAF6EE] px-3 sm:px-3.5 py-2.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] text-xs items-start">
                <div className="min-w-0">
                  <span className="text-neutral-700 block text-[11px] font-bold">Cliente</span>
                  <strong className="text-black text-xs sm:text-sm break-words leading-snug block font-heading">
                    {selectedTicket.cliente}
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-700 block text-[11px] font-bold truncate">Código Producto</span>
                  <strong className="text-black font-mono text-xs sm:text-sm truncate block font-bold">
                    {selectedTicket.codigoProducto || "N/A"}
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-700 block text-[11px] font-bold truncate">Ingreso ASU / Venta</span>
                  <strong className="text-black font-mono text-xs truncate block font-bold" title={`Ingreso ASU: ${selectedTicket.fechaIngreso || "N/A"}`}>
                    Ing: {selectedTicket.fechaIngreso || "N/A"}
                  </strong>
                  {selectedTicket.fechaVenta && (
                    <span className="text-neutral-700 font-mono text-[11px] truncate block font-semibold">
                      Vta: {selectedTicket.fechaVenta}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-700 block text-[11px] font-bold truncate">Laboratorio CDE</span>
                  {selectedTicket.fechaDespachoCde ? (
                    <strong className="text-black font-mono text-xs flex items-center gap-1 font-bold truncate" title={`Despacho CDE: ${selectedTicket.fechaDespachoCde}`}>
                      <span className="shrink-0">🚚</span>
                      <span className="truncate">{selectedTicket.fechaDespachoCde}</span>
                    </strong>
                  ) : selectedTicket.fechaIngresoCde ? (
                    <strong className="text-black font-mono text-xs truncate block font-bold" title={`Ingreso CDE: ${selectedTicket.fechaIngresoCde}`}>
                      Ing CDE: {selectedTicket.fechaIngresoCde}
                    </strong>
                  ) : (
                    <span className="text-neutral-600 text-xs italic block truncate">Local ASU</span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-700 block text-[11px] font-bold truncate">Recepción Sucursal</span>
                  {selectedTicket.recibidoEnDeposito ? (
                    <strong className="text-[#2A9D8F] font-bold flex items-center gap-1 font-sans text-xs truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
                      <span className="truncate">{selectedTicket.fechaRecibidoDeposito || "Listo retiro"}</span>
                    </strong>
                  ) : (
                    <strong className="text-neutral-600 font-sans text-xs italic block truncate">
                      Pendiente físico
                    </strong>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-700 block text-[11px] font-bold truncate">Entrega / Taller</span>
                  {(selectedTicket.estado || "").toLowerCase().includes("entregada") && selectedTicket.fechaEntregada ? (
                    <strong className="text-black font-mono text-xs block truncate font-bold">{selectedTicket.fechaEntregada}</strong>
                  ) : (
                    <strong className="text-neutral-600 font-sans text-xs italic block truncate">Pendiente de retiro</strong>
                  )}
                  {selectedTicket.diasResolucion !== null && selectedTicket.diasResolucion !== undefined && (
                    <span className="text-black font-mono text-[11px] font-bold block truncate">
                      {selectedTicket.diasResolucion} días en taller
                    </span>
                  )}
                </div>
              </div>

              {/* Cuerpo Principal en 2 Filas Horizontales Sincronizadas */}
              <div className="space-y-3 text-xs">
                {/* FILA 1: Informe Técnico (altura fija automática igualada) ↔ Cambiar Estado de la Orden */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4 items-stretch">
                  {/* 1. Informe Técnico / Mensaje de Servicio */}
                  <div className="lg:col-span-6 flex flex-col min-w-0">
                    <div className="min-h-7 flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-black font-heading font-extrabold text-xs uppercase tracking-wider">
                          Informe Técnico / Mensaje de Servicio
                        </span>
                        {selectedTicket.idOrdenCde && selectedTicket.mensaje && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#2A9D8F]/25 text-black border border-black inline-flex items-center gap-1 shrink-0 shadow-[1px_1px_0px_#000]">
                            <CheckCircle2 className="w-3 h-3 text-[#2A9D8F] shrink-0" />
                            <span>CDE #{selectedTicket.idOrdenCde}</span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isSavingDetails}
                        onClick={handleGuardarMensaje}
                        className="inline-flex items-center gap-1.5 text-xs font-heading font-extrabold text-white bg-[#2A9D8F] hover:bg-emerald-600 px-3 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer disabled:opacity-50 shrink-0"
                        title="Guardar observaciones, ubicación y accesorios"
                      >
                        {isSavingDetails ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-white" />
                        )}
                        <span>{isSavingDetails ? "Guardando..." : "Guardar cambios"}</span>
                      </button>
                    </div>
                    <textarea
                      ref={modalTextareaRef}
                      value={modalMensaje}
                      onChange={(e) => setModalMensaje(e.target.value)}
                      placeholder="Añada o modifique aquí el informe técnico, observaciones del laboratorio, pruebas ejecutadas..."
                      rows={5}
                      className="w-full flex-1 min-h-[140px] lg:min-h-0 resize-none p-2.5 bg-white border-2 border-black rounded-xl text-xs sm:text-sm text-black leading-relaxed outline-none transition-all placeholder:text-neutral-500 font-sans shadow-[2px_2px_0px_#000] focus:ring-0"
                    />
                  </div>

                  {/* 2. Cambiar Estado de la Orden */}
                  <div className="lg:col-span-6 flex flex-col min-w-0">
                    <div className="min-h-7 flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="text-black font-heading font-extrabold text-xs uppercase tracking-wider">
                        Cambiar Estado de la Orden
                      </span>
                      <span className="text-[11px] font-mono font-bold text-neutral-600">
                        Ordenado por color y nombre
                      </span>
                    </div>
                    <div className="flex-1 p-3 bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                              title={st}
                              className={`min-h-[34px] w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-heading font-extrabold rounded-lg border-2 transition-all cursor-pointer text-center leading-tight active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                                isActive ? visual.activeBtnClass : visual.inactiveBtnClass
                              }`}
                            >
                              {isActive && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                              <span>{st}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* FILA 2: Accesorios + Ubicación en Cascada ↔ Dictamen Técnico QC / Resolución */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4 items-stretch">
                  {/* COLUMNA IZQUIERDA (6 cols): Accesorios + Ubicación en Cascada */}
                  <div className="lg:col-span-6 flex flex-col gap-3 min-w-0">
                    {/* Sección de Accesorios Incluidos / Devueltos con el Equipo */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="min-h-6 flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-black font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 truncate">
                          <Package className="w-3.5 h-3.5 text-black shrink-0" />
                          <span className="truncate">Accesorios Incluidos / Devueltos con el Equipo</span>
                        </span>
                        {modalAccessoriesList.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearModalAccessories}
                            className="text-xs font-heading font-bold text-[#E76F51] hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                          >
                            Limpiar todos
                          </button>
                        )}
                      </div>

                      <div className="flex-1 p-3 bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] flex flex-col justify-between gap-2.5">
                        {/* Chips de accesorios actuales */}
                        <div className="flex flex-wrap items-center gap-1.5 min-h-[24px]">
                          {modalAccessoriesList.length > 0 ? (
                            modalAccessoriesList.map((acc, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FFD23F] text-black rounded-full text-xs font-mono font-bold border-2 border-black shadow-[1px_1px_0px_#000]"
                              >
                                <Tag className="w-3 h-3 text-black shrink-0" />
                                <span>{acc}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveModalAccessory(idx)}
                                  className="ml-1 text-black hover:text-[#E76F51] font-bold leading-none cursor-pointer"
                                  title="Quitar accesorio de esta orden"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs font-mono text-neutral-600 italic">
                              Sin accesorios registrados (se notificará &quot;Sin accesorios adicionales&quot;)
                            </span>
                          )}
                        </div>

                        {/* Input para agregar accesorio personalizado (también se guarda como acceso directo) */}
                        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-1.5">
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
                            placeholder={`Agregar accesorio para ${activeComponentLabel} (Enter o + Agregar)`}
                            className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border-2 border-black focus:outline-none rounded-lg transition-colors placeholder:text-neutral-500 font-sans text-black shadow-[1px_1px_0px_#000]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddModalAccessory(modalNewAccessory)}
                            className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-[#FFD23F] text-xs font-heading font-extrabold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer whitespace-nowrap shrink-0"
                            title={`Agregar accesorio y guardar en accesos directos de ${activeComponentLabel}`}
                          >
                            + Agregar
                          </button>
                        </div>

                        {/* Accesos directos personalizados guardados por tipo de componente */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t-2 border-dashed border-black text-[11px]">
                          <span className="inline-flex items-center gap-1.5 mr-0.5">
                            <span className="text-neutral-700 font-mono text-[10px] uppercase font-bold">
                              ACCESOS DIRECTOS:
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-[#FFD23F] text-black border border-black font-mono text-[9px] font-black uppercase tracking-tight">
                              {activeComponentLabel}
                            </span>
                          </span>

                          {quickAccessories
                            .filter((sug) => !isCableShortcut(sug))
                            .map((sug) => {
                              const isAdded = modalAccessoriesList.includes(sug);
                              return (
                                <span
                                  key={sug}
                                  className={`inline-flex items-center rounded-full border-2 border-black text-[11px] font-mono font-bold transition-all shadow-[1px_1px_0px_#000] ${
                                    isAdded
                                      ? "bg-[#2A9D8F] text-white"
                                      : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleAddModalAccessory(sug)}
                                    className="px-2.5 py-0.5 cursor-pointer"
                                    title={`Agregar "${sug}" a la orden`}
                                  >
                                    + {sug}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeQuickAccessoryShortcut(sug)}
                                    className="pr-2 pl-0.5 text-neutral-500 hover:text-[#E76F51] font-bold leading-none cursor-pointer"
                                    title={`Quitar "${sug}" de accesos directos de ${activeComponentLabel}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}

                          {/* Selector desplegable Neo-Brutalista de Cables (USB-C a USB-C, USB-A a USB-C, Cable de carga) */}
                          <div ref={cableDropdownRef} className="relative inline-block">
                            <button
                              type="button"
                              onClick={() => setIsCableDropdownOpen((prev) => !prev)}
                              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border-2 border-black text-[11px] font-mono font-bold transition-all shadow-[1px_1px_0px_#000] cursor-pointer select-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                                anyCableAdded
                                  ? "bg-[#2A9D8F] text-white"
                                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                              } ${isCableDropdownOpen ? "bg-[#FFD23F] text-black ring-1 ring-black" : ""}`}
                              title="Desplegar y seleccionar tipo de cable (USB-C, USB-A, Carga)"
                            >
                              <Cable className="w-3 h-3 shrink-0" />
                              <span>{anyCableAdded ? "✓ Cable" : "+ Cable"}</span>
                              <ChevronDown
                                className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
                                  isCableDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {isCableDropdownOpen && (
                              <div
                                role="menu"
                                className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-black bg-[#FFFDF9] p-2 shadow-[4px_4px_0px_#000] space-y-1.5 animate-in fade-in zoom-in-95 duration-100"
                              >
                                <div className="flex items-center justify-between px-1 pb-1 border-b-2 border-black/10">
                                  <span className="text-[10px] font-heading font-extrabold text-black uppercase tracking-wider flex items-center gap-1.5">
                                    <Cable className="w-3.5 h-3.5 text-black" />
                                    Tipo de Cable / Conector
                                  </span>
                                  <span className="text-[9px] font-mono font-bold text-neutral-500">
                                    3 opciones
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  {CABLE_ACCESSORY_OPTIONS.map((opt) => {
                                    const isSelected = modalAccessoriesList.includes(opt.value);
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleToggleCableOption(opt.value)}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer select-none border ${
                                          isSelected
                                            ? "bg-black text-[#FFD23F] border-black shadow-[2px_2px_0px_#000]"
                                            : "border-transparent text-black hover:bg-[#FFD23F] hover:border-black"
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <span
                                              className={`text-xs font-heading font-extrabold truncate ${
                                                isSelected ? "text-[#FFD23F]" : "text-black"
                                              }`}
                                            >
                                              {opt.label}
                                            </span>
                                            <span
                                              className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded border ${
                                                isSelected
                                                  ? "bg-[#FFD23F] text-black border-black"
                                                  : "bg-[#FAF6EE] text-black border-black/70"
                                              }`}
                                            >
                                              {opt.badge}
                                            </span>
                                          </div>
                                          <p
                                            className={`text-[10px] font-sans mt-0.5 truncate ${
                                              isSelected
                                                ? "text-zinc-300 font-medium"
                                                : "text-zinc-600 font-bold"
                                            }`}
                                          >
                                            {opt.description}
                                          </p>
                                        </div>

                                        {isSelected ? (
                                          <Check className="w-4 h-4 text-[#FFD23F] shrink-0" />
                                        ) : (
                                          <Plus className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {isAddingQuickShortcut ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={newQuickShortcutText}
                                onChange={(e) => setNewQuickShortcutText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const clean = newQuickShortcutText.trim();
                                    if (clean) {
                                      saveQuickAccessoryShortcut(clean);
                                      handleAddModalAccessory(clean);
                                    }
                                    setNewQuickShortcutText("");
                                    setIsAddingQuickShortcut(false);
                                  } else if (e.key === "Escape") {
                                    setNewQuickShortcutText("");
                                    setIsAddingQuickShortcut(false);
                                  }
                                }}
                                placeholder={`Nuevo para ${activeComponentLabel}...`}
                                className="px-2 py-0.5 text-[11px] bg-white border-2 border-black rounded-lg outline-none w-44 font-mono text-black"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const clean = newQuickShortcutText.trim();
                                  if (clean) {
                                    saveQuickAccessoryShortcut(clean);
                                    handleAddModalAccessory(clean);
                                  }
                                  setNewQuickShortcutText("");
                                  setIsAddingQuickShortcut(false);
                                }}
                                className="px-2 py-0.5 bg-[#2A9D8F] hover:bg-emerald-600 text-white rounded-lg text-[11px] font-heading font-extrabold border-2 border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewQuickShortcutText("");
                                  setIsAddingQuickShortcut(false);
                                }}
                                className="px-1.5 py-0.5 text-neutral-600 hover:text-black font-bold text-[11px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsAddingQuickShortcut(true)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFFDF9] hover:bg-[#FFD23F] text-black border-2 border-dashed border-black transition-all cursor-pointer shadow-[1px_1px_0px_#000]"
                              title={`Crear y guardar un nuevo acceso directo para ${activeComponentLabel}`}
                            >
                              <Plus className="w-3 h-3 text-black" />
                              <span>Agregar acceso directo</span>
                            </button>
                          )}

                          {hasCustomQuickAccessories && (
                            <button
                              type="button"
                              onClick={resetQuickAccessoriesForCurrentType}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FAF6EE] hover:bg-neutral-200 text-neutral-700 border border-black/50 transition-all cursor-pointer"
                              title={`Restaurar accesos directos sugeridos para ${activeComponentLabel}`}
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Restaurar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sección de Ubicación del Producto en Cascada (Estantes / Muebles) */}
                    <div className="shrink-0">
                      <UbicacionCascadaSelector
                        value={modalUbicacion}
                        onChange={(nuevaUbicacion) =>
                          handleCambiarUbicacion(selectedTicket.idOrden, nuevaUbicacion)
                        }
                      />
                    </div>
                  </div>

                  {/* COLUMNA DERECHA (6 cols): Selector de Dictamen Técnico / Resolución QC + Vista previa */}
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
                      <div className="lg:col-span-6 flex flex-col min-w-0">
                        <div className="min-h-6 flex items-center justify-between mb-1.5 gap-2">
                          <span className="text-xs font-heading font-extrabold text-black uppercase tracking-wider truncate">
                            {isTicketDanesa(selectedTicket.cliente)
                              ? "Dictamen Técnico · Resolución Interna (Stock Propio)"
                              : "Dictamen Técnico · Resolución QC (WhatsApp)"}
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-mono font-extrabold text-black bg-[#FFD23F] px-2 py-0.5 rounded-full border-2 border-black shadow-[1px_1px_0px_#000] shrink-0 whitespace-nowrap">
                            {preview.sourceLabel}
                          </span>
                        </div>

                        <div className="flex-1 p-3 sm:p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-2.5 shadow-[2px_2px_0px_#000] flex flex-col justify-between">
                          {/* Selector rápido de resoluciones QC ordenado por color y nombre */}
                          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {DICTAMEN_QC_OPTIONS.map((opt, idx) => {
                              const selected = modalDictamenTipo === opt.id;
                              const isFirstAuto = idx === 0 && DICTAMEN_QC_OPTIONS.length % 3 === 1;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleCambiarDictamen(selectedTicket.idOrden, opt.id)}
                                  title={opt.label}
                                  className={`min-h-[34px] w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] font-heading font-extrabold rounded-lg border-2 transition-all cursor-pointer text-center leading-tight active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                                    isFirstAuto ? "xs:col-span-2 sm:col-span-3" : ""
                                  } ${selected ? opt.chipActive : opt.chipInactive}`}
                                >
                                  {selected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {isTicketDanesa(selectedTicket.cliente) ? (
                            <div className="text-xs text-black bg-[#FFD23F]/20 p-2.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2">
                              <Building2 className="w-4 h-4 text-black shrink-0 mt-0.5" />
                              <div>
                                <div className="font-heading font-extrabold text-black">Mercadería de Stock Propio (Danesa S.A.)</div>
                                <p className="text-neutral-800 text-[11px] font-medium leading-relaxed mt-0.5">
                                  Este equipo pertenece a la sucursal. Al tocar <strong>Marcar como Recibido</strong> se registrará la recepción interna en el sistema sin enviar notificaciones al grupo de WhatsApp.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-black space-y-1 bg-[#FFFDF9] p-2.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
                              <div className="font-heading font-extrabold text-black">{preview.headerPlain}</div>
                              <p className="text-neutral-800 font-medium leading-snug text-[11px]">{preview.body}</p>
                              {preview.detalleTexto ? (
                                <p className="text-neutral-900 font-mono pt-1 border-t-2 border-dashed border-black text-[11px] truncate" title={preview.detalleTexto}>
                                  <span className="font-bold">Detalle:</span> {preview.detalleTexto}
                                </p>
                              ) : (
                                <p className="text-neutral-500 italic pt-1 border-t-2 border-dashed border-black text-[11px]">
                                  Complete &quot;Informe Técnico / Mensaje de Servicio&quot; para incluir el detalle.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Pie de Acciones Horizontal Compacto */}
              <div className="pt-2.5 border-t-2 border-black flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
                <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 flex-wrap">
                  {isTicketDanesa(selectedTicket.cliente) ? (
                    <button
                      type="button"
                      onClick={() => handleNotificarWhatsAppRecepcion(selectedTicket)}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-heading font-extrabold shadow-[2px_2px_0px_#000] border-2 border-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all ${
                        selectedTicket.recibidoEnDeposito
                          ? "bg-black text-[#FFD23F]"
                          : "bg-[#2A9D8F] text-white"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                      <span>
                        {selectedTicket.recibidoEnDeposito
                          ? "Recibido en Sucursal (Actualizar)"
                          : "Marcar como Recibido"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleNotificarWhatsAppRecepcion(selectedTicket)}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-heading font-extrabold shadow-[2px_2px_0px_#000] border-2 border-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all ${
                        selectedTicket.recibidoEnDeposito
                          ? "bg-[#2A9D8F] text-white"
                          : "bg-[#FFD23F] text-black"
                      }`}
                    >
                      {selectedTicket.recibidoEnDeposito ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                          <span>Recibido · Listo para retiro (Re-notificar)</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-black shrink-0" />
                          <span>Notificar por WhatsApp &amp; Marcar Recibido</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      const accFinal =
                        modalAccessoriesList.length > 0
                          ? modalAccessoriesList.join(", ")
                          : modalAccesorios.trim();
                      setAutoPrintTicket(e.shiftKey);
                      setShowPrintModal({
                        ...selectedTicket,
                        mensaje: modalMensaje,
                        accesorios: accFinal,
                        ubicacion: modalUbicacion.trim() || undefined,
                      });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FFD23F] hover:bg-yellow-400 text-black rounded-lg text-xs sm:text-sm font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                    title="Imprimir comprobante térmico con código de barras CODE128 (Shift+Clic para imprimir directo)"
                  >
                    <Printer className="w-4 h-4 text-black shrink-0" />
                    <span>Imprimir Boleta Térmica</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-5 py-2 bg-[#FFFDF9] hover:bg-neutral-200 text-black rounded-lg text-xs sm:text-sm font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer text-center"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Impresión de Boleta / Comprobante Térmico Calibrable */}
        {showPrintModal && (
          <SatiThermalPrintModal
            autoPrint={autoPrintTicket}
            data={{
              idOrden: showPrintModal.idOrden,
              codigoProducto: showPrintModal.codigoProducto,
              cliente: showPrintModal.cliente,
              equipo: `${showPrintModal.marca || ""} ${showPrintModal.modelo || ""}`.trim(),
              serial: showPrintModal.serial,
              estado: showPrintModal.estado,
              accesorios: showPrintModal.accesorios,
              ubicacion: showPrintModal.ubicacion || extractUbicacionFromText(showPrintModal.mensaje) || undefined,
              informeTecnico: formatSatiSentenceCase(showPrintModal.mensaje),
              subtitulo: isTicketDanesa(showPrintModal.cliente)
                ? "COMPROBANTE DE STOCK PROPIO - SUCURSAL"
                : "COMPROBANTE DEL SERVICIO POST - VENTA NISSEI",
              esDanesa: isTicketDanesa(showPrintModal.cliente),
              fechaIngreso: showPrintModal.fechaIngreso,
              fechaRecepcionReparacion:
                showPrintModal.fechaRecibidoDeposito ||
                showPrintModal.fechaDespachoCde ||
                (showPrintModal.recibidoEnDeposito ? showPrintModal.fechaEntregada || new Date().toLocaleDateString("es-PY") : undefined),
              recibidoListoRetiro: Boolean(showPrintModal.recibidoEnDeposito),
            }}
            onClose={() => {
              setShowPrintModal(null);
              setAutoPrintTicket(false);
            }}
          />
        )}

      </div>
    </main>
    </AuthGuard>
  );
}
