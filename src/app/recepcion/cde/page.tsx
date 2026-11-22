"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";
import { SpeedTruck } from "@/components/common/SpeedTruck";
import {
  Truck,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Box,
  Building2,
  UserCheck,
  X,
  Check,
  Info,
  Link2,
  Calendar,
  Edit3,
  Plus,
  Unlink,
  Printer,
} from "lucide-react";
import { SatiThermalPrintModal } from "@/components/common/SatiThermalPrintModal";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import CategoryFilterSelect, { CategoryCountItem } from "@/components/common/CategoryFilterSelect";
import { OrderSearchInput } from "@/components/common/OrderSearchInput";
import { matchesCategoryFilter, normalizeComponentName } from "@/data/recepcionCategories";
import { readMultipleSpreadsheetsForSati, SPREADSHEET_FILE_ACCEPT } from "@/lib/spreadsheetImport";
import { yieldToBrowser } from "@/lib/satiRawDepurator";
import {
  saveWorkDraft,
  loadWorkDraft,
  useFlushDraftBeforeLogout,
} from "@/lib/workDrafts";
import {
  RecepcionCdeTicket,
  INITIAL_RECEPCION_CDE_DATA,
  getStoredCdeTickets,
  getStoredCdeCheckins,
  CDE_CHECKINS_KEY,
  saveCdeTickets,
  toggleCheckinDeposito,
  procesarActualizacionCdeCSV,
  sincronizarCdeCsvOnline,
  classifyAndParseMultiSatiPreparedAsync,
  isTicketDanesa,
  isEstadoInternoNoCliente,
  ResultadoCargaCdeCSV,
  CambioEstadoCde,
  isFechaValida,
  isDespachoCoherente,
  fetchCdeTicketsFromMySQL,
  parseFechaDMY,
  calcularDiasResolucion,
  saveSatiTicketOverride,
  getStoredSatiOverrides,
  getStoredSatiCrossMatches,
  saveSatiCrossMatchLocal,
  removeSatiCrossMatchLocal,
} from "@/data/recepcionCdeData";
import {
  getStoredTickets,
  fetchTicketsFromMySQL,
  sincronizarRecepcionCsvOnline,
} from "@/data/recepcionData";
import { SatiDepurationSummary } from "@/components/SatiDepurationSummary";
import {
  crossMatchCdeWithAsu,
  buildUnifiedSatiList,
  getTicketRowKey,
  normalizeSerial,
  clientsMatch,
  computeEquipmentSimilarity,
  formatSatiSentenceCase,
  matchesSmartSatiSearch,
} from "@/lib/crossMatch";
import { consumeCloudSyncWarning } from "@/lib/cloudSync";

const ITEMS_PER_PAGE = 25;

type ViewScope = "DANESA" | "CLIENTES_ASU" | "CLIENTES_CDE" | "TODOS";
type RecibidosDateFilter = "TODAS" | "HOY" | "AYER" | "ULTIMOS_7" | "ESTE_MES";

function matchesRecibidosDate(ticket: RecepcionCdeTicket, filter: RecibidosDateFilter): boolean {
  if (filter === "TODAS") return true;

  // Filtrar primordialmente con la fecha real de confirmación/notificación a depósito
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

/**
 * Identifica si una orden corresponde al ámbito de Clientes CDE
 * (órdenes directas de Casa Matriz CDE, excluyendo Danesa SA y Clientes ASU).
 */
function isTicketClienteCde(t: RecepcionCdeTicket): boolean {
  return !t.esDanesa && (t.origen === "CDE" || parseInt(t.idOrden, 10) >= 125000);
}

/**
 * Determina si una orden está confirmada físicamente como recibida en depósito sucursal.
 * Solo aplica a órdenes de Clientes ASU y Danesa SA (no Clientes CDE).
 */
function isTicketRecibido(t: RecepcionCdeTicket): boolean {
  if (isTicketClienteCde(t)) return false;
  if ((t as any).desmarcadoManual) return false;
  return Boolean(t.recibidoEnDeposito);
}

/**
 * Determina si una orden está actualmente viajando por transportadora (En camino):
 * Tiene fecha de despacho válida de CDE y aún no se ha confirmado su recepción física en destino.
 */
function isTicketEnCamino(t: RecepcionCdeTicket): boolean {
  if (isTicketRecibido(t)) return false;
  return isFechaValida(t.fechaEntregada) && isDespachoCoherente(t.fechaIngreso, t.fechaEntregada);
}

/**
 * Determina si una orden carece de cruce unificado (ASU ↔ CDE) o se encuentra pendiente de vincular.
 */
function isTicketSinCruce(t: RecepcionCdeTicket): boolean {
  const num = parseInt(t.idOrden, 10);
  const esAsuODanesa = t.esDanesa || t.origen === "ASU" || (!isNaN(num) && num < 100000);
  if (esAsuODanesa) {
    if (!t.idOrdenCde) return true;
    const cdeNum = parseInt(t.idOrdenCde.trim(), 10);
    return isNaN(cdeNum) || cdeNum < 100000 || t.idOrdenCde === (t.idOrdenAsu || t.idOrden);
  } else {
    if (!t.idOrdenAsu) return true;
    const asuNum = parseInt(t.idOrdenAsu.trim(), 10);
    return isNaN(asuNum) || asuNum >= 100000 || t.idOrdenAsu === t.idOrden;
  }
}

/**
 * Determina el estado técnico unificado que se muestra en pantalla.
 */
function getTicketDisplayStatus(t: RecepcionCdeTicket): string {
  const numId = parseInt(t.idOrden, 10);
  const esFilaAsu = t.origen === "ASU" || (!t.origen && !isNaN(numId) && numId < 100000);

  if (esFilaAsu) {
    const estAsuRaw = (t.estadoAsu || t.estado || "").trim();
    const estAsu = estAsuRaw.toLowerCase();
    const estCdeRaw = (t.estadoCde || "").trim();
    const estCde = estCdeRaw.toLowerCase();

    // 0. Preservar "Sin Reparo" y estados reales locales de ASU por encima del estado de CDE
    if (estAsu.includes("sin reparo")) {
      return estAsuRaw || "Sin Reparo";
    }
    if (estAsu.includes("entregada")) {
      return "Entregada";
    }
    if (estAsu.includes("qc") || estAsu.includes("control de calidad")) {
      return "Control de Calidad (QC)";
    }
    if (estAsu.includes("reparada")) {
      return "Reparada";
    }

    // Para envíos internos Danesa SA aún en espera en ASU, conservar dictamen de CDE si corresponde
    if (t.esDanesa) {
      if (estCde.includes("sin reparo")) {
        return estCdeRaw || "Sin Reparo";
      }
      const tieneDespachoValido =
        isFechaValida(t.fechaEntregada) && isDespachoCoherente(t.fechaIngreso, t.fechaEntregada);
      const tieneDetalleReparacion = Boolean(
        (t.mensaje || "").toLowerCase().includes("repar") ||
        (t.mensaje || "").toLowerCase().includes("cambio") ||
        (t.mensaje || "").toLowerCase().includes("ok") ||
        (t.mensaje || "").toLowerCase().includes("pieza") ||
        (t.mensaje || "").toLowerCase().includes("funcional")
      );
      if (tieneDespachoValido && tieneDetalleReparacion) {
        return "Reparada";
      }
    }

    return estAsuRaw || "En Asignacion";
  }

  // Fila nativa de CDE (#125000+)
  const est = (t.estadoCde || t.estado || "").trim();
  const estLower = est.toLowerCase();

  if (estLower.includes("sin reparo")) {
    return est || "Sin Reparo";
  }
  if (estLower.includes("entregada")) {
    return "Entregada";
  }
  if (estLower.includes("qc") || estLower.includes("control de calidad")) {
    return "Control de Calidad (QC)";
  }
  if (estLower.includes("reparada")) {
    return "Reparada";
  }

  return est || "En Asignacion";
}

export default function RecepcionCdeDashboardPage() {
  const [tickets, setTickets] = useState<RecepcionCdeTicket[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Filtros de Ámbito
  const [viewScope, setViewScope] = useState<ViewScope>("DANESA");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [categoryFamily, setCategoryFamily] = useState("TODOS");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [transitFilter, setTransitFilter] = useState<"TODOS" | "EN_TRANSITO" | "RECIBIDOS" | "SIN_CRUCE">("TODOS");
  const [recibidosDateFilter, setRecibidosDateFilter] = useState<RecibidosDateFilter>("TODAS");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de Detalle y Edición
  const [selectedTicket, setSelectedTicket] = useState<RecepcionCdeTicket | null>(null);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [editForm, setEditForm] = useState({
    idOrdenAsu: "",
    idOrdenCde: "",
    fechaIngresoAsu: "",
    fechaIngresoCde: "",
    fechaDespachoCde: "",
    fechaRecibidoAsu: "",
  });

  // Modal Rápido de Vinculación SATI (ASU ↔ CDE)
  const [linkingTicket, setLinkingTicket] = useState<RecepcionCdeTicket | null>(null);
  const [linkOrderIdInput, setLinkOrderIdInput] = useState("");
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  // Subida y procesamiento de CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftHydratedRef = useRef(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [csvReport, setCsvReport] = useState<
    (ResultadoCargaCdeCSV & { fileName: string; timestamp: string; origenLabel?: string }) | null
  >(null);

  const refreshCdeAndAsuFromCloud = async () => {
    const asuFallback = getStoredTickets();
    const cdeFallback = getStoredCdeTickets();
    try {
      const [dbCde, dbAsu] = await Promise.all([
        fetchCdeTicketsFromMySQL().catch(() => cdeFallback),
        fetchTicketsFromMySQL().catch(() => asuFallback),
      ]);
      if (Array.isArray(dbCde) && Array.isArray(dbAsu)) {
        const liveCheckins = getStoredCdeCheckins();
        const liveOverrides = getStoredSatiOverrides();
        const liveCross = getStoredSatiCrossMatches();
        const liveUnified = buildUnifiedSatiList(
          dbCde,
          dbAsu,
          liveCheckins,
          liveOverrides,
          liveCross
        );
        setTickets(liveUnified);
      }
    } catch {
      // Caché local ya cargada
    }
  };

  useEffect(() => {
    setIsClient(true);
    const asuTickets = getStoredTickets();
    const cdeTickets = getStoredCdeTickets();
    const checkins = getStoredCdeCheckins();
    const overrides = getStoredSatiOverrides();
    const manualCross = getStoredSatiCrossMatches();
    const initialUnified = buildUnifiedSatiList(cdeTickets, asuTickets, checkins, overrides, manualCross);
    setTickets(initialUnified);

    const draft = loadWorkDraft<{
      viewScope?: ViewScope;
      searchTerm?: string;
      statusFilter?: string;
      categoryFamily?: string;
      selectedCategories?: string[];
      transitFilter?: "TODOS" | "EN_TRANSITO" | "RECIBIDOS" | "SIN_CRUCE";
      recibidosDateFilter?: RecibidosDateFilter;
      currentPage?: number;
      selectedTicketId?: string | null;
      isEditingModal?: boolean;
      editForm?: {
        idOrdenAsu: string;
        idOrdenCde: string;
        fechaIngresoAsu: string;
        fechaIngresoCde: string;
        fechaDespachoCde: string;
        fechaRecibidoAsu: string;
      };
      linkingTicketId?: string | null;
      linkOrderIdInput?: string;
    }>("recepcion_cde_workspace");

    if (draft) {
      if (draft.viewScope) setViewScope(draft.viewScope);
      if (typeof draft.searchTerm === "string") setSearchTerm(draft.searchTerm);
      if (draft.statusFilter) setStatusFilter(draft.statusFilter);
      if (draft.categoryFamily) setCategoryFamily(draft.categoryFamily);
      if (Array.isArray(draft.selectedCategories)) setSelectedCategories(draft.selectedCategories);
      if (draft.transitFilter) setTransitFilter(draft.transitFilter);
      if (draft.recibidosDateFilter) setRecibidosDateFilter(draft.recibidosDateFilter);
      if (typeof draft.currentPage === "number" && draft.currentPage >= 1) {
        setCurrentPage(draft.currentPage);
      }
      if (draft.selectedTicketId) {
        const matched = initialUnified.find((t) => t.idOrden === draft.selectedTicketId);
        if (matched) {
          setSelectedTicket(matched);
          setIsEditingModal(Boolean(draft.isEditingModal));
          if (draft.editForm) {
            setEditForm(draft.editForm);
          }
        }
      }
      if (draft.linkingTicketId) {
        const matchedLink = initialUnified.find((t) => t.idOrden === draft.linkingTicketId);
        if (matchedLink) {
          setLinkingTicket(matchedLink);
          setLinkOrderIdInput(draft.linkOrderIdInput || "");
        }
      }
    }
    draftHydratedRef.current = true;

    const pendingWarning = consumeCloudSyncWarning();
    if (pendingWarning) {
      showToast(pendingWarning);
    }

    // Sincronizar en tiempo real directamente con MySQL en la nube (Railway)
    void refreshCdeAndAsuFromCloud();

    const handleFocus = () => {
      void refreshCdeAndAsuFromCloud();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const buildCdeDraft = () => ({
    viewScope,
    searchTerm,
    statusFilter,
    categoryFamily,
    selectedCategories,
    transitFilter,
    recibidosDateFilter,
    currentPage,
    selectedTicketId: selectedTicket?.idOrden || null,
    isEditingModal,
    editForm,
    linkingTicketId: linkingTicket?.idOrden || null,
    linkOrderIdInput,
  });

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    saveWorkDraft("recepcion_cde_workspace", buildCdeDraft());
  }, [
    viewScope,
    searchTerm,
    statusFilter,
    categoryFamily,
    selectedCategories,
    transitFilter,
    recibidosDateFilter,
    currentPage,
    selectedTicket,
    isEditingModal,
    editForm,
    linkingTicket,
    linkOrderIdInput,
  ]);

  useFlushDraftBeforeLogout(() => {
    if (draftHydratedRef.current) {
      saveWorkDraft("recepcion_cde_workspace", buildCdeDraft());
    }
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5500);
  };

  const [showPrintModal, setShowPrintModal] = useState<RecepcionCdeTicket | null>(null);
  const [autoPrintTicket, setAutoPrintTicket] = useState(false);

  // Sincronizar y consolidar todas las órdenes recibidas, checkins y overrides con MySQL en la nube
  const handleSyncAllToCloud = async () => {
    setIsSyncingCloud(true);
    try {
      const overridesObj = getStoredSatiOverrides();

      // Recopilar lista de todas las órdenes confirmadas como recibidas
      const checkinList: Array<{
        idOrden: string;
        idOrdenAsu?: string;
        idOrdenCde?: string;
        recibidoEnDeposito: boolean;
        fechaRecibido: string;
      }> = [];

      tickets.forEach((t) => {
        if (isTicketRecibido(t)) {
          const f =
            t.fechaRecibidoDeposito ||
            t.fechaEntregada ||
            new Date().toLocaleDateString("es-PY", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
          checkinList.push({
            idOrden: t.idOrden,
            idOrdenAsu: t.idOrdenAsu,
            idOrdenCde: t.idOrdenCde,
            recibidoEnDeposito: true,
            fechaRecibido: f,
          });
        }
      });

      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SYNC_ALL_SATI_TO_MYSQL",
          checkins: checkinList,
          overrides: Object.entries(overridesObj).map(([key, val]) => ({
            key,
            ...val,
          })),
        }),
      });

      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Error al conectar con la base de datos.");
      }

      // Descargar datos consolidados desde MySQL
      const [dbCde, dbAsu] = await Promise.all([
        fetchCdeTicketsFromMySQL().catch(() => getStoredCdeTickets()),
        fetchTicketsFromMySQL().catch(() => getStoredTickets()),
      ]);

      const liveCheckins = getStoredCdeCheckins();
      const liveOverrides = getStoredSatiOverrides();
      const liveCross = getStoredSatiCrossMatches();
      const freshUnified = buildUnifiedSatiList(
        dbCde,
        dbAsu,
        liveCheckins,
        liveOverrides,
        liveCross
      );
      setTickets(freshUnified);

      showToast(
        `¡Sincronización con MySQL completada! ${
          json.totalSincronizados || checkinList.length
        } orden(es) sincronizadas y guardadas en la base de datos online.`
      );
    } catch (err: unknown) {
      console.error("Error en sincronización con MySQL:", err);
      const msg = err instanceof Error ? err.message : "Error al conectar con MySQL en la nube.";
      showToast(`${msg} Reintente en unos instantes.`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Manejar carga de uno o múltiples archivos CSV / Excel a la vez (ASU, CDE o ambos) y sincronizar a MySQL
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
          updatedTickets: [],
          totalFilasLeidas: 0,
          totalActualizadas: 0,
          totalNuevas: 0,
          totalSinCambios: 0,
          totalEnTransitoNuevos: 0,
          cambios: [],
          depurationStats: parsed.depurationStats,
          fileName: fileNamesLabel,
          timestamp: nowStr,
          origenLabel: "SATI Crudo (Depurado)",
        });
        showToast(
          `Se analizaron ${parsed.depurationStats.totalRawFilas.toLocaleString()} fila(s) crudas y todas fueron omitidas por depuración automática (históricas / filtros de cliente / paréntesis).`
        );
        return;
      }

      const hasAsu = parsed.asuRows.length > 0;
      const hasCde = parsed.cdeRows.length > 0;

      const [resAsu, resCde] = await Promise.all([
        hasAsu ? sincronizarRecepcionCsvOnline(parsed) : Promise.resolve(null),
        hasCde ? sincronizarCdeCsvOnline(parsed) : Promise.resolve(null),
      ]);

      const [asuTickets, cdeTickets] = await Promise.all([
        resAsu
          ? Promise.resolve(resAsu.updatedTickets)
          : fetchTicketsFromMySQL().catch(() => getStoredTickets()),
        resCde
          ? Promise.resolve(resCde.updatedTickets)
          : fetchCdeTicketsFromMySQL().catch(() => getStoredCdeTickets()),
      ]);

      await yieldToBrowser();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const cross = getStoredSatiCrossMatches();
      const unified = buildUnifiedSatiList(
        cdeTickets,
        asuTickets,
        checkins,
        overrides,
        cross
      );
      setTickets(unified);

      if (hasAsu && !hasCde) {
        setViewScope((prev) => (prev === "CLIENTES_CDE" ? "DANESA" : prev));
      }

      const cambiosCde = resCde?.cambios ?? [];
      const cambiosAsu: CambioEstadoCde[] = (resAsu?.cambios ?? []).map((c) => ({
        idOrden: c.idOrden,
        cliente: c.cliente,
        equipo: c.equipo,
        estadoAnterior: c.estadoAnterior,
        estadoNuevo: c.estadoNuevo,
        fechaEntregada: c.fechaEntregada,
        esDanesa: isTicketDanesa(c.cliente),
        enTransito: false,
      }));
      const combinedCambios = [...cambiosCde, ...cambiosAsu];

      const totalFilasLeidas =
        (resAsu?.totalFilasLeidas ?? 0) + (resCde?.totalFilasLeidas ?? 0);
      const totalActualizadas =
        (resAsu?.totalActualizadas ?? 0) + (resCde?.totalActualizadas ?? 0);
      const totalNuevas = (resAsu?.totalNuevas ?? 0) + (resCde?.totalNuevas ?? 0);
      const totalSinCambios =
        (resAsu?.totalSinCambios ?? 0) + (resCde?.totalSinCambios ?? 0);
      const totalEnTransitoNuevos = resCde?.totalEnTransitoNuevos ?? 0;

      const origenLabel =
        hasAsu && hasCde
          ? "Unificado ASU + CDE"
          : hasAsu
            ? "SATI ASU"
            : "Casa Matriz CDE";

      const nowStr = new Date().toLocaleTimeString("es-PY", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setCsvReport({
        updatedTickets: cdeTickets,
        totalFilasLeidas,
        totalActualizadas,
        totalNuevas,
        totalSinCambios,
        totalEnTransitoNuevos,
        depurationStats: parsed.depurationStats,
        cambios: combinedCambios,
        fileName: fileNamesLabel,
        timestamp: nowStr,
        origenLabel,
      });

      const totalModificadas = totalActualizadas + totalNuevas;
      if (totalModificadas > 0) {
        showToast(
          `Importación ${origenLabel} procesada: ${totalActualizadas} orden(es) actualizaron su estado${
            totalNuevas > 0 ? ` y ${totalNuevas} nueva(s)` : ""
          }${
            totalEnTransitoNuevos > 0
              ? ` (${totalEnTransitoNuevos} pasaron a En Tránsito por transportadora)`
              : ""
          }.`
        );
      } else {
        showToast(
          `Importación ${origenLabel} verificada (${totalFilasLeidas.toLocaleString()} órdenes): No se detectaron cambios de estado.`
        );
      }
    } catch (err: unknown) {
      console.error("Error al procesar o sincronizar los archivos CSV/Excel SATI:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Error al procesar o sincronizar los archivos SATI.";
      showToast(msg);
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

  // Recalcular métricas de rendimiento según el ámbito seleccionado
  const metrics = useMemo(() => {
    const totalUniversal = tickets.length;
    const danesaTickets = tickets.filter((t) => t.esDanesa);
    const clientesAsuTickets = tickets.filter(
      (t) =>
        !t.esDanesa &&
        (t.origen === "ASU" || parseInt(t.idOrden, 10) < 125000) &&
        !isEstadoInternoNoCliente(t.estadoAsu || t.estado) &&
        !isEstadoInternoNoCliente(getTicketDisplayStatus(t))
    );
    const clientesCdeTickets = tickets.filter(isTicketClienteCde);

    const scopeTickets =
      viewScope === "DANESA"
        ? danesaTickets
        : viewScope === "CLIENTES_ASU"
        ? clientesAsuTickets
        : viewScope === "CLIENTES_CDE"
        ? clientesCdeTickets
        : tickets;

    const conDias = (list: RecepcionCdeTicket[]) =>
      list.filter((t) => t.diasResolucion !== null && t.diasResolucion !== undefined && t.diasResolucion >= 0);
    const promedio = (list: RecepcionCdeTicket[]) => {
      const c = conDias(list);
      return c.length > 0 ? c.reduce((acc, t) => acc + (t.diasResolucion || 0), 0) / c.length : 0;
    };

    const esEntregada = (t: RecepcionCdeTicket) => {
      const isAsu = t.origen === "ASU" || (!t.origen && parseInt(t.idOrden, 10) < 100000);
      if (isAsu) {
        return (t.estadoAsu || t.estado || "").toLowerCase().includes("entregada");
      }
      return (t.estadoCde || t.estado || "").toLowerCase().includes("entregada");
    };

    // Tránsito por transportadora y recepción en depósito (Danesa SA)
    const danesaRecibidos = danesaTickets.filter(isTicketRecibido);
    const danesaEnTransito = danesaTickets.filter(isTicketEnCamino);

    // Equipos del ámbito aún en laboratorio CDE / ya cerrados
    const scopeEnLaboratorio = scopeTickets.filter((t) => !esEntregada(t));
    const scopeEntregadas = scopeTickets.filter(esEntregada);

    // Dictámenes: reparados vs sin reparo del ámbito
    const reparados = scopeTickets.filter(
      (t) =>
        t.estado === "Reparada" ||
        (t.mensaje || "").toLowerCase().includes("cambio") ||
        (t.mensaje || "").toLowerCase().includes("ok") ||
        (t.mensaje || "").toLowerCase().includes("reparacion") ||
        (t.mensaje || "").toLowerCase().includes("reemplazo")
    ).length;

    const sinReparo = scopeTickets.filter(
      (t) =>
        (t.estado || "").toLowerCase().includes("sin reparo") ||
        (t.mensaje || "").toLowerCase().includes("sin reparo") ||
        (t.mensaje || "").toLowerCase().includes("sem reparo")
    ).length;

    return {
      totalUniversal,
      totalDanesa: danesaTickets.length,
      totalClientesAsu: clientesAsuTickets.length,
      totalClientesCde: clientesCdeTickets.length,
      totalScope: scopeTickets.length,
      avgDiasScope: promedio(scopeTickets).toFixed(1),
      avgDiasTotal: promedio(tickets).toFixed(1),
      danesaRecibidos: danesaRecibidos.length,
      danesaEnTransito: danesaEnTransito.length,
      scopeEnLaboratorio: scopeEnLaboratorio.length,
      scopeEntregadas: scopeEntregadas.length,
      reparados,
      sinReparo,
    };
  }, [tickets, viewScope]);

  // Lista de tickets pertenecientes al ámbito actual (Danesa, Clientes ASU, Clientes CDE o Todos)
  const scopeTickets = useMemo(() => {
    let list: RecepcionCdeTicket[] = [];
    if (viewScope === "DANESA") {
      list = tickets.filter((t) => t.esDanesa);
    } else if (viewScope === "CLIENTES_ASU") {
      list = tickets.filter(
        (t) =>
          !t.esDanesa &&
          (t.origen === "ASU" || parseInt(t.idOrden, 10) < 125000) &&
          !isEstadoInternoNoCliente(t.estadoAsu || t.estado) &&
          !isEstadoInternoNoCliente(getTicketDisplayStatus(t))
      );
    } else if (viewScope === "CLIENTES_CDE") {
      list = tickets.filter(isTicketClienteCde);
    } else {
      list = tickets;
    }

    // Ordenamiento descendente consistente (más recientes primero) para sincronizar visualmente CDE y ASU
    return [...list].sort((a, b) => {
      const dateA = parseFechaDMY(a.fechaIngresoAsu || a.fechaIngresoCde || a.fechaIngreso);
      const dateB = parseFechaDMY(b.fechaIngresoAsu || b.fechaIngresoCde || b.fechaIngreso);
      if (dateA && dateB) {
        const diff = dateB.getTime() - dateA.getTime();
        if (diff !== 0) return diff;
      } else if (dateA && !dateB) {
        return -1;
      } else if (!dateA && dateB) {
        return 1;
      }
      const numA = parseInt(a.idOrden, 10) || 0;
      const numB = parseInt(b.idOrden, 10) || 0;
      return numB - numA;
    });
  }, [tickets, viewScope]);

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

  // Lista única de estados según el ámbito activo
  // Cuando es clientes (ASU o CDE), se excluyen estados internos de Danesa SA como "Enviado..." o "Liquidación"
  const statusOptions = useMemo<CleanSelectOption[]>(() => {
    const counts: Record<string, number> = {};
    const isClientes = viewScope === "CLIENTES_ASU" || viewScope === "CLIENTES_CDE";

    scopeTickets.forEach((t) => {
      const st = getTicketDisplayStatus(t);
      const lower = st.toLowerCase();

      // Si es ámbito de clientes, quitar estados internos no correspondientes a clientes finales
      if (isClientes) {
        if (
          isEstadoInternoNoCliente(st) ||
          lower.startsWith("enviado") ||
          lower.includes("liquidacion") ||
          lower.includes("liquidación")
        ) {
          return;
        }
      }

      counts[st] = (counts[st] || 0) + 1;
    });

    const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return [
      { value: "TODOS", label: "Todos los estados", count: scopeTickets.length },
      ...sorted.map((st) => ({
        value: st,
        label: st,
        count: counts[st],
      })),
    ];
  }, [scopeTickets, viewScope]);

  // Filtrado de tickets
  const filteredTickets = useMemo(() => {
    let result = scopeTickets;

    // 2. Filtro de Estado (alineado exactamente con el badge que se visualiza)
    if (statusFilter !== "TODOS") {
      result = result.filter((t) => getTicketDisplayStatus(t) === statusFilter);
    }

    // 3. Filtro Jerárquico de Categoría / Rubro
    if (categoryFamily !== "TODOS" || selectedCategories.length > 0) {
      result = result.filter((t) =>
        matchesCategoryFilter(t.tipoComponente, categoryFamily, selectedCategories)
      );
    }

    // 4. Filtro de Tránsito / Recibidos en Depósito / Sin Cruce
    if (transitFilter === "EN_TRANSITO") {
      result = result.filter(isTicketEnCamino);
    } else if (transitFilter === "RECIBIDOS") {
      result = result.filter(isTicketRecibido);
      if (recibidosDateFilter !== "TODAS") {
        result = result.filter((t) => matchesRecibidosDate(t, recibidosDateFilter));
      }
    } else if (transitFilter === "SIN_CRUCE") {
      result = result.filter(isTicketSinCruce);
    }

    // 5. Búsqueda por texto libre (soporta prefijo "(JC)" opcional y serial/modelo sin signos)
    if (searchTerm.trim()) {
      result = result.filter((t) => matchesSmartSatiSearch(t, searchTerm));
    }

    return result;
  }, [scopeTickets, statusFilter, categoryFamily, selectedCategories, transitFilter, recibidosDateFilter, searchTerm]);

  // Conteo dinámico según el ámbito para las pestañas de tránsito y recepción
  const scopeEnTransito = useMemo(() => {
    return scopeTickets.filter(isTicketEnCamino).length;
  }, [scopeTickets]);

  const scopeRecibidosList = useMemo(() => {
    return scopeTickets.filter(isTicketRecibido);
  }, [scopeTickets]);

  const scopeRecibidosCount = scopeRecibidosList.length;

  const scopeSinCruceCount = useMemo(() => {
    return scopeTickets.filter(isTicketSinCruce).length;
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

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  // Manejo de Checkin individual por fila única para aislar cada fila sin afectar otras
  const handleToggleCheckin = (ticketOrKey: RecepcionCdeTicket | string) => {
    const t = typeof ticketOrKey === "string" ? tickets.find((x) => x.rowKey === ticketOrKey) : ticketOrKey;
    const rowKey = typeof ticketOrKey === "string" ? ticketOrKey : ticketOrKey.rowKey || ticketOrKey.idOrden;
    const isCurrentlyRecibido = t ? isTicketRecibido(t) : false;
    const targetState = !isCurrentlyRecibido;
    const dateUsed =
      t?.fechaEntregada ||
      t?.fechaRecibidoDeposito ||
      new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

    const res = toggleCheckinDeposito(
      rowKey,
      {
        idOrden: t?.idOrden,
        idOrdenAsu: t?.idOrdenAsu,
        idOrdenCde: t?.idOrdenCde,
      },
      targetState,
      targetState ? dateUsed : ""
    );

    setTickets((prev) =>
      prev.map((item) => {
        if (item.rowKey === rowKey || (t?.idOrden && item.idOrden === t.idOrden)) {
          return {
            ...item,
            recibidoEnDeposito: res.recibido,
            fechaRecibidoDeposito: res.fecha,
            desmarcadoManual: !res.recibido,
          };
        }
        return item;
      })
    );
    if (selectedTicket && (selectedTicket.rowKey === rowKey || selectedTicket.idOrden === t?.idOrden)) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              recibidoEnDeposito: res.recibido,
              fechaRecibidoDeposito: res.fecha,
              desmarcadoManual: !res.recibido,
            }
          : null
      );
    }
    // Persistir asíncronamente en MySQL
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TOGGLE_CDE_CHECKIN",
        idOrden: t?.idOrden,
        idOrdenAsu: t?.idOrdenAsu,
        idOrdenCde: t?.idOrdenCde,
        recibidoEnDeposito: targetState,
        fechaRecibido: targetState ? dateUsed : "",
      }),
    }).catch(() => {});

    showToast(res.recibido ? "Orden confirmada como recibida en sucursal." : "Recepción desmarcada.");
  };

  // Abrir modal de vinculación rápida para conectar orden ASU ↔ CDE
  const openLinkModal = (ticket: RecepcionCdeTicket) => {
    setLinkingTicket(ticket);
    const esAsu = ticket.origen === "ASU" || ticket.esDanesa || parseInt(ticket.idOrden, 10) < 100000;
    const initialInput = esAsu ? (ticket.idOrdenCde || "") : (ticket.idOrdenAsu || "");
    setLinkOrderIdInput(initialInput && initialInput !== "Pendiente" ? initialInput : "");
  };

  // Sugerencias inteligentes para autocompletar el cruce (serial, equipo fuzzy, cliente con fallback "(JC)" y código)
  const linkSuggestions = useMemo(() => {
    if (!linkingTicket) return [];
    const esAsu = linkingTicket.origen === "ASU" || linkingTicket.esDanesa || parseInt(linkingTicket.idOrden, 10) < 100000;
    const candidates = tickets.filter((t) => {
      const num = parseInt(t.idOrden, 10);
      const isCandCde = t.origen === "CDE" || (!isNaN(num) && num >= 100000);
      return esAsu ? isCandCde : !isCandCde;
    });

    const targetSerial = normalizeSerial(linkingTicket.serial);
    const targetCod = (linkingTicket.codigoProducto || "").trim();

    const matches: Array<{ ticket: RecepcionCdeTicket; score: number; reason: string }> = [];

    for (const cand of candidates) {
      let score = 0;
      const reasons: string[] = [];
      const candSerial = normalizeSerial(cand.serial);
      const candCod = (cand.codigoProducto || "").trim();
      const equipSim = computeEquipmentSimilarity(
        linkingTicket.marca,
        linkingTicket.modelo,
        cand.marca,
        cand.modelo
      );
      const clientCheck = clientsMatch(linkingTicket.cliente, cand.cliente);

      if (targetSerial && candSerial && targetSerial === candSerial) {
        score += 120;
        reasons.push("Mismo serial");
      }
      if (clientCheck.matched) {
        score += clientCheck.viaJcFallback ? 45 : 60;
        reasons.push(clientCheck.viaJcFallback ? "Cliente (con JC)" : "Mismo cliente");
      }
      if (targetCod && candCod && targetCod === candCod) {
        score += 35;
        reasons.push("Mismo código");
      }
      if (equipSim >= 0.72) {
        score += Math.round(equipSim * 50);
        reasons.push(equipSim >= 0.98 ? "Mismo equipo" : "Equipo similar");
      }

      if (score >= 45) {
        matches.push({ ticket: cand, score, reason: reasons.slice(0, 2).join(" · ") });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [linkingTicket, tickets]);

  // Ejecutar vinculación interactiva entre orden ASU y CDE
  const handleLinkCrossMatch = async (ticket: RecepcionCdeTicket, rawInputId: string) => {
    const cleanInput = rawInputId.replace(/[^0-9]/g, "").trim();
    if (!cleanInput) {
      showToast("Por favor ingrese un número de orden válido.");
      return;
    }

    setIsSubmittingLink(true);
    try {
      const esAsu = ticket.origen === "ASU" || ticket.esDanesa || parseInt(ticket.idOrden, 10) < 100000;
      const idOrdenAsu = esAsu ? (ticket.idOrdenAsu || ticket.idOrden) : cleanInput;
      const idOrdenCde = esAsu ? cleanInput : (ticket.idOrdenCde || ticket.idOrden);

      // Guardar cruce en almacenamiento local
      saveSatiCrossMatchLocal(idOrdenAsu, idOrdenCde);

      // Guardar override
      saveSatiTicketOverride(ticket.rowKey || ticket.idOrden, {
        idOrdenAsu,
        idOrdenCde,
      });

      // Persistir de inmediato en MySQL en la nube (Railway)
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LINK_CROSS_MATCH",
          idOrdenAsu,
          idOrdenCde,
        }),
      }).catch((e) => console.warn("[MySQL Link Error]", e));

      // Reconstruir lista unificada enriquecida
      const cdeTickets = getStoredCdeTickets();
      const asuTickets = getStoredTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const manualCross = getStoredSatiCrossMatches();
      const updatedUnified = buildUnifiedSatiList(cdeTickets, asuTickets, checkins, overrides, manualCross);
      setTickets(updatedUnified);

      setLinkingTicket(null);
      setLinkOrderIdInput("");
      showToast(`¡Cruce SATI exitoso! Orden ASU #${idOrdenAsu} vinculada con CDE #${idOrdenCde} y guardada en MySQL.`);
    } catch (err: unknown) {
      console.error("Error al vincular cruce:", err);
      showToast("Error al vincular las órdenes.");
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // Desvincular cruce existente
  const handleUnlinkCrossMatch = async (ticket: RecepcionCdeTicket) => {
    if (!ticket.idOrdenAsu || !ticket.idOrdenCde) return;
    try {
      removeSatiCrossMatchLocal(ticket.idOrdenAsu, ticket.idOrdenCde);
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UNLINK_CROSS_MATCH",
          idOrdenAsu: ticket.idOrdenAsu,
          idOrdenCde: ticket.idOrdenCde,
        }),
      }).catch(() => {});

      const cdeTickets = getStoredCdeTickets();
      const asuTickets = getStoredTickets();
      const checkins = getStoredCdeCheckins();
      const overrides = getStoredSatiOverrides();
      const manualCross = getStoredSatiCrossMatches();
      const updatedUnified = buildUnifiedSatiList(cdeTickets, asuTickets, checkins, overrides, manualCross);
      setTickets(updatedUnified);
      setLinkingTicket(null);
      showToast("Cruce desvinculado correctamente.");
    } catch {
      showToast("Error al desvincular.");
    }
  };

  // Abrir Modal de Detalle y cargar formulario de edición
  const handleOpenTicketModal = (ticket: RecepcionCdeTicket) => {
    setSelectedTicket(ticket);
    setIsEditingModal(false);
    const fechaRecibidoActual =
      ticket.fechaRecibidoDeposito ||
      (isTicketRecibido(ticket) ? (ticket.fechaEntregada || "") : "");

    setEditForm({
      idOrdenAsu: ticket.idOrdenAsu || (ticket.origen === "ASU" ? ticket.idOrden : ""),
      idOrdenCde: ticket.idOrdenCde || (ticket.origen === "CDE" ? ticket.idOrden : ""),
      fechaIngresoAsu: ticket.fechaIngresoAsu || (ticket.origen === "ASU" ? ticket.fechaIngreso : ""),
      fechaIngresoCde: ticket.fechaIngresoCde || (ticket.origen === "CDE" ? ticket.fechaIngreso : ""),
      fechaDespachoCde: ticket.fechaEntregada || "",
      fechaRecibidoAsu: fechaRecibidoActual,
    });
  };

  // Guardar modificaciones manuales de fechas y números de orden
  const handleSaveTicketEdits = async () => {
    if (!selectedTicket) return;
    setIsSavingEdits(true);
    try {
      const rowKey = selectedTicket.rowKey || selectedTicket.idOrden;
      const newIngreso = editForm.fechaIngresoAsu || editForm.fechaIngresoCde || selectedTicket.fechaIngreso;
      const newDespacho = editForm.fechaDespachoCde;
      const newDias = newDespacho ? calcularDiasResolucion(newIngreso, newDespacho) : null;
      const newRecibidoAsu = editForm.fechaRecibidoAsu.trim();
      const isRecibidoNow = Boolean(newRecibidoAsu) || isTicketRecibido(selectedTicket);

      // Guardar override persistente en localStorage
      saveSatiTicketOverride(rowKey, {
        idOrdenAsu: editForm.idOrdenAsu,
        idOrdenCde: editForm.idOrdenCde,
        fechaIngresoAsu: editForm.fechaIngresoAsu,
        fechaIngresoCde: editForm.fechaIngresoCde,
        fechaDespachoCde: editForm.fechaDespachoCde,
        fechaRecibidoAsu: newRecibidoAsu,
      });

      // Si se estableció una fecha de recibido o fue confirmado, actualizar checkin local y remoto
      if (newRecibidoAsu) {
        toggleCheckinDeposito(
          rowKey,
          {
            idOrden: selectedTicket.idOrden,
            idOrdenAsu: editForm.idOrdenAsu || selectedTicket.idOrdenAsu,
            idOrdenCde: editForm.idOrdenCde || selectedTicket.idOrdenCde,
          },
          true,
          newRecibidoAsu
        );
      }

      // Persistir a MySQL
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_SATI_TICKET',
          idOrden: selectedTicket.idOrden,
          idOrdenAsu: editForm.idOrdenAsu,
          idOrdenCde: editForm.idOrdenCde,
          fechaIngresoAsu: editForm.fechaIngresoAsu,
          fechaIngresoCde: editForm.fechaIngresoCde,
          fechaDespachoCde: editForm.fechaDespachoCde,
          fechaRecibidoAsu: newRecibidoAsu,
          recibidoEnDeposito: isRecibidoNow,
        }),
      }).catch((e) => console.warn('[MySQL Save Error]', e));

      // Actualizar en el estado de React
      setTickets((prev) =>
        prev.map((t) => {
          if (t.rowKey === rowKey || t.idOrden === selectedTicket.idOrden) {
            return {
              ...t,
              idOrdenAsu: editForm.idOrdenAsu || t.idOrdenAsu,
              idOrdenCde: editForm.idOrdenCde || t.idOrdenCde,
              fechaIngresoAsu: editForm.fechaIngresoAsu || t.fechaIngresoAsu,
              fechaIngresoCde: editForm.fechaIngresoCde || t.fechaIngresoCde,
              fechaEntregada: editForm.fechaDespachoCde,
              fechaIngreso: newIngreso,
              diasResolucion: newDias,
              fechaRecibidoDeposito: newRecibidoAsu || t.fechaRecibidoDeposito,
              recibidoEnDeposito: isRecibidoNow,
              desmarcadoManual: false,
            };
          }
          return t;
        })
      );

      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              idOrdenAsu: editForm.idOrdenAsu || prev.idOrdenAsu,
              idOrdenCde: editForm.idOrdenCde || prev.idOrdenCde,
              fechaIngresoAsu: editForm.fechaIngresoAsu || prev.fechaIngresoAsu,
              fechaIngresoCde: editForm.fechaIngresoCde || prev.fechaIngresoCde,
              fechaEntregada: editForm.fechaDespachoCde,
              fechaIngreso: newIngreso,
              diasResolucion: newDias,
              fechaRecibidoDeposito: newRecibidoAsu || prev.fechaRecibidoDeposito,
              recibidoEnDeposito: isRecibidoNow,
              desmarcadoManual: false,
            }
          : null
      );

      setIsEditingModal(false);
      showToast("Datos y fechas de la orden actualizados correctamente en MySQL.");
    } catch (err) {
      console.error("Error al guardar cambios de orden:", err);
      showToast("Error al guardar los cambios.");
    } finally {
      setIsSavingEdits(false);
    }
  };

  const hasCrossMatch = (ticket: RecepcionCdeTicket): boolean => {
    const esAsu = ticket.origen === "ASU" || ticket.esDanesa || parseInt(ticket.idOrden, 10) < 100000;
    if (esAsu) {
      if (!ticket.idOrdenCde) return false;
      const num = parseInt(ticket.idOrdenCde.trim(), 10);
      return !isNaN(num) && num >= 100000 && ticket.idOrdenCde !== (ticket.idOrdenAsu || ticket.idOrden);
    } else {
      if (!ticket.idOrdenAsu) return false;
      const num = parseInt(ticket.idOrdenAsu.trim(), 10);
      return !isNaN(num) && num < 100000 && ticket.idOrdenAsu !== ticket.idOrden;
    }
  };

  const getStatusBadge = (ticket: RecepcionCdeTicket) => {
    const displayStatus = getTicketDisplayStatus(ticket);
    const lower = displayStatus.toLowerCase();

    if (lower === "entregada") {
      const esFilaAsu =
        ticket.origen === "ASU" ||
        (!ticket.origen && !isNaN(parseInt(ticket.idOrden, 10)) && parseInt(ticket.idOrden, 10) < 100000);
      const fechaEntregaMostrar = esFilaAsu
        ? (isFechaValida(ticket.fechaEntregadaAsu) ? ticket.fechaEntregadaAsu : "") ||
          (isFechaValida(ticket.fechaRecibidoDeposito) ? ticket.fechaRecibidoDeposito : "") ||
          (isFechaValida(ticket.fechaEntregada) ? ticket.fechaEntregada : "")
        : (isFechaValida(ticket.fechaEntregada) ? ticket.fechaEntregada : "") ||
          (isFechaValida(ticket.fechaEntregadaAsu) ? ticket.fechaEntregadaAsu : "") ||
          (isFechaValida(ticket.fechaRecibidoDeposito) ? ticket.fechaRecibidoDeposito : "");

      return (
        <div className="inline-flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#2A9D8F] text-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            <span>Entregada</span>
          </span>
          {fechaEntregaMostrar && (
            <span
              className="text-[10px] font-mono font-bold text-black bg-[#FFD23F] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] block"
              title={`Fecha de entrega al cliente: ${fechaEntregaMostrar}`}
            >
              {fechaEntregaMostrar}
            </span>
          )}
        </div>
      );
    }

    if (lower === "reparada") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#2A9D8F] text-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          <span>Reparada</span>
        </span>
      );
    }

    if (lower.includes("tránsito") || lower.includes("transito")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFD23F] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
          <SpeedTruck className="w-3.5 h-3.5 text-black" smokeColor="bg-black" />
          <span>En Tránsito (Transportadora)</span>
        </span>
      );
    }

    if (lower.includes("sin reparo")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#E76F51] text-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
          <AlertCircle className="w-3.5 h-3.5 text-white" />
          <span>{displayStatus}</span>
        </span>
      );
    }

    if (lower.includes("qc") || lower.includes("control de calidad")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFFDF9] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
          <ShieldCheck className="w-3.5 h-3.5 text-black" />
          <span>Control de Calidad (QC)</span>
        </span>
      );
    }

    // Estado real de la orden de ASU (ej. "En Asignación", "En Diagnóstico", "En Recepción", etc.)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FAF6EE] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
        <Clock className="w-3.5 h-3.5 text-black" />
        <span>{displayStatus}</span>
      </span>
    );
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#fbf9f9] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
          <span>Cargando datos de SATI ASU - CDE...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard requiredModule="deposito.danesa">
      <main className="min-h-dvh bg-[#FAF6EE] text-[#111111] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10 font-sans">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 min-w-0">

        {/* Notificación Toast Flotante */}
        {notification && (
          <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 bg-[#FFD23F] text-black px-4 py-2.5 rounded-lg text-xs font-heading font-extrabold shadow-[4px_4px_0px_#000] border-2 border-black flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Cabecera unificada Neo-Brutalista Retro */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b-2 border-black">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FFD23F] text-black text-xs font-mono font-bold border-2 border-black shadow-[2px_2px_0px_#000] mb-2">
              <span>SATI · CASA MATRIZ CDE ↔ SUCURSAL ASU</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#111111] tracking-tight">
              SATI ASU - CDE
            </h1>
            <p className="text-xs sm:text-sm text-neutral-800 mt-1 max-w-3xl font-medium">
              Monitoreo de envíos por transportadora, tiempos de retorno de laboratorio SATI y confirmación de recepción en sucursal con código de barras CODE128.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Input oculto para carga múltiple de CSV o Excel (.xlsx) */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SPREADSHEET_FILE_ACCEPT}
              onChange={handleCSVFileChange}
              className="hidden"
            />

            {/* Botón idéntico al de Recepción con estilo Neo-Brutalista */}
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FFFDF9] hover:bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              title="Subir uno o varios archivos CSV o Excel (.xlsx) a la vez (ASU y/o CDE)"
            >
              <span className="w-6 h-6 rounded bg-black text-[#FFD23F] flex items-center justify-center font-bold border border-black">
                <Upload className="w-3.5 h-3.5" />
              </span>
              <div className="text-left leading-tight">
                <strong className="block text-xs font-heading font-extrabold text-black">
                  {isUploadingCSV ? "Subiendo a MySQL..." : "Subir CSV / Excel"}
                </strong>
                <span className="text-[10px] text-neutral-700 font-mono font-semibold">
                  {isUploadingCSV ? "Sincronizando online" : "Uno o varios (ASU / CDE)"}
                </span>
              </div>
            </button>

            {/* UN SOLO AuthBadge al extremo derecho */}
            <AuthBadge
              requiredModule="deposito.danesa"
              onSyncMysql={handleSyncAllToCloud}
              isSyncingMysql={isSyncingCloud}
            />
          </div>
        </div>

        {/* Panel de Notificación y Recuento de Actualización por CSV */}
        {/* Panel de Notificación y Recuento de Actualización por CSV (Neo-Brutalismo Retro) */}
        {csvReport && (
          <section
            className={`rounded-xl border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_#000] space-y-4 ${
              csvReport.cambios.length > 0
                ? "bg-[#FFD23F]/25"
                : "bg-[#FFFDF9]"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0 ${
                    csvReport.cambios.length > 0
                      ? "bg-black text-[#FFD23F]"
                      : "bg-black text-white"
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
                    <h3 className="text-sm sm:text-base font-heading font-extrabold text-black">
                      {csvReport.cambios.length > 0
                        ? `¡Actualización completada! Se detectaron ${csvReport.cambios.length} cambio(s) en el CSV de ${csvReport.origenLabel || "Casa Matriz CDE"}`
                        : "Archivo CSV verificado: No se detectaron cambios de estado"}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFFDF9] border border-black text-black shadow-[1px_1px_0px_#000]">
                      {csvReport.fileName} · {csvReport.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-800 mt-0.5 font-medium">
                    {csvReport.cambios.length > 0
                      ? `Se actualizaron ${csvReport.totalActualizadas} estado(s)${
                          csvReport.totalEnTransitoNuevos > 0
                            ? ` (${csvReport.totalEnTransitoNuevos} pasaron a En Tránsito por transportadora)`
                            : ""
                        } y se integraron ${csvReport.totalNuevas} orden(es) nuevas en MySQL.`
                      : `Se compararon las ${csvReport.totalFilasLeidas.toLocaleString()} órdenes del archivo y todas coinciden con los registros actuales.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCsvReport(null)}
                className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-[#FFFDF9] hover:bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1 cursor-pointer transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar resumen</span>
              </button>
            </div>

            {/* Tarjetas de Recuento de la Carga CSV */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase">Órdenes leídas en CSV</span>
                <strong className="text-lg font-mono font-extrabold text-black">
                  {csvReport.totalFilasLeidas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase">Estados actualizados</span>
                <strong className="text-lg font-mono font-extrabold text-[#2A9D8F]">
                  {csvReport.totalActualizadas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase">En Tránsito (Transportadora)</span>
                <strong className="text-lg font-mono font-extrabold text-black flex items-center gap-1.5">
                  <SpeedTruck className="w-4 h-4 text-black" smokeColor="bg-black" />
                  <span>{csvReport.totalEnTransitoNuevos.toLocaleString()}</span>
                </strong>
              </div>
              <div className="bg-[#FFFDF9] p-3 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
                <span className="text-[11px] font-mono font-bold text-neutral-700 block uppercase">Órdenes sin cambios</span>
                <strong className="text-lg font-mono font-extrabold text-neutral-700">
                  {csvReport.totalSinCambios.toLocaleString()}
                </strong>
              </div>
            </div>

            <SatiDepurationSummary stats={csvReport.depurationStats} />

            {/* Tabla detallada de las órdenes que cambiaron de estado */}
            {csvReport.cambios.length > 0 && (
              <div className="bg-[#FFFDF9] rounded-lg border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]">
                <div className="px-3.5 py-2 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between">
                  <span className="text-xs font-heading font-extrabold text-black">
                    Detalle de órdenes con cambios ({csvReport.cambios.length})
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
                      className="px-3.5 py-2 text-xs flex items-center justify-between hover:bg-[#FAF6EE] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-black bg-[#FFD23F] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                          #{c.idOrden}
                        </span>
                        <div>
                          <strong className="text-black font-bold">{c.cliente}</strong>
                          {c.esDanesa && (
                            <span className="ml-1.5 text-[10px] font-bold text-black bg-[#FFD23F] px-1 rounded border border-black">
                              Danesa SA
                            </span>
                          )}
                          <span className="text-neutral-700 font-mono block text-[11px]">
                            {c.equipo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-neutral-200 text-neutral-700 line-through font-mono">
                          {c.estadoAnterior}
                        </span>
                        <ArrowRight className="w-3 h-3 text-black" />
                        {c.enTransito ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]">
                            <SpeedTruck className="w-3 h-3 text-black" smokeColor="bg-black" />
                            <span>En Tránsito (Transportadora)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {c.estadoNuevo}
                          </span>
                        )}
                        {c.fechaEntregada && (
                          <span className="text-[10px] font-mono font-semibold text-neutral-700">
                            {c.fechaEntregada}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tarjetas KPI de Rendimiento (Neo-Brutalismo Retro) */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[11px] font-mono font-bold text-neutral-700 uppercase tracking-wider block">
              {viewScope === "DANESA"
                ? "Envíos Danesa SA"
                : viewScope === "CLIENTES_ASU"
                ? "Clientes ASU"
                : viewScope === "CLIENTES_CDE"
                ? "Clientes CDE"
                : "Total Registros"}
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-mono font-extrabold text-black">
                {metrics.totalScope.toLocaleString()}
              </strong>
              <span className="text-[11px] font-mono font-bold text-neutral-600">
                de {metrics.totalUniversal.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-neutral-700 leading-tight font-medium">
              Órdenes del ámbito registradas
            </p>
          </div>

          {viewScope === "DANESA" ? (
            <>
              <div className="p-4 bg-[#FFD23F]/20 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                <span className="text-[11px] font-mono font-bold text-black uppercase tracking-wider block">
                  En Transportadora
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-mono font-extrabold text-black">
                    {metrics.danesaEnTransito}
                  </strong>
                  <span className="text-[11px] font-mono font-bold text-black">
                    En camino
                  </span>
                </div>
                <p className="text-[11px] text-neutral-800 leading-tight font-medium">
                  Despachadas por CDE, pendientes ASU
                </p>
              </div>
              <div className="p-4 bg-[#2A9D8F]/15 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                <span className="text-[11px] font-mono font-bold text-black uppercase tracking-wider block">
                  Recibidos en Depósito
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-mono font-extrabold text-[#2A9D8F]">
                    {metrics.danesaRecibidos}
                  </strong>
                  <span className="text-[11px] font-mono font-bold text-[#2A9D8F]">
                    Verificados
                  </span>
                </div>
                <p className="text-[11px] text-neutral-800 leading-tight font-medium">
                  Cajas físicas recibidas en ASU
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-[#2A9D8F]/15 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                <span className="text-[11px] font-mono font-bold text-black uppercase tracking-wider block">
                  Entregadas
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-mono font-extrabold text-[#2A9D8F]">
                    {metrics.scopeEntregadas}
                  </strong>
                  <span className="text-[11px] font-mono font-bold text-[#2A9D8F]">
                    Cerradas
                  </span>
                </div>
                <p className="text-[11px] text-neutral-800 leading-tight font-medium">
                  Órdenes cerradas y entregadas
                </p>
              </div>
              <div className="p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                <span className="text-[11px] font-mono font-bold text-neutral-700 uppercase tracking-wider block">
                  Envíos Danesa SA
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-mono font-extrabold text-black">
                    {metrics.totalDanesa}
                  </strong>
                  <span className="text-[11px] font-mono font-bold text-neutral-600">
                    Sucursal
                  </span>
                </div>
                <p className="text-[11px] text-neutral-700 leading-tight font-medium">
                  Para comparar contra clientes
                </p>
              </div>
            </>
          )}

          <div className="p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[11px] font-mono font-bold text-neutral-700 uppercase tracking-wider block">
              Tiempo Prom. Retorno
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-mono font-extrabold text-black">
                {metrics.avgDiasScope} <span className="text-sm font-normal text-neutral-600">días</span>
              </strong>
              <span className="text-[11px] font-mono font-bold text-neutral-600">
                Tot: {metrics.avgDiasTotal}d
              </span>
            </div>
            <p className="text-[11px] text-neutral-700 leading-tight font-medium">
              Lapso entre ingreso y entrega
            </p>
          </div>
          <div className="p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[11px] font-mono font-bold text-neutral-700 uppercase tracking-wider block">
              En Laboratorio
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-mono font-extrabold text-black">
                {metrics.scopeEnLaboratorio}
              </strong>
              <span className="text-[11px] font-mono font-bold text-neutral-600">
                En proceso
              </span>
            </div>
            <p className="text-[11px] text-neutral-700 leading-tight font-medium">
              Equipos en diagnóstico o reparación
            </p>
          </div>
          <div className="p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[11px] font-mono font-bold text-neutral-700 uppercase tracking-wider block">
              Resolución
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-mono font-extrabold text-[#2A9D8F]">{metrics.reparados}</strong>
              <span className="text-[11px] font-mono font-bold text-[#E76F51]">{metrics.sinReparo} Sin Rep.</span>
            </div>
            <p className="text-[11px] text-neutral-700 leading-tight font-medium">Reparados vs Sin Reparo / RMA</p>
          </div>
        </section>

        {/* Barra de Filtros, Selector de Ámbito Reestructurado y Búsqueda */}
        <section className="p-4 bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">

            {/* Selector de Ámbito con estilo Neo-Brutalista Retro */}
            <div className="w-full lg:w-auto flex items-center gap-1.5 p-1.5 bg-[#FAF6EE] rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex-wrap">
              {(
                [
                  {
                    key: "DANESA" as ViewScope,
                    label: "Danesa SA (Nuestra Sucursal)",
                    count: metrics.totalDanesa,
                    icon: <Package className="w-3.5 h-3.5" />,
                  },
                  {
                    key: "CLIENTES_ASU" as ViewScope,
                    label: "Clientes ASU",
                    count: metrics.totalClientesAsu,
                    icon: <UserCheck className="w-3.5 h-3.5" />,
                  },
                  {
                    key: "CLIENTES_CDE" as ViewScope,
                    label: "Clientes CDE",
                    count: metrics.totalClientesCde,
                    icon: <Building2 className="w-3.5 h-3.5" />,
                  },
                  {
                    key: "TODOS" as ViewScope,
                    label: "Todos",
                    count: metrics.totalUniversal,
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                    viewScope === s.key
                      ? "bg-[#FFD23F] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                      : "text-neutral-800 hover:bg-neutral-200 border-2 border-transparent"
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold border border-black ${
                      viewScope === s.key ? "bg-black text-[#FFD23F]" : "bg-white text-black"
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

          {/* Filtros Secundarios con CleanSelect */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100">
            {/* Filtro de Tránsito / Recibidos (visible para todos los ámbitos: Danesa, Clientes ASU, Clientes CDE y Todos) */}
            <div className="flex flex-wrap items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-xs max-w-full">
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
                Todos los envíos
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransitFilter("EN_TRANSITO");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  transitFilter === "EN_TRANSITO"
                    ? "bg-amber-500 text-white font-bold shadow-xs"
                    : "text-amber-700 hover:bg-amber-100/60"
                }`}
              >
                <SpeedTruck
                  className={`w-3.5 h-3.5 ${transitFilter === "EN_TRANSITO" ? "text-white" : "text-amber-700"}`}
                  smokeColor={transitFilter === "EN_TRANSITO" ? "bg-white/80" : "bg-amber-400"}
                />
                <span>En camino ({scopeEnTransito})</span>
              </button>
              {viewScope !== "CLIENTES_CDE" && (
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
              )}
              <button
                type="button"
                onClick={() => {
                  setTransitFilter("SIN_CRUCE");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  transitFilter === "SIN_CRUCE"
                    ? "bg-indigo-600 text-white font-bold shadow-xs"
                    : "text-indigo-700 hover:bg-indigo-100/60"
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>Sin Cruce ({scopeSinCruceCount})</span>
              </button>
            </div>

            {/* Filtro de Fecha de Recepción (Hoy / Ayer / etc.) cuando se selecciona Recibidos (solo ASU y Danesa) */}
            {viewScope !== "CLIENTES_CDE" && transitFilter === "RECIBIDOS" && (
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
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 underline ml-auto cursor-pointer"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        </section>

        {/* Banner Explicativo de Cruces Pendientes */}
        {transitFilter === "SIN_CRUCE" && (
          <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-950 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-indigo-950 text-sm">
                  Apartado de Cruces Pendientes ({filteredTickets.length} órdenes por vincular)
                </p>
                <p className="text-xs text-indigo-800 mt-0.5">
                  Estas órdenes aún no tienen su orden complementaria asignada (ASU o CDE). Haga clic en el botón <strong>+ Vincular</strong> en la primera columna para asociarlas de forma definitiva y sincronizarlas en MySQL de la nube.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Órdenes SATI ASU - CDE */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                {viewScope === "DANESA"
                  ? "Envíos Danesa SA (Nuestra Sucursal ASU ↔ Laboratorio CDE)"
                  : viewScope === "CLIENTES_ASU"
                  ? "Órdenes de Clientes Particulares ASU"
                  : viewScope === "CLIENTES_CDE"
                  ? "Órdenes de Clientes SATI CDE"
                  : "Consolidado General de Órdenes SATI"}{" "}
                ({filteredTickets.length.toLocaleString()})
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Página {currentPage} de {totalPages}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-[#FFD23F] font-mono uppercase text-xs tracking-wider border-b-2 border-black">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Nº Orden</th>
                  <th className="py-3.5 px-3.5 font-bold">Cliente</th>
                  <th className="py-3.5 px-3.5 font-bold">Equipo / Hardware</th>
                  <th className="py-3.5 px-3.5 font-bold">Serial</th>
                  <th className="py-3.5 px-3.5 font-bold">Ingreso ASU</th>
                  <th className="py-3.5 px-3.5 font-bold">Ingreso CDE</th>
                  <th className="py-3.5 px-3.5 font-bold">Despacho CDE</th>
                  <th className="py-3.5 px-3.5 text-center font-bold">Días Taller</th>
                  <th className="py-3.5 px-3.5 font-bold">Estado</th>
                  <th className="py-3.5 px-3.5 font-bold">Dictamen / Informe Técnico</th>
                  {viewScope !== "CLIENTES_CDE" && (
                    <th className="py-3.5 px-3.5 text-center font-bold">Llegada Depósito</th>
                  )}
                  <th className="py-3.5 px-4 text-right font-bold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={viewScope === "CLIENTES_CDE" ? 11 : 12}
                      className="py-12 text-center text-zinc-500"
                    >
                      <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="font-semibold text-sm text-zinc-700">No se encontraron órdenes con los filtros actuales.</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Pruebe modificando los términos de búsqueda o el selector de ámbito.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket, idx) => {
                    const rowKey = getTicketRowKey(ticket, (currentPage - 1) * ITEMS_PER_PAGE + idx);
                    const isDanesa = ticket.esDanesa;
                    const days = ticket.diasResolucion;

                    // Determinación del N° de Orden principal y del cruce
                    // Danesa SA: Orden ASU arriba (29403+), CDE abajo (125000+)
                    const esOrdenCdeNativa = parseInt(ticket.idOrden, 10) >= 125000;
                    const idAsuPrincipal = isDanesa
                      ? ticket.idOrdenAsu || (!esOrdenCdeNativa ? ticket.idOrden : null)
                      : ticket.origen === "ASU" || !esOrdenCdeNativa
                      ? ticket.idOrden
                      : ticket.idOrdenAsu;

                    // Validación estricta: Una orden de CDE DEBE ser >= 125000 y distinta a la orden de ASU
                    const esCdeValido = (id?: string | null): boolean => {
                      if (!id) return false;
                      const num = parseInt(id.trim(), 10);
                      return !isNaN(num) && num >= 125000;
                    };

                    const rawCdeId = isDanesa
                      ? ticket.idOrdenCde || (esOrdenCdeNativa ? ticket.idOrden : null)
                      : esOrdenCdeNativa
                      ? ticket.idOrden
                      : ticket.idOrdenCde;

                    const idCdeVinculado = esCdeValido(rawCdeId) && rawCdeId !== idAsuPrincipal ? rawCdeId : null;

                    return (
                      <tr
                        key={rowKey}
                        className="hover:bg-zinc-50/80 transition-colors"
                      >
                        {/* Nº Orden según el ámbito */}
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                          {isDanesa ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-900 text-white font-extrabold text-sm">
                                  #{idAsuPrincipal || ticket.idOrden}
                                </span>
                                <span className="text-xs font-sans font-bold text-zinc-500">ASU</span>
                              </div>
                              {idCdeVinculado ? (
                                <div
                                  onClick={() => openLinkModal(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer hover:bg-indigo-100 transition-colors"
                                  title={`Vinculado a Orden CDE #${idCdeVinculado}. Click para modificar o desvincular`}
                                >
                                  <Link2 className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>CDE: #{idCdeVinculado}</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openLinkModal(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                  title="Sin orden CDE vinculada. Haga click para vincular"
                                >
                                  <Plus className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>Vincular CDE</span>
                                </button>
                              )}
                            </div>
                          ) : viewScope === "CLIENTES_CDE" || esOrdenCdeNativa ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-sm font-bold">
                                  #{ticket.idOrdenCde || ticket.idOrden}
                                </span>
                                <span className="text-xs font-sans font-bold text-zinc-400">CDE</span>
                              </div>
                              {ticket.idOrdenAsu && ticket.idOrdenAsu !== (ticket.idOrdenCde || ticket.idOrden) ? (
                                <div
                                  onClick={() => openLinkModal(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer hover:bg-indigo-100 transition-colors"
                                  title={`Vinculado a Orden ASU #${ticket.idOrdenAsu}. Click para modificar o desvincular`}
                                >
                                  <Link2 className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>ASU: #{ticket.idOrdenAsu}</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openLinkModal(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                  title="Sin orden ASU vinculada. Haga click para vincular"
                                >
                                  <Plus className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>Vincular ASU</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-sm font-bold">
                                  #{ticket.idOrdenAsu || ticket.idOrden}
                                </span>
                                <span className="text-xs font-sans font-bold text-zinc-400">ASU</span>
                              </div>
                              {esCdeValido(ticket.idOrdenCde) && ticket.idOrdenCde !== (ticket.idOrdenAsu || ticket.idOrden) ? (
                                <div
                                  onClick={() => openLinkModal(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer hover:bg-indigo-100 transition-colors"
                                  title={`Vinculado a Orden CDE #${ticket.idOrdenCde}. Click para modificar o desvincular`}
                                >
                                  <Link2 className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>CDE: #{ticket.idOrdenCde}</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openLinkModal(ticket)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                  title="Sin orden CDE vinculada. Haga click para vincular"
                                >
                                  <Plus className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>Vincular CDE</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-3.5 max-w-[200px]">
                          {isDanesa ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 font-bold text-zinc-900 bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 text-xs">
                                <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>{ticket.cliente}</span>
                              </span>
                              {ticket.clienteAsu && ticket.clienteAsu.toLowerCase() !== "danesa sa" && (
                                <span
                                  className="text-xs text-zinc-600 block truncate font-sans font-medium"
                                  title={`Cliente final registrado en ASU: ${ticket.clienteAsu}`}
                                >
                                  👤 {ticket.clienteAsu}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-bold text-zinc-900 text-sm">{ticket.cliente}</span>
                          )}
                        </td>

                        {/* Equipo / Hardware */}
                        <td className="py-3.5 px-3.5 max-w-[250px]">
                          <strong className="block font-bold text-zinc-900 truncate text-sm">
                            {ticket.marca} {ticket.modelo}
                          </strong>
                          <span className="text-xs text-zinc-500 font-mono block mt-0.5">
                            {ticket.tipoComponente} · Cód: {ticket.codigoProducto || "N/A"}
                          </span>
                        </td>

                        {/* Serial */}
                        <td className="py-3.5 px-3.5 font-mono text-zinc-700 whitespace-nowrap max-w-[140px] truncate text-xs font-medium">
                          {ticket.serial || "SIN SERIAL"}
                        </td>

                        {/* Fecha de Ingreso ASU */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap text-zinc-700 font-mono text-xs">
                          {isFechaValida(ticket.fechaIngresoAsu || (ticket.origen === "ASU" ? ticket.fechaIngreso : "")) ? (
                            ticket.fechaIngresoAsu || ticket.fechaIngreso
                          ) : (
                            <span className="text-zinc-400 italic">-</span>
                          )}
                        </td>

                        {/* Fecha de Ingreso CDE */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap text-zinc-700 font-mono text-xs">
                          {isFechaValida(ticket.fechaIngresoCde || (ticket.origen === "CDE" ? ticket.fechaIngreso : "")) ? (
                            <span className="font-bold text-zinc-900">
                              {ticket.fechaIngresoCde || ticket.fechaIngreso}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Pendiente CDE</span>
                          )}
                        </td>

                        {/* Despacho CDE */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap font-mono text-xs">
                          {isFechaValida(ticket.fechaEntregada) && isDespachoCoherente(ticket.fechaIngreso, ticket.fechaEntregada) ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900">{ticket.fechaEntregada}</span>
                              <span className="text-xs text-amber-700 font-sans flex items-center gap-1 font-semibold mt-0.5">
                                <SpeedTruck className="w-3 h-3 text-amber-700" smokeColor="bg-amber-400" />
                                <span>Despacho transportadora</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">En taller CDE</span>
                          )}
                        </td>

                        {/* Días en Taller CDE */}
                        <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                          {isDespachoCoherente(ticket.fechaIngreso, ticket.fechaEntregada) && days !== null && days !== undefined && days >= 0 ? (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                                days <= 7
                                  ? "bg-emerald-100 text-emerald-800"
                                  : days <= 20
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                              title={`Tiempo total en taller: ${days} días`}
                            >
                              {days} d
                            </span>
                          ) : (
                            <span className="text-zinc-300 font-mono">-</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {getStatusBadge(ticket)}
                        </td>

                        {/* Dictamen / Informe Técnico */}
                        <td className="py-3.5 px-3.5 max-w-[280px]">
                          {(() => {
                            const formattedMensaje = formatSatiSentenceCase(ticket.mensaje);
                            return (
                              <p className="truncate text-zinc-700 text-xs sm:text-sm font-sans" title={formattedMensaje}>
                                {formattedMensaje || <span className="text-zinc-400 italic">Sin observaciones</span>}
                              </p>
                            );
                          })()}
                        </td>

                        {/* Llegada a Depósito / Confirmación en Sucursal */}
                        {viewScope !== "CLIENTES_CDE" && (
                          <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                            {isTicketClienteCde(ticket) ? (
                              <span
                                className="text-zinc-300 font-mono"
                                title="Llegada Depósito solo aplica a Clientes ASU y Danesa SA"
                              >
                                —
                              </span>
                            ) : (() => {
                              const isRecibido = isTicketRecibido(ticket);
                              const fechaMostrar = ticket.fechaRecibidoDeposito || ticket.fechaEntregada || "";
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckin(ticket)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-extrabold transition-all border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer ${
                                      isRecibido
                                        ? "bg-[#2A9D8F] text-white hover:bg-[#238276]"
                                        : "bg-[#FFD23F] text-black hover:bg-yellow-400"
                                    }`}
                                    title={
                                      isRecibido
                                        ? "Recibido · Listo para que retire el cliente (Click para desmarcar llegada)"
                                        : "Haga click para confirmar llegada de esta unidad a depósito"
                                    }
                                  >
                                    {isRecibido ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Listo retiro</span>
                                      </>
                                    ) : (
                                      <>
                                        <Box className="w-3.5 h-3.5" />
                                        <span>Confirmar</span>
                                      </>
                                    )}
                                  </button>
                                  {isRecibido && fechaMostrar && (
                                    <span
                                      className="text-xs font-mono font-bold text-black bg-[#FFD23F] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] block"
                                      title={`Fecha de entrega / despacho para seguimiento: ${fechaMostrar}`}
                                    >
                                      {fechaMostrar}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        )}

                        {/* Acción / Ver Detalle e Imprimir Comprobante */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenTicketModal(ticket)}
                              className="p-2 rounded-lg bg-[#FFFDF9] hover:bg-[#FFD23F] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
                              title="Ver detalles completos de la orden SATI"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                setAutoPrintTicket(e.shiftKey);
                                setShowPrintModal(ticket);
                              }}
                              className="p-2 rounded-lg bg-[#FFFDF9] hover:bg-[#FFD23F] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
                              title="Imprimir Comprobante SATI con código de barras CODE128 (Shift+Clic para imprimir directo)"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación */}
          <div className="p-4 border-t-2 border-black bg-[#FAF6EE] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-mono text-black font-semibold">
              Mostrando{" "}
              <strong className="text-black font-bold">
                {filteredTickets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}
              </strong>{" "}
              a{" "}
              <strong className="text-black font-bold">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}
              </strong>{" "}
              de <strong className="text-black font-bold">{filteredTickets.length.toLocaleString()}</strong> órdenes
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                « Primera
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3.5 py-1.5 text-xs font-mono font-extrabold bg-[#FFD23F] text-black border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg">
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
                className="px-2.5 py-1.5 text-xs font-heading font-extrabold rounded-lg border-2 border-black bg-[#FFFDF9] text-black hover:bg-[#FFD23F] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                Última »
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Modal de Detalle y Edición de Orden SATI */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-xl max-w-xl w-full p-4 sm:p-6 shadow-[6px_6px_0px_#000] space-y-4 border-2 border-black max-h-[92dvh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div>
                <span className="text-[11px] font-mono text-neutral-600 uppercase tracking-wider font-bold">
                  DETALLE DE ORDEN SATI · MONITOREO SUCURSAL
                </span>
                <h3 className="text-lg font-heading font-extrabold text-black">
                  {selectedTicket.origen === "CDE" || parseInt(selectedTicket.idOrden, 10) >= 125000
                    ? `Orden CDE #${selectedTicket.idOrdenCde || selectedTicket.idOrden}`
                    : `Orden ASU #${selectedTicket.idOrdenAsu || selectedTicket.idOrden}`
                  } · {selectedTicket.marca} {selectedTicket.modelo}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingModal ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-heading font-extrabold bg-[#FFD23F] hover:bg-yellow-400 text-black transition-all cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5"
                    title="Editar fechas y números de orden"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-black" />
                    <span>Editar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-heading font-extrabold bg-[#FAF6EE] hover:bg-neutral-200 text-black transition-all cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  >
                    Ver Detalle
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="w-8 h-8 rounded-lg bg-[#FAF6EE] hover:bg-[#E76F51] hover:text-white text-black font-extrabold flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Formulario de Edición Manual */}
            {isEditingModal ? (
              <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-3 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                  <span className="text-xs font-heading font-extrabold text-black flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-black" />
                    <span>Edición Manual de Fechas y Números de Orden SATI</span>
                  </span>
                  <span className="text-[10px] text-neutral-600 font-mono font-bold">
                    Guardado directo en MySQL
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-heading font-bold text-black mb-1">
                      Nº Orden ASU:
                    </label>
                    <input
                      type="text"
                      value={editForm.idOrdenAsu}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, idOrdenAsu: e.target.value }))}
                      placeholder="Ej: 29409"
                      className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-mono font-bold focus:outline-none shadow-[1px_1px_0px_#000] text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold text-black mb-1">
                      Nº Orden CDE (Casa Matriz):
                    </label>
                    <input
                      type="text"
                      value={editForm.idOrdenCde}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, idOrdenCde: e.target.value }))}
                      placeholder="Ej: 125683 (dejar vacío si está pendiente)"
                      className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-mono font-bold focus:outline-none shadow-[1px_1px_0px_#000] text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold text-black mb-1">
                      Fecha de Ingreso ASU:
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaIngresoAsu}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaIngresoAsu: e.target.value }))}
                      placeholder="DD/MM/AAAA o DD/MM/AAAA HH:mm"
                      className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-mono font-bold focus:outline-none shadow-[1px_1px_0px_#000] text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold text-black mb-1">
                      Fecha de Ingreso CDE:
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaIngresoCde}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaIngresoCde: e.target.value }))}
                      placeholder="DD/MM/AAAA o DD/MM/AAAA HH:mm"
                      className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-mono font-bold focus:outline-none shadow-[1px_1px_0px_#000] text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold text-black mb-1">
                      Fecha de Despacho CDE (Transportadora):
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaDespachoCde}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaDespachoCde: e.target.value }))}
                      placeholder="DD/MM/AAAA HH:mm (vacío si sigue en taller CDE)"
                      className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-mono font-bold focus:outline-none shadow-[1px_1px_0px_#000] text-black"
                    />
                  </div>

                  {!isTicketClienteCde(selectedTicket) && (
                    <div>
                      <label className="block text-[11px] font-heading font-bold text-black mb-1">
                        Fecha de Recibido en ASU (Sucursal):
                      </label>
                      <input
                        type="text"
                        value={editForm.fechaRecibidoAsu}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, fechaRecibidoAsu: e.target.value }))}
                        placeholder="DD/MM/AAAA o DD/MM/AAAA HH:mm"
                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-mono font-bold focus:outline-none shadow-[1px_1px_0px_#000] text-black"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(false)}
                    className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black text-xs font-heading font-extrabold cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTicketEdits}
                    disabled={isSavingEdits}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2A9D8F] hover:bg-emerald-600 text-white text-xs font-heading font-extrabold border-2 border-black transition-all shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{isSavingEdits ? "Guardando en MySQL..." : "Guardar Cambios"}</span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-4 text-xs">
              {/* Cruce Inteligente de Órdenes */}
              {(selectedTicket.idOrdenAsu || selectedTicket.idOrdenCde) && (
                <div className="p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-2 shadow-[2px_2px_0px_#000]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-black flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-black shrink-0" />
                      CRUCE DE DATOS SATI: ASU ↔ CDE
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]">
                      Match: {selectedTicket.matchReason || "Serial Físico"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-[#FFFDF9] p-2.5 rounded-lg border-2 border-black shadow-[1px_1px_0px_#000]">
                    <div>
                      <span className="text-neutral-600 text-[10px] block uppercase font-mono font-bold">Orden ASU:</span>
                      <strong className="text-black font-mono truncate block">
                        {selectedTicket.idOrdenAsu || (selectedTicket.origen === "ASU" || parseInt(selectedTicket.idOrden, 10) < 125000 ? selectedTicket.idOrden : null)
                          ? `#${selectedTicket.idOrdenAsu || selectedTicket.idOrden}`
                          : "Pendiente"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-600 text-[10px] block uppercase font-mono font-bold">Orden CDE:</span>
                      <strong className="text-black font-mono truncate block font-extrabold">
                        {selectedTicket.idOrdenCde && parseInt(selectedTicket.idOrdenCde, 10) >= 125000
                          ? `#${selectedTicket.idOrdenCde}`
                          : selectedTicket.origen === "CDE" && parseInt(selectedTicket.idOrden, 10) >= 125000
                          ? `#${selectedTicket.idOrden}`
                          : "Pendiente"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-600 text-[10px] block uppercase font-mono font-bold">Estado en ASU:</span>
                      <span className="font-mono font-bold text-black">{selectedTicket.estadoAsu || selectedTicket.estado}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cuadrícula de Datos Principales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAF6EE] p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Cliente</span>
                  <strong className="text-black font-heading text-sm">{selectedTicket.cliente}</strong>
                  {selectedTicket.esDanesa && (
                    <span className="text-[10px] font-bold text-black bg-[#FFD23F] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] mt-1 inline-block">
                      Envío de Nuestra Sucursal
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Código de Producto</span>
                  <strong className="text-black font-mono text-sm">{selectedTicket.codigoProducto || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Fecha de Ingreso ASU</span>
                  <span className="text-black font-mono font-semibold">
                    {selectedTicket.fechaIngresoAsu || (selectedTicket.origen === "ASU" ? selectedTicket.fechaIngreso : "-") || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Fecha de Ingreso CDE</span>
                  <span className="text-black font-mono font-semibold">
                    {selectedTicket.fechaIngresoCde || (selectedTicket.origen === "CDE" ? selectedTicket.fechaIngreso : "") || "Pendiente CDE"}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Fecha de Despacho CDE</span>
                  <span className="text-black font-mono font-semibold">
                    {selectedTicket.fechaEntregada || "Pendiente de cierre en CDE"}
                  </span>
                </div>
                {!isTicketClienteCde(selectedTicket) && (
                  <div>
                    <span className="text-neutral-600 block text-[11px] font-bold">Fecha de Recibido ASU</span>
                    {(() => {
                      const esRecib = isTicketRecibido(selectedTicket);
                      const fechaRec =
                        selectedTicket.fechaRecibidoDeposito ||
                        (esRecib ? selectedTicket.fechaEntregada : null);
                      if (fechaRec) {
                        return (
                          <span className="text-[#2A9D8F] font-mono font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
                            <span>{fechaRec}</span>
                          </span>
                        );
                      }
                      return (
                        <span className="text-neutral-500 font-mono text-[11px] italic">
                          Pendiente de recepción
                        </span>
                      );
                    })()}
                  </div>
                )}
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Fecha de Venta</span>
                  <span className="text-black font-mono">{selectedTicket.fechaVenta || "No registrada"}</span>
                </div>
                <div>
                  <span className="text-neutral-600 block text-[11px] font-bold">Días en Taller</span>
                  <span className="text-black font-mono font-bold">
                    {selectedTicket.diasResolucion !== null && selectedTicket.diasResolucion !== undefined
                      ? `${selectedTicket.diasResolucion} días`
                      : "En proceso"}
                  </span>
                </div>
              </div>

              {/* Hardware */}
              <div className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-1 shadow-[2px_2px_0px_#000]">
                <span className="text-neutral-600 block text-[11px] font-bold">Hardware &amp; Identificación</span>
                <div className="font-heading font-extrabold text-sm text-black">
                  {selectedTicket.marca} {selectedTicket.modelo}
                </div>
                <div className="text-[11px] text-black font-mono flex items-center justify-between">
                  <span>Categoría: <strong>{selectedTicket.tipoComponente}</strong></span>
                  <span>Serial: <strong>{selectedTicket.serial || "SIN SERIAL"}</strong></span>
                </div>
              </div>

              {/* Dictamen / Informe Técnico */}
              <div>
                <span className="text-black font-heading font-extrabold text-[11px] uppercase tracking-wider block mb-1">
                  Dictamen Técnico &amp; Mensaje de Servicio
                </span>
                <div className="p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl text-black text-xs font-sans leading-relaxed whitespace-pre-wrap shadow-[2px_2px_0px_#000]">
                  {formatSatiSentenceCase(selectedTicket.mensaje) || "Sin observaciones técnicas cargadas."}
                </div>
              </div>

              {/* Botón y Estado Directo de Recepción en Sucursal (solo Clientes ASU y Danesa SA) */}
              {!isTicketClienteCde(selectedTicket) && (() => {
                const isRecibidoModal = isTicketRecibido(selectedTicket);
                const fechaModalMostrar = selectedTicket.fechaEntregada || selectedTicket.fechaRecibidoDeposito || "";
                return (
                  <div
                    className={`p-3.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3 ${
                      isRecibidoModal
                        ? "bg-[#2A9D8F]/20"
                        : "bg-[#FFD23F]/25"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isRecibidoModal ? (
                        <CheckCircle2 className="w-5 h-5 text-[#2A9D8F] shrink-0" />
                      ) : (
                        <SpeedTruck className="w-5 h-5 text-black shrink-0" smokeColor="bg-amber-400" />
                      )}
                      <div>
                        <strong className="block text-black text-xs font-heading font-extrabold">
                          {isRecibidoModal
                            ? "Equipo Físico Recibido en Sucursal ASU"
                            : "Pendiente de Recepción Física en Sucursal"}
                        </strong>
                        <span className="text-[11px] text-neutral-800 block font-medium">
                          {isRecibidoModal
                            ? `Confirmado en sucursal${
                                fechaModalMostrar
                                  ? ` (Fecha de entrega / despacho: ${fechaModalMostrar})`
                                  : ""
                              }. Listo para entrega o taller.`
                            : "Haga clic en el botón para registrar la llegada física del equipo a la sucursal."}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleCheckin(selectedTicket)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-heading font-extrabold transition-all border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isRecibidoModal
                          ? "bg-[#2A9D8F] text-white hover:bg-emerald-600"
                          : "bg-black text-[#FFD23F] hover:bg-neutral-800"
                      }`}
                    >
                      {isRecibidoModal ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Recibido (Click para desmarcar)</span>
                        </>
                      ) : (
                        <>
                          <Box className="w-3.5 h-3.5" />
                          <span>Marcar como Recibido</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isEditingModal && (
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(true)}
                    className="px-3 py-1.5 bg-[#FFD23F] hover:bg-yellow-400 text-black rounded-lg text-xs font-heading font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-black" />
                    <span>Editar Fechas y Órdenes</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPrintModal(selectedTicket)}
                  className="px-3.5 py-1.5 bg-[#FFD23F] hover:bg-yellow-400 text-black rounded-lg text-xs font-heading font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  title="Imprimir Comprobante térmico con código de barras CODE128"
                >
                  <Printer className="w-3.5 h-3.5 text-black" />
                  <span>Imprimir Comprobante</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-[#FFFDF9] hover:bg-neutral-200 text-black rounded-lg text-xs font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vinculación SATI Rápida (ASU ↔ CDE) */}
      {linkingTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] rounded-xl max-w-md w-full p-6 shadow-[6px_6px_0px_#000] border-2 border-black space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FFD23F] border border-black flex items-center justify-center text-black shadow-[1px_1px_0px_#000]">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-black">
                    Vincular Cruce SATI (ASU ↔ CDE)
                  </h3>
                  <p className="text-[11px] text-neutral-700 font-mono font-bold">
                    Sincronización bidireccional en MySQL
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingTicket(null)}
                className="p-1 rounded-lg hover:bg-neutral-200 text-neutral-600 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ficha de la Orden Actual */}
            <div className="p-3 bg-[#FAF6EE] rounded-lg border-2 border-black text-xs space-y-1.5 shadow-[2px_2px_0px_#000]">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-black font-mono text-sm">
                  Orden #{linkingTicket.idOrden} ({linkingTicket.origen || "ASU"})
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFD23F] text-black font-mono font-bold uppercase border border-black truncate max-w-[140px]">
                  {linkingTicket.cliente}
                </span>
              </div>
              <p className="text-black font-medium truncate">
                Equipo: <strong className="text-black">{linkingTicket.marca} {linkingTicket.modelo}</strong>
              </p>
              <div className="flex items-center justify-between text-[11px] text-neutral-700 font-mono font-semibold">
                <span>Serial: {linkingTicket.serial || "SIN SERIAL"}</span>
                <span>Ingreso: {linkingTicket.fechaIngreso || "-"}</span>
              </div>
            </div>

            {/* Input para la orden complementaria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-heading font-bold text-black">
                {linkingTicket.origen === "ASU" || linkingTicket.esDanesa || parseInt(linkingTicket.idOrden, 10) < 100000
                  ? "Ingrese el N° de Orden CDE (#100000+):"
                  : "Ingrese el N° de Orden ASU (#20000+):"}
              </label>
              <input
                type="text"
                autoFocus
                value={linkOrderIdInput}
                onChange={(e) => setLinkOrderIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && linkOrderIdInput.trim()) {
                    handleLinkCrossMatch(linkingTicket, linkOrderIdInput);
                  }
                }}
                placeholder={
                  linkingTicket.origen === "ASU" || linkingTicket.esDanesa || parseInt(linkingTicket.idOrden, 10) < 100000
                    ? "Ej: 125662"
                    : "Ej: 29405"
                }
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#FAF6EE] border-2 border-black focus:bg-white rounded-lg shadow-[2px_2px_0px_#000] outline-none"
              />
            </div>

            {/* Sugerencias detectadas inteligentemente */}
            {linkSuggestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-indigo-900 block">
                  💡 Sugerencias inteligentes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {linkSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLinkOrderIdInput(s.ticket.idOrden)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                    >
                      <span className="font-bold">#{s.ticket.idOrden}</span>
                      <span className="text-[10px] text-indigo-600 truncate max-w-[150px]">
                        {s.ticket.modelo} ({s.reason})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
              {hasCrossMatch(linkingTicket) ? (
                <button
                  type="button"
                  onClick={() => handleUnlinkCrossMatch(linkingTicket)}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Desvincular</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLinkingTicket(null)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmittingLink || !linkOrderIdInput.trim()}
                  onClick={() => handleLinkCrossMatch(linkingTicket, linkOrderIdInput)}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isSubmittingLink ? "Guardando..." : "Confirmar Cruce"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impresión de Comprobante SATI Térmico Calibrable */}
      {showPrintModal && (
        <SatiThermalPrintModal
          autoPrint={autoPrintTicket}
          data={{
            idOrden: showPrintModal.idOrdenAsu || showPrintModal.idOrden,
            codigoProducto: showPrintModal.codigoProducto,
            cliente: showPrintModal.clienteAsu || showPrintModal.cliente,
            equipo: `${showPrintModal.marca || ""} ${showPrintModal.modelo || ""}`.trim(),
            serial: showPrintModal.serial,
            estado: showPrintModal.estadoAsu || showPrintModal.estado,
            informeTecnico: formatSatiSentenceCase(showPrintModal.mensaje),
            subtitulo: "COMPROBANTE DEL SERVICIO POST - VENTA NISSEI",
            fechaIngreso: showPrintModal.fechaIngresoAsu || showPrintModal.fechaIngreso,
            fechaRecepcionReparacion: showPrintModal.fechaRecibidoDeposito || (showPrintModal.recibidoEnDeposito ? showPrintModal.fechaEntregada : undefined),
            recibidoListoRetiro: Boolean(showPrintModal.recibidoEnDeposito),
          }}
          onClose={() => {
            setShowPrintModal(null);
            setAutoPrintTicket(false);
          }}
        />
      )}

      </main>
    </AuthGuard>
  );
}
