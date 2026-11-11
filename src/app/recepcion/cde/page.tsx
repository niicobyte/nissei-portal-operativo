"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";
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
} from "lucide-react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import {
  RecepcionCdeTicket,
  INITIAL_RECEPCION_CDE_DATA,
  getStoredCdeTickets,
  getStoredCdeCheckins,
  saveCdeTickets,
  toggleCheckinDeposito,
  procesarActualizacionCdeCSV,
  sincronizarCdeCsvOnline,
  ResultadoCargaCdeCSV,
  isFechaValida,
  isDespachoCoherente,
  fetchCdeTicketsFromMySQL,
  parseFechaDMY,
  calcularDiasResolucion,
  saveSatiTicketOverride,
  getStoredSatiOverrides,
} from "@/data/recepcionCdeData";
import { getStoredTickets, fetchTicketsFromMySQL } from "@/data/recepcionData";
import {
  crossMatchCdeWithAsu,
  buildUnifiedSatiList,
  getTicketRowKey,
} from "@/lib/crossMatch";

const ITEMS_PER_PAGE = 25;

export type ViewScope = "DANESA" | "CLIENTES_ASU" | "CLIENTES_CDE" | "TODOS";
export type RecibidosDateFilter = "TODAS" | "HOY" | "AYER" | "ULTIMOS_7" | "ESTE_MES";

export function matchesRecibidosDate(ticket: RecepcionCdeTicket, filter: RecibidosDateFilter): boolean {
  if (filter === "TODAS") return true;

  // Filtrar primordialmente con la fecha de entregada (despacho/entrega) para seguimiento de días
  const dateStr = ticket.fechaEntregada || ticket.fechaRecibidoDeposito || ticket.fechaIngreso;
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
 * Determina si una orden está confirmada / en estado recibido en Llegada a Depósito:
 * 1. Si el usuario la desmarcó manualmente, devuelve false.
 * 2. Si t.recibidoEnDeposito es true.
 * 3. Si su estado es "Entregada" o "Reparada" (mandatorio por regla de negocio).
 */
export function isTicketRecibido(t: RecepcionCdeTicket): boolean {
  if ((t as any).desmarcadoManual) return false;
  if (t.recibidoEnDeposito) return true;
  const displayStatus = getTicketDisplayStatus(t).toLowerCase();
  if (displayStatus.includes("entregada") || displayStatus.includes("reparada")) {
    return true;
  }
  const estAsu = (t.estadoAsu || "").toLowerCase();
  const est = (t.estado || "").toLowerCase();
  return (
    estAsu.includes("entregada") ||
    estAsu.includes("reparada") ||
    est.includes("entregada") ||
    est.includes("reparada")
  );
}

/**
 * Determina el estado exacto unificado que se muestra en pantalla.
 * Permite que los filtros, los contadores de badges y las etiquetas en tabla
 * coincidan al 100% sin que estados como "Entregada" se cuelen en otros filtros.
 */
export function getTicketDisplayStatus(t: RecepcionCdeTicket): string {
  const est = (t.estado || "").trim();
  const estLower = est.toLowerCase();
  const estAsu = (t.estadoAsu || "").toLowerCase();

  // 1. Si en ASU ya fue entregada al cliente final, o en CDE figura Entregada
  if (estAsu.includes("entregada") || (!t.esDanesa && estLower.includes("entregada"))) {
    return "Entregada";
  }

  // Validación de despacho legítimo y coherente
  const tieneDespachoValido =
    isFechaValida(t.fechaEntregada) && isDespachoCoherente(t.fechaIngreso, t.fechaEntregada);

  // 2. Si ya fue confirmada o resuelta como Reparada
  const esReparada = estAsu.includes("reparada") || estLower.includes("reparada");
  const tieneDetalleReparacion = Boolean(
    (t.mensaje || "").toLowerCase().includes("repar") ||
    (t.mensaje || "").toLowerCase().includes("cambio") ||
    (t.mensaje || "").toLowerCase().includes("ok") ||
    (t.mensaje || "").toLowerCase().includes("pieza") ||
    (t.mensaje || "").toLowerCase().includes("funcional")
  );

  if (
    esReparada ||
    (tieneDespachoValido &&
      tieneDetalleReparacion &&
      !estLower.includes("sin reparo") &&
      !estAsu.includes("sin reparo"))
  ) {
    return "Reparada";
  }

  // 3. En Tránsito (Transportadora) para Danesa SA si CDE despachó pero en ASU aún no se entregó
  if (t.esDanesa && tieneDespachoValido) {
    return "En Tránsito (Transportadora)";
  }

  if (estLower.includes("sin reparo")) {
    return t.estado || "Sin Reparo";
  }

  if (estLower.includes("qc") || estLower.includes("control de calidad")) {
    return "Control de Calidad (QC)";
  }

  // Si no, el estado real que corresponda
  return t.estadoAsu || t.estado || "En Asignacion";
}

export default function RecepcionCdeDashboardPage() {
  const [tickets, setTickets] = useState<RecepcionCdeTicket[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Filtros de Ámbito
  const [viewScope, setViewScope] = useState<ViewScope>("DANESA");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [componentFilter, setComponentFilter] = useState("TODOS");
  const [transitFilter, setTransitFilter] = useState<"TODOS" | "EN_TRANSITO" | "RECIBIDOS">("TODOS");
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

  // Subida y procesamiento de CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [csvReport, setCsvReport] = useState<
    (ResultadoCargaCdeCSV & { fileName: string; timestamp: string }) | null
  >(null);

  useEffect(() => {
    setIsClient(true);
    const asuTickets = getStoredTickets();
    const cdeTickets = getStoredCdeTickets();
    const checkins = getStoredCdeCheckins();
    const overrides = getStoredSatiOverrides();
    const initialUnified = buildUnifiedSatiList(cdeTickets, asuTickets, checkins, overrides);
    setTickets(initialUnified);

    // Sincronizar en tiempo real directamente con MySQL en la nube (Railway)
    Promise.all([
      fetchCdeTicketsFromMySQL().catch(() => cdeTickets),
      fetchTicketsFromMySQL().catch(() => asuTickets),
    ]).then(([dbCde, dbAsu]) => {
      if (Array.isArray(dbCde) && Array.isArray(dbAsu)) {
        const liveCheckins = getStoredCdeCheckins();
        const liveOverrides = getStoredSatiOverrides();
        const liveUnified = buildUnifiedSatiList(dbCde, dbAsu, liveCheckins, liveOverrides);
        setTickets(liveUnified);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

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
      const freshUnified = buildUnifiedSatiList(dbCde, dbAsu, liveCheckins, liveOverrides);
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

  // Manejar carga de archivo CSV para actualizar órdenes CDE y sincronizar a MySQL
  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    try {
      const text = await file.text();
      // Sincronización obligatoria directa a MySQL en Railway (procesa solo CDE >= 100000)
      const resultado = await sincronizarCdeCsvOnline(text);
      const asuTickets = await fetchTicketsFromMySQL().catch(() => getStoredTickets());
      const checkins = getStoredCdeCheckins();
      const unified = buildUnifiedSatiList(resultado.updatedTickets, asuTickets, checkins);
      setTickets(unified);

      const nowStr = new Date().toLocaleTimeString("es-PY", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setCsvReport({
        ...resultado,
        fileName: file.name,
        timestamp: nowStr,
      });

      const totalModificadas = resultado.totalActualizadas + resultado.totalNuevas;
      if (totalModificadas > 0) {
        showToast(
          `CSV SATI CDE procesado: ${resultado.totalActualizadas} orden(es) actualizaron su estado${
            resultado.totalNuevas > 0 ? ` y ${resultado.totalNuevas} nueva(s)` : ""
          } (${resultado.totalEnTransitoNuevos} pasaron a En Tránsito por transportadora).`
        );
      } else {
        showToast(
          `CSV verificado (${resultado.totalFilasLeidas.toLocaleString()} órdenes): No se detectaron cambios de estado.`
        );
      }
    } catch (err: unknown) {
      console.error("Error al procesar el archivo CSV CDE:", err);
      const msg = err instanceof Error ? err.message : "Error al procesar el archivo CSV.";
      showToast(`${msg} Asegúrese de que sea un archivo de texto .csv con formato SATI.`);
    } finally {
      setIsUploadingCSV(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Recalcular métricas de rendimiento según el ámbito seleccionado
  const metrics = useMemo(() => {
    const totalUniversal = tickets.length;
    const danesaTickets = tickets.filter((t) => t.esDanesa);
    const clientesAsuTickets = tickets.filter(
      (t) => !t.esDanesa && (t.origen === "ASU" || parseInt(t.idOrden, 10) < 125000)
    );
    const clientesCdeTickets = tickets.filter(
      (t) => !t.esDanesa && (t.origen === "CDE" || parseInt(t.idOrden, 10) >= 125000)
    );

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
      const est = (t.estado || "").toLowerCase();
      const estAsu = (t.estadoAsu || "").toLowerCase();
      return t.recibidoEnDeposito || estAsu.includes("entregada") || est.includes("entregada");
    };

    // Tránsito por transportadora (aplica primordialmente a envíos de Danesa SA)
    // Solo cuando CDE ya despachó y en ASU aún NO está recibida, ni entregada, ni reparada
    const danesaRecibidos = danesaTickets.filter((t) => isTicketRecibido(t));
    const danesaEnTransito = danesaTickets.filter((t) => {
      const estAsu = (t.estadoAsu || "").toLowerCase();
      const est = (t.estado || "").toLowerCase();
      const yaEntregadaEnAsu = estAsu.includes("entregada");
      const esReparada = estAsu.includes("reparada") || est.includes("reparada");
      const tieneDetalleRep = Boolean(
        (t.mensaje || "").toLowerCase().includes("repar") ||
        (t.mensaje || "").toLowerCase().includes("cambio") ||
        (t.mensaje || "").toLowerCase().includes("ok") ||
        (t.mensaje || "").toLowerCase().includes("pieza") ||
        (t.mensaje || "").toLowerCase().includes("funcional")
      );
      const resueltaReparada = esReparada || (tieneDetalleRep && !est.includes("sin reparo") && !estAsu.includes("sin reparo"));

      const tieneDespachoValido =
        isFechaValida(t.fechaEntregada) && isDespachoCoherente(t.fechaIngreso, t.fechaEntregada);

      return (
        !isTicketRecibido(t) &&
        !yaEntregadaEnAsu &&
        !resueltaReparada &&
        tieneDespachoValido
      );
    });

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
    if (viewScope === "DANESA") {
      return tickets.filter((t) => t.esDanesa);
    }
    if (viewScope === "CLIENTES_ASU") {
      return tickets.filter(
        (t) => !t.esDanesa && (t.origen === "ASU" || parseInt(t.idOrden, 10) < 125000)
      );
    }
    if (viewScope === "CLIENTES_CDE") {
      return tickets.filter(
        (t) => !t.esDanesa && (t.origen === "CDE" || parseInt(t.idOrden, 10) >= 125000)
      );
    }
    return tickets;
  }, [tickets, viewScope]);

  // Lista única de componentes para filtro según el ámbito
  const componentOptions = useMemo<CleanSelectOption[]>(() => {
    const setComp = new Set<string>();
    scopeTickets.forEach((t) => {
      if (t.tipoComponente) setComp.add(t.tipoComponente);
    });
    const sorted = Array.from(setComp).sort();
    return [
      { value: "TODOS", label: "Todas las categorías", count: scopeTickets.length },
      ...sorted.map((c) => ({
        value: c,
        label: c,
        count: scopeTickets.filter((t) => t.tipoComponente === c).length,
      })),
    ];
  }, [scopeTickets]);

  // Lista única de estados según el ámbito activo
  // Cuando es clientes (ASU o CDE), se excluyen estados internos de Danesa SA como "Enviado..." o "Liquidación"
  const statusOptions = useMemo<CleanSelectOption[]>(() => {
    const counts: Record<string, number> = {};
    const isClientes = viewScope === "CLIENTES_ASU" || viewScope === "CLIENTES_CDE";

    scopeTickets.forEach((t) => {
      const st = getTicketDisplayStatus(t);
      const lower = st.toLowerCase();

      // Si es ámbito de clientes, quitar estados exclusivos de Danesa SA
      if (isClientes) {
        if (
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

    // 3. Filtro de Categoría de Componente
    if (componentFilter !== "TODOS") {
      result = result.filter((t) => t.tipoComponente === componentFilter);
    }

    // 4. Filtro de Tránsito / Recibidos en Depósito
    if (transitFilter === "EN_TRANSITO") {
      result = result.filter(
        (t) => !isTicketRecibido(t) && getTicketDisplayStatus(t).includes("Tránsito")
      );
    } else if (transitFilter === "RECIBIDOS") {
      result = result.filter((t) => isTicketRecibido(t));
      if (recibidosDateFilter !== "TODAS") {
        result = result.filter((t) => matchesRecibidosDate(t, recibidosDateFilter));
      }
    }

    // 5. Búsqueda por texto libre
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (t) =>
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
      );
    }

    return result;
  }, [scopeTickets, statusFilter, componentFilter, transitFilter, recibidosDateFilter, searchTerm]);

  // Conteo dinámico según el ámbito para las pestañas de tránsito y recepción
  const scopeEnTransito = useMemo(() => {
    return scopeTickets.filter(
      (t) => !isTicketRecibido(t) && getTicketDisplayStatus(t).includes("Tránsito")
    ).length;
  }, [scopeTickets]);

  const scopeRecibidosList = useMemo(() => {
    return scopeTickets.filter((t) => isTicketRecibido(t));
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
    showToast(res.recibido ? "Orden confirmada como recibida en sucursal." : "Recepción desmarcada.");
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

  const getStatusBadge = (ticket: RecepcionCdeTicket) => {
    const displayStatus = getTicketDisplayStatus(ticket);
    const lower = displayStatus.toLowerCase();

    if (lower === "entregada") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
          <span>Entregada</span>
        </span>
      );
    }

    if (lower === "reparada") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
          <CheckCircle2 className="w-3 h-3 text-sky-600" />
          <span>Reparada</span>
        </span>
      );
    }

    if (lower.includes("tránsito") || lower.includes("transito")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
          <Truck className="w-3 h-3 text-amber-700" />
          <span>En Tránsito (Transportadora)</span>
        </span>
      );
    }

    if (lower.includes("sin reparo")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>{displayStatus}</span>
        </span>
      );
    }

    if (lower.includes("qc") || lower.includes("control de calidad")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          <ShieldCheck className="w-3 h-3 text-purple-600" />
          <span>Control de Calidad (QC)</span>
        </span>
      );
    }

    // Estado real de la orden de ASU (ej. "En Asignación", "En Diagnóstico", "En Recepción", etc.)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
        <Clock className="w-3 h-3 text-zinc-500" />
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
      <main className="min-h-screen bg-[#fbf9f9] text-[#121212] py-6 sm:py-8 2xl:py-12 px-3 sm:px-6 lg:px-8 2xl:px-16 font-sans">
      <div className="max-w-7xl 2xl:max-w-[1700px] 3xl:max-w-[2200px] mx-auto space-y-6 2xl:space-y-8">

        {/* Notificación Toast Flotante */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border border-zinc-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Cabecera limpia y simple, idéntica a Recepción */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              SATI ASU - CDE
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
              Monitoreo de envíos por transportadora, tiempos de retorno de laboratorio SATI y confirmación de recepción en sucursal.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Input oculto para carga de CSV */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVFileChange}
              className="hidden"
            />

            {/* Botón Sincronizar Nube / MySQL Online */}
            <button
              type="button"
              onClick={handleSyncAllToCloud}
              disabled={isSyncingCloud}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              title="Sincronizar y consolidar todos los estados recibidos y cambios en MySQL en la nube"
            >
              <span
                className={`w-6 h-6 rounded flex items-center justify-center text-white ${
                  isSyncingCloud ? "bg-amber-600" : "bg-indigo-600"
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? "animate-spin" : ""}`} />
              </span>
              <div className="text-left leading-tight">
                <strong className="block text-xs font-bold text-zinc-900">
                  {isSyncingCloud ? "Sincronizando..." : "Sincronizar Nube"}
                </strong>
                <span className="text-[11px] text-zinc-500 font-normal">
                  {isSyncingCloud ? "Guardando en MySQL" : "Guardar en MySQL"}
                </span>
              </div>
            </button>

            {/* Botón idéntico al de Recepción con icono verde y dos líneas de texto */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCSV}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer"
              title="Subir archivo CSV para actualizar órdenes de CDE automáticamente"
            >
              <span className="w-6 h-6 rounded bg-emerald-700 text-white flex items-center justify-center">
                <Upload className="w-3.5 h-3.5" />
              </span>
              <div className="text-left leading-tight">
                <strong className="block text-xs font-bold text-zinc-900">
                  {isUploadingCSV ? "Subiendo a MySQL..." : "Subir CSV · Estados"}
                </strong>
                <span className="text-[11px] text-zinc-500 font-normal">
                  {isUploadingCSV ? "Sincronizando online" : "Actualizar órdenes SATI"}
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
                        ? `¡Actualización completada! Se detectaron ${csvReport.cambios.length} cambio(s) en el CSV de Casa Matriz CDE`
                        : "Archivo CSV verificado: No se detectaron cambios de estado"}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-zinc-200 text-zinc-600">
                      {csvReport.fileName} · {csvReport.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
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
                className="self-end sm:self-center px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-600 flex items-center gap-1 cursor-pointer"
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
                <span className="text-[11px] text-zinc-500 block">En Tránsito (Transportadora)</span>
                <strong className="text-lg font-extrabold text-amber-700 font-mono flex items-center gap-1">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>{csvReport.totalEnTransitoNuevos.toLocaleString()}</span>
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Órdenes sin cambios</span>
                <strong className="text-lg font-extrabold text-zinc-600 font-mono">
                  {csvReport.totalSinCambios.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Tabla detallada de las órdenes que cambiaron de estado */}
            {csvReport.cambios.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-3.5 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800">
                    Detalle de órdenes con cambios ({csvReport.cambios.length})
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
                      className="px-3.5 py-2 text-xs flex items-center justify-between hover:bg-zinc-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          #{c.idOrden}
                        </span>
                        <div>
                          <strong className="text-zinc-900">{c.cliente}</strong>
                          {c.esDanesa && (
                            <span className="ml-1.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1 rounded">
                              Danesa SA
                            </span>
                          )}
                          <span className="text-zinc-500 font-mono block text-[11px]">
                            {c.equipo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-100 text-zinc-600 line-through">
                          {c.estadoAnterior}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        {c.enTransito ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Truck className="w-3 h-3 text-amber-700" />
                            <span>En Tránsito (Transportadora)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {c.estadoNuevo}
                          </span>
                        )}
                        {c.fechaEntregada && (
                          <span className="text-[10px] font-mono text-zinc-400">
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

        {/* Tarjetas KPI de Rendimiento (según el ámbito seleccionado) */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              {viewScope === "DANESA"
                ? "Envíos Danesa SA"
                : viewScope === "CLIENTES_ASU"
                ? "Clientes ASU"
                : viewScope === "CLIENTES_CDE"
                ? "Clientes CDE"
                : "Total Registros"}
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-zinc-900">
                {metrics.totalScope.toLocaleString()}
              </strong>
              <span className="text-[11px] font-semibold text-zinc-500">
                de {metrics.totalUniversal.toLocaleString()} tot.
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Órdenes del ámbito registradas en el portal
            </p>
          </div>

          {viewScope === "DANESA" ? (
            <>
              <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
                <span className="text-[11px] font-mono font-bold text-amber-800 uppercase tracking-wider block">
                  En Transportadora
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-black text-amber-700">
                    {metrics.danesaEnTransito}
                  </strong>
                  <span className="text-[11px] font-semibold text-amber-800">
                    En camino
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-tight">
                  Despachadas por CDE, pendientes de entrega final en ASU
                </p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
                <span className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                  Recibidos en Depósito
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-black text-emerald-700">
                    {metrics.danesaRecibidos}
                  </strong>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Verificados
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900/80 leading-tight">
                  Cajas físicas recibidas en ASU
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
                <span className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                  Entregadas
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-black text-emerald-700">
                    {metrics.scopeEntregadas}
                  </strong>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Cerradas
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900/80 leading-tight">
                  Órdenes cerradas y entregadas
                </p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
                <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                  Envíos Danesa SA
                </span>
                <div className="flex items-baseline justify-between">
                  <strong className="text-2xl font-black text-zinc-900">
                    {metrics.totalDanesa}
                  </strong>
                  <span className="text-[11px] font-semibold text-zinc-500">
                    Nuestra sucursal
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-tight">
                  Para comparar contra los clientes
                </p>
              </div>
            </>
          )}

          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Tiempo Prom. Retorno
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-zinc-900">
                {metrics.avgDiasScope} <span className="text-sm font-normal text-zinc-500">días</span>
              </strong>
              <span className="text-[11px] font-semibold text-zinc-500">
                Total: {metrics.avgDiasTotal}d
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Lapso entre ingreso y fecha de entrega
            </p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              En Laboratorio
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-zinc-900">
                {metrics.scopeEnLaboratorio}
              </strong>
              <span className="text-[11px] font-semibold text-zinc-500">
                En proceso
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Equipos aún en diagnóstico o reparación
            </p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Resolución
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-emerald-600">{metrics.reparados}</strong>
              <span className="text-[11px] font-semibold text-rose-600">{metrics.sinReparo} Sin Rep.</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">Reparados / Nuevos vs Sin Reparo / RMA</p>
          </div>
        </section>

        {/* Barra de Filtros, Selector de Ámbito Reestructurado y Búsqueda */}
        <section className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">

            {/* Selector de Ámbito con las 4 pestañas solicitadas */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200 flex-wrap">
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
                    setComponentFilter("TODOS");
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

            {/* Buscador de Órdenes */}
            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por ID Orden (ASU o CDE), Serial, Modelo, Cliente..."
                className="w-full pl-9 pr-8 py-2 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white border border-zinc-200 focus:border-zinc-900 rounded-xl text-xs outline-none transition-all placeholder:text-zinc-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtros Secundarios con CleanSelect */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100">
            {/* Filtro de Tránsito / Recibidos (visible para Danesa, Clientes ASU y Todos; no para Clientes CDE) */}
            {viewScope !== "CLIENTES_CDE" && (
              <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-xs">
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
                  <Truck className="w-3 h-3" />
                  <span>En camino ({scopeEnTransito})</span>
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
            )}

            {/* Filtro de Fecha de Recepción (Hoy / Ayer / etc.) cuando se selecciona Recibidos */}
            {transitFilter === "RECIBIDOS" && viewScope !== "CLIENTES_CDE" && (
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
              className="w-56"
            />

            {/* Filtro de Componente con CleanSelect */}
            <CleanSelect
              options={componentOptions}
              value={componentFilter}
              onChange={(val) => {
                setComponentFilter(val);
                setCurrentPage(1);
              }}
              className="w-56"
            />

            {/* Resetear Filtros */}
            {(statusFilter !== "TODOS" || componentFilter !== "TODOS" || transitFilter !== "TODOS" || recibidosDateFilter !== "TODAS" || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("TODOS");
                  setComponentFilter("TODOS");
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
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 font-mono uppercase text-[11px] border-b border-zinc-200">
                <tr>
                  <th className="py-3 px-3.5 font-bold">Nº Orden</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Equipo / Hardware</th>
                  <th className="py-3 px-3">Serial</th>
                  <th className="py-3 px-3">Ingreso ASU</th>
                  <th className="py-3 px-3">Ingreso CDE</th>
                  <th className="py-3 px-3">Despacho CDE</th>
                  <th className="py-3 px-3 text-center">Días Taller</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Dictamen / Informe Técnico</th>
                  <th className="py-3 px-3 text-center">Llegada Depósito</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-zinc-500">
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
                        <td className="py-3 px-3.5 font-mono font-bold text-zinc-900 whitespace-nowrap">
                          {isDanesa ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-zinc-900 text-white font-extrabold text-xs">
                                  #{idAsuPrincipal || ticket.idOrden}
                                </span>
                                <span className="text-[9px] font-sans font-bold text-zinc-500">ASU</span>
                              </div>
                              <div className="text-[10px] font-mono text-zinc-600 flex items-center gap-1">
                                <span className="text-zinc-400">CDE:</span>
                                {idCdeVinculado ? (
                                  <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200">
                                    #{idCdeVinculado}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 italic">Pendiente</span>
                                )}
                              </div>
                            </div>
                          ) : viewScope === "CLIENTES_CDE" || esOrdenCdeNativa ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                                  #{ticket.idOrden}
                                </span>
                                <span className="text-[9px] font-sans font-bold text-zinc-400">CDE</span>
                              </div>
                              {ticket.idOrdenAsu && (
                                <div
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                                  title={`Vinculado a Orden ASU #${ticket.idOrdenAsu}`}
                                >
                                  <Link2 className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                  <span>ASU: #{ticket.idOrdenAsu}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                                  #{ticket.idOrden}
                                </span>
                                <span className="text-[9px] font-sans font-bold text-zinc-400">ASU</span>
                              </div>
                              {esCdeValido(ticket.idOrdenCde) && ticket.idOrdenCde !== ticket.idOrden && (
                                <div
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                                  title={`Vinculado a Orden CDE #${ticket.idOrdenCde}`}
                                >
                                  <Link2 className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                  <span>CDE: #{ticket.idOrdenCde}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-3 max-w-[190px]">
                          {isDanesa ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-bold text-zinc-900 bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 text-xs">
                                <Building2 className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>{ticket.cliente}</span>
                              </span>
                              {ticket.clienteAsu && ticket.clienteAsu.toLowerCase() !== "danesa sa" && (
                                <span
                                  className="text-[11px] text-zinc-600 block truncate font-sans font-medium"
                                  title={`Cliente final registrado en ASU: ${ticket.clienteAsu}`}
                                >
                                  👤 {ticket.clienteAsu}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-medium text-zinc-800">{ticket.cliente}</span>
                          )}
                        </td>

                        {/* Equipo / Hardware */}
                        <td className="py-3 px-3 max-w-[240px]">
                          <strong className="block font-bold text-zinc-900 truncate">
                            {ticket.marca} {ticket.modelo}
                          </strong>
                          <span className="text-[11px] text-zinc-500 font-mono block">
                            {ticket.tipoComponente} · Cód: {ticket.codigoProducto || "N/A"}
                          </span>
                        </td>

                        {/* Serial */}
                        <td className="py-3 px-3 font-mono text-zinc-600 whitespace-nowrap max-w-[130px] truncate">
                          {ticket.serial || "SIN SERIAL"}
                        </td>

                        {/* Fecha de Ingreso ASU */}
                        <td className="py-3 px-3 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                          {isFechaValida(ticket.fechaIngresoAsu || (ticket.origen === "ASU" ? ticket.fechaIngreso : "")) ? (
                            ticket.fechaIngresoAsu || ticket.fechaIngreso
                          ) : (
                            <span className="text-zinc-400 italic">-</span>
                          )}
                        </td>

                        {/* Fecha de Ingreso CDE (Columna en medio de Ingreso ASU y Despacho CDE) */}
                        <td className="py-3 px-3 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                          {isFechaValida(ticket.fechaIngresoCde || (ticket.origen === "CDE" ? ticket.fechaIngreso : "")) ? (
                            <span className="font-semibold text-zinc-900">
                              {ticket.fechaIngresoCde || ticket.fechaIngreso}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Pendiente CDE</span>
                          )}
                        </td>

                        {/* Despacho CDE: solo la fecha limpia de despacho si es cronológicamente coherente */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                          {isFechaValida(ticket.fechaEntregada) && isDespachoCoherente(ticket.fechaIngreso, ticket.fechaEntregada) ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900">{ticket.fechaEntregada}</span>
                              {isDanesa && (
                                <span className="text-[10px] text-amber-700 font-sans flex items-center gap-0.5 font-semibold">
                                  <Truck className="w-2.5 h-2.5" />
                                  <span>Despacho transportadora</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">En taller CDE</span>
                          )}
                        </td>

                        {/* Días en Taller CDE */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isDespachoCoherente(ticket.fechaIngreso, ticket.fechaEntregada) && days !== null && days !== undefined && days >= 0 ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
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

                        {/* Estado: Entregada si ya cerró en ASU o Confirmada, En Tránsito solo si despachó y está en camino */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(ticket)}
                        </td>

                        {/* Dictamen / Informe Técnico */}
                        <td className="py-3 px-3 max-w-[280px]">
                          <p className="truncate text-zinc-700 text-[11px] font-sans" title={ticket.mensaje}>
                            {ticket.mensaje || <span className="text-zinc-400 italic">Sin observaciones</span>}
                          </p>
                        </td>

                        {/* Llegada a Depósito / Confirmación en Sucursal */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {viewScope !== "CLIENTES_CDE" ? (
                            (() => {
                              const isRecibido = isTicketRecibido(ticket);
                              const fechaMostrar = ticket.fechaEntregada || ticket.fechaRecibidoDeposito || "";
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckin(ticket)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                                      isRecibido
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                        : "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                                    }`}
                                    title={
                                      isRecibido
                                        ? "Equipo en estado Recibido (Click para desmarcar llegada)"
                                        : "Haga click para confirmar llegada de esta unidad a depósito"
                                    }
                                  >
                                    {isRecibido ? (
                                      <>
                                        <Check className="w-3 h-3 stroke-[3]" />
                                        <span>Recibido</span>
                                      </>
                                    ) : (
                                      <>
                                        <Box className="w-3 h-3" />
                                        <span>Confirmar</span>
                                      </>
                                    )}
                                  </button>
                                  {isRecibido && fechaMostrar && (
                                    <span
                                      className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 block"
                                      title={`Fecha de entrega / despacho para seguimiento: ${fechaMostrar}`}
                                    >
                                      {fechaMostrar}
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-zinc-400 font-mono text-[10px]">
                              Cliente CDE
                            </span>
                          )}
                        </td>

                        {/* Acción / Ver Detalle */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenTicketModal(ticket)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
                            title="Ver detalles completos de la orden SATI"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación */}
          <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-zinc-600">
              Mostrando{" "}
              <strong className="text-zinc-900">
                {filteredTickets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}
              </strong>{" "}
              a{" "}
              <strong className="text-zinc-900">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}
              </strong>{" "}
              de <strong className="text-zinc-900">{filteredTickets.length.toLocaleString()}</strong> órdenes
            </span>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                « Primera
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-mono font-bold bg-white border border-zinc-200 rounded-lg">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Última »
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Modal de Detalle y Edición de Orden SATI */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  DETALLE DE ORDEN SATI · MONITOREO SUCURSAL
                </span>
                <h3 className="text-lg font-black text-zinc-900">
                  Orden #{selectedTicket.idOrdenAsu || selectedTicket.idOrden} · {selectedTicket.marca} {selectedTicket.modelo}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingModal ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer border border-zinc-200 flex items-center gap-1.5"
                    title="Editar fechas y números de orden"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Editar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(false)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                  >
                    Ver Detalle
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Formulario de Edición Manual */}
            {isEditingModal ? (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-zinc-700" />
                    <span>Edición Manual de Fechas y Números de Orden SATI</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Guardado directo en MySQL
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Nº Orden ASU:
                    </label>
                    <input
                      type="text"
                      value={editForm.idOrdenAsu}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, idOrdenAsu: e.target.value }))}
                      placeholder="Ej: 29409"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono font-bold focus:border-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Nº Orden CDE (Casa Matriz):
                    </label>
                    <input
                      type="text"
                      value={editForm.idOrdenCde}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, idOrdenCde: e.target.value }))}
                      placeholder="Ej: 125683 (dejar vacío si está pendiente)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono font-bold focus:border-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Fecha de Ingreso ASU:
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaIngresoAsu}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaIngresoAsu: e.target.value }))}
                      placeholder="DD/MM/AAAA o DD/MM/AAAA HH:mm"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono focus:border-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Fecha de Ingreso CDE:
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaIngresoCde}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaIngresoCde: e.target.value }))}
                      placeholder="DD/MM/AAAA o DD/MM/AAAA HH:mm"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono focus:border-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Fecha de Despacho CDE (Transportadora):
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaDespachoCde}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaDespachoCde: e.target.value }))}
                      placeholder="DD/MM/AAAA HH:mm (vacío si sigue en taller CDE)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono focus:border-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Fecha de Recibido en ASU (Sucursal):
                    </label>
                    <input
                      type="text"
                      value={editForm.fechaRecibidoAsu}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fechaRecibidoAsu: e.target.value }))}
                      placeholder="DD/MM/AAAA o DD/MM/AAAA HH:mm"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono focus:border-zinc-900 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 text-xs font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTicketEdits}
                    disabled={isSavingEdits}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-900 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      CRUCE DE DATOS SATI: ASU ↔ CDE
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-200/60 text-indigo-800">
                      Match: {selectedTicket.matchReason || "Serial Físico"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-white p-2.5 rounded-lg border border-indigo-100">
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-mono">Orden ASU:</span>
                      <strong className="text-zinc-900 truncate block">
                        #{selectedTicket.idOrdenAsu || selectedTicket.idOrden}
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-mono">Orden CDE:</span>
                      <strong className="text-indigo-700 truncate block">
                        {selectedTicket.idOrdenCde && parseInt(selectedTicket.idOrdenCde, 10) >= 125000
                          ? `#${selectedTicket.idOrdenCde}`
                          : "Pendiente"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-mono">Estado en ASU:</span>
                      <span className="font-mono font-bold text-zinc-800">{selectedTicket.estadoAsu || selectedTicket.estado}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cuadrícula de Datos Principales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Cliente</span>
                  <strong className="text-zinc-900 text-sm">{selectedTicket.cliente}</strong>
                  {selectedTicket.esDanesa && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded mt-1 inline-block">
                      Envío de Nuestra Sucursal
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Código de Producto</span>
                  <strong className="text-zinc-900 font-mono text-sm">{selectedTicket.codigoProducto || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Ingreso ASU</span>
                  <span className="text-zinc-800 font-mono font-semibold">
                    {selectedTicket.fechaIngresoAsu || (selectedTicket.origen === "ASU" ? selectedTicket.fechaIngreso : "-") || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Ingreso CDE</span>
                  <span className="text-zinc-800 font-mono font-semibold">
                    {selectedTicket.fechaIngresoCde || (selectedTicket.origen === "CDE" ? selectedTicket.fechaIngreso : "") || "Pendiente CDE"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Despacho CDE</span>
                  <span className="text-zinc-800 font-mono font-semibold">
                    {selectedTicket.fechaEntregada || "Pendiente de cierre en CDE"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Recibido ASU</span>
                  {(() => {
                    const esRecib = isTicketRecibido(selectedTicket);
                    const fechaRec =
                      selectedTicket.fechaRecibidoDeposito ||
                      (esRecib ? selectedTicket.fechaEntregada : null);
                    if (fechaRec) {
                      return (
                        <span className="text-emerald-700 font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{fechaRec}</span>
                        </span>
                      );
                    }
                    return (
                      <span className="text-zinc-400 font-mono text-[11px] italic">
                        Pendiente de recepción
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Venta</span>
                  <span className="text-zinc-800 font-mono">{selectedTicket.fechaVenta || "No registrada"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Días en Taller</span>
                  <span className="text-zinc-900 font-mono font-bold">
                    {selectedTicket.diasResolucion !== null && selectedTicket.diasResolucion !== undefined
                      ? `${selectedTicket.diasResolucion} días`
                      : "En proceso"}
                  </span>
                </div>
              </div>

              {/* Hardware */}
              <div className="p-3 bg-white border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 block text-[11px]">Hardware &amp; Identificación</span>
                <div className="font-bold text-sm text-zinc-900">
                  {selectedTicket.marca} {selectedTicket.modelo}
                </div>
                <div className="text-[11px] text-zinc-600 font-mono flex items-center justify-between">
                  <span>Categoría: {selectedTicket.tipoComponente}</span>
                  <span>Serial: <strong>{selectedTicket.serial || "SIN SERIAL"}</strong></span>
                </div>
              </div>

              {/* Dictamen / Informe Técnico */}
              <div>
                <span className="text-zinc-500 font-bold text-[11px] uppercase tracking-wider block mb-1">
                  Dictamen Técnico &amp; Mensaje de Servicio
                </span>
                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 text-xs font-sans leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.mensaje || "Sin observaciones técnicas cargadas."}
                </div>
              </div>

              {/* Botón y Estado Directo de Recepción en Sucursal ("y un boton solo para recibido") */}
              {(() => {
                const isRecibidoModal = isTicketRecibido(selectedTicket);
                const fechaModalMostrar = selectedTicket.fechaEntregada || selectedTicket.fechaRecibidoDeposito || "";
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isRecibidoModal
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-amber-50/50 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isRecibidoModal ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Truck className="w-5 h-5 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <strong className="block text-zinc-900 text-xs font-bold">
                          {isRecibidoModal
                            ? "Equipo Físico Recibido en Sucursal ASU"
                            : "Pendiente de Recepción Física en Sucursal"}
                        </strong>
                        <span className="text-[11px] text-zinc-600 block">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isRecibidoModal
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-zinc-900 text-white hover:bg-black"
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

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              {!isEditingModal ? (
                <button
                  type="button"
                  onClick={() => setIsEditingModal(true)}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-zinc-200"
                >
                  <Edit3 className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Editar Fechas y Órdenes</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </AuthGuard>
  );
}
