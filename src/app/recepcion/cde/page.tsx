"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { HeaderActions } from "@/components/common/HeaderActions";
import { AuthBadge } from "@/components/common/AuthBadge";
import {
  Truck,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  Wrench,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Box,
  Building2,
  Calendar,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import {
  RecepcionCdeTicket,
  INITIAL_RECEPCION_CDE_DATA,
  getStoredCdeTickets,
  saveCdeTickets,
  toggleCheckinDeposito,
  parseRecepcionCdeCSV,
  calcularDiasResolucion,
  isTicketDanesa,
} from "@/data/recepcionCdeData";
import { getActiveUser } from "@/data/authData";

const ITEMS_PER_PAGE = 25;

export default function RecepcionCdeDashboardPage() {
  const [tickets, setTickets] = useState<RecepcionCdeTicket[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Filtros
  const [viewScope, setViewScope] = useState<"DANESA" | "TODOS">("DANESA");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [componentFilter, setComponentFilter] = useState("TODOS");
  const [transitFilter, setTransitFilter] = useState<"TODOS" | "EN_TRANSITO" | "RECIBIDOS">("TODOS");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de Detalle
  const [selectedTicket, setSelectedTicket] = useState<RecepcionCdeTicket | null>(null);

  // Modal de Importación de CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
    const loaded = getStoredCdeTickets();
    setTickets(loaded);
  }, []);

  // Recalcular métricas de rendimiento Casa Matriz CDE vs Danesa
  const metrics = useMemo(() => {
    const totalCde = tickets.length;
    const danesaTickets = tickets.filter((t) => t.esDanesa);
    const cdeDirectosTickets = tickets.filter((t) => !t.esDanesa);

    // Días de resolución promedio
    const danesaCerrados = danesaTickets.filter(
      (t) => t.diasResolucion !== null && t.diasResolucion !== undefined && t.diasResolucion >= 0
    );
    const avgDiasDanesa =
      danesaCerrados.length > 0
        ? danesaCerrados.reduce((acc, t) => acc + (t.diasResolucion || 0), 0) / danesaCerrados.length
        : 0;

    const totalCerrados = tickets.filter(
      (t) => t.diasResolucion !== null && t.diasResolucion !== undefined && t.diasResolucion >= 0
    );
    const avgDiasCdeTotal =
      totalCerrados.length > 0
        ? totalCerrados.reduce((acc, t) => acc + (t.diasResolucion || 0), 0) / totalCerrados.length
        : 0;

    // Equipos en tránsito por transportadora (cerrados por CDE para Danesa)
    const danesaEntregados = danesaTickets.filter((t) => t.estado.toLowerCase().includes("entregada"));
    const danesaRecibidos = danesaTickets.filter((t) => t.recibidoEnDeposito);
    const danesaEnTransito = danesaTickets.filter(
      (t) => t.estado.toLowerCase().includes("entregada") && !t.recibidoEnDeposito
    );

    // Equipos aún en laboratorio CDE de Danesa
    const danesaEnLaboratorio = danesaTickets.filter(
      (t) => !t.estado.toLowerCase().includes("entregada")
    );

    // Dictámenes: reparados vs sin reparo para Danesa
    const reparadosDanesa = danesaTickets.filter(
      (t) =>
        t.estado === "Reparada" ||
        t.mensaje.toLowerCase().includes("cambio") ||
        t.mensaje.toLowerCase().includes("ok") ||
        t.mensaje.toLowerCase().includes("reparacion") ||
        t.mensaje.toLowerCase().includes("reemplazo")
    ).length;

    const sinReparoDanesa = danesaTickets.filter(
      (t) =>
        t.estado.toLowerCase().includes("sin reparo") ||
        t.mensaje.toLowerCase().includes("sin reparo") ||
        t.mensaje.toLowerCase().includes("sem reparo")
    ).length;

    return {
      totalCde,
      totalDanesa: danesaTickets.length,
      totalCdeDirectos: cdeDirectosTickets.length,
      avgDiasDanesa: avgDiasDanesa.toFixed(1),
      avgDiasCdeTotal: avgDiasCdeTotal.toFixed(1),
      danesaEntregados: danesaEntregados.length,
      danesaRecibidos: danesaRecibidos.length,
      danesaEnTransito: danesaEnTransito.length,
      danesaEnLaboratorio: danesaEnLaboratorio.length,
      reparadosDanesa,
      sinReparoDanesa,
    };
  }, [tickets]);

  // Lista única de componentes para filtro
  const componentOptions = useMemo<CleanSelectOption[]>(() => {
    const setComp = new Set<string>();
    tickets.forEach((t) => {
      if (t.tipoComponente) setComp.add(t.tipoComponente);
    });
    const sorted = Array.from(setComp).sort();
    return [
      { value: "TODOS", label: "Todas las categorías", count: tickets.length },
      ...sorted.map((c) => ({
        value: c,
        label: c,
        count: tickets.filter((t) => t.tipoComponente === c).length,
      })),
    ];
  }, [tickets]);

  // Lista única de estados
  const statusOptions = useMemo<CleanSelectOption[]>(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t) => {
      counts[t.estado] = (counts[t.estado] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort();
    return [
      { value: "TODOS", label: "Todos los estados", count: tickets.length },
      ...sorted.map((st) => ({
        value: st,
        label: st,
        count: counts[st],
      })),
    ];
  }, [tickets]);

  // Filtrado de tickets
  const filteredTickets = useMemo(() => {
    let result = tickets;

    // 1. Ámbito: Danesa vs Todos
    if (viewScope === "DANESA") {
      result = result.filter((t) => t.esDanesa);
    }

    // 2. Filtro de Estado
    if (statusFilter !== "TODOS") {
      result = result.filter((t) => t.estado === statusFilter);
    }

    // 3. Filtro de Categoría de Componente
    if (componentFilter !== "TODOS") {
      result = result.filter((t) => t.tipoComponente === componentFilter);
    }

    // 4. Filtro de Tránsito / Recibidos en Depósito
    if (transitFilter === "EN_TRANSITO") {
      result = result.filter((t) => t.estado.toLowerCase().includes("entregada") && !t.recibidoEnDeposito);
    } else if (transitFilter === "RECIBIDOS") {
      result = result.filter((t) => t.recibidoEnDeposito);
    }

    // 5. Búsqueda por texto libre
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.idOrden.toLowerCase().includes(q) ||
          t.codigoProducto.toLowerCase().includes(q) ||
          t.cliente.toLowerCase().includes(q) ||
          t.modelo.toLowerCase().includes(q) ||
          t.marca.toLowerCase().includes(q) ||
          t.serial.toLowerCase().includes(q) ||
          t.mensaje.toLowerCase().includes(q)
      );
    }

    return result;
  }, [tickets, viewScope, statusFilter, componentFilter, transitFilter, searchTerm]);

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  const handleToggleCheckin = (idOrden: string) => {
    const updatedState = toggleCheckinDeposito(idOrden);
    setTickets((prev) =>
      prev.map((t) => (t.idOrden === idOrden ? { ...t, recibidoEnDeposito: updatedState } : t))
    );
    if (selectedTicket && selectedTicket.idOrden === idOrden) {
      setSelectedTicket((prev) => (prev ? { ...prev, recibidoEnDeposito: updatedState } : null));
    }
  };

  const handleImportCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        const parsed = parseRecepcionCdeCSV(content);
        if (parsed.length === 0) {
          setImportNotice("El archivo no contenía registros válidos en las 12 columnas requeridas.");
          return;
        }

        saveCdeTickets(parsed);
        setTickets(parsed);
        setCurrentPage(1);
        setImportNotice(`¡Importación exitosa! Se cargaron ${parsed.length.toLocaleString()} órdenes de Casa Matriz CDE.`);
        setTimeout(() => {
          setShowImportModal(false);
          setImportNotice(null);
        }, 1500);
      } catch (err) {
        console.error("Error al parsear CSV CDE:", err);
        setImportNotice("Ocurrió un error al procesar el archivo CSV.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleExportCSV = () => {
    const headers = [
      "idOrden",
      "CodigoProducto",
      "Cliente",
      "Mensaje",
      "FechaIngreso",
      "FechaEntregada",
      "FechaVenta",
      "Estado",
      "TipoComponente",
      "Modelo",
      "Marca",
      "Serial",
      "DiasEnTaller",
      "RecibidoEnDeposito",
    ];

    const rows = filteredTickets.map((t) => [
      t.idOrden,
      t.codigoProducto,
      `"${t.cliente.replace(/"/g, '""')}"`,
      `"${(t.mensaje || "").replace(/"/g, '""')}"`,
      t.fechaIngreso,
      t.fechaEntregada || "",
      t.fechaVenta || "",
      t.estado,
      t.tipoComponente,
      `"${t.modelo.replace(/"/g, '""')}"`,
      t.marca,
      t.serial,
      t.diasResolucion ?? "",
      t.recibidoEnDeposito ? "SI" : "NO",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `rendimiento_cde_deposito_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (estado: string) => {
    const est = estado.toLowerCase();
    if (est.includes("entregada")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Truck className="w-3 h-3 text-emerald-600" />
          <span>{estado}</span>
        </span>
      );
    }
    if (est.includes("reparada")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
          <CheckCircle2 className="w-3 h-3 text-sky-600" />
          <span>{estado}</span>
        </span>
      );
    }
    if (est.includes("sin reparo")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>{estado}</span>
        </span>
      );
    }
    if (est.includes("qc")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          <ShieldCheck className="w-3 h-3 text-purple-600" />
          <span>{estado}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>{estado}</span>
      </span>
    );
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#fbf9f9] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
          <span>Cargando datos de Rendimiento CDE & Depósito Danesa...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#121212] flex flex-col font-sans">
      {/* Barra Superior / Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e5e5e5] px-4 sm:px-6 2xl:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 text-white shadow-sm flex items-center justify-center">
            <Truck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <Link href="/recepcion" className="hover:text-zinc-900 transition-colors">
                Recepción Post-Venta
              </Link>
              <span>/</span>
              <span className="text-zinc-900 font-semibold">Depósito Danesa & CDE</span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Monitoreo de Transportadora & Rendimiento Casa Matriz CDE</span>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                SATI CDE
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 hover:border-zinc-900 rounded-lg text-xs font-semibold text-zinc-800 transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-600" />
            <span>Importar recepcion-cde.csv</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 hover:border-zinc-900 rounded-lg text-xs font-semibold text-zinc-800 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>

          <Link
            href="/recepcion"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>Volver a Recepción</span>
          </Link>

          <AuthBadge />
          <HeaderActions />
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 2xl:p-8 space-y-6">

        {/* Tarjetas KPI de Rendimiento */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Card 1: Equipos Danesa SA */}
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Envíos Danesa SA
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-zinc-900">
                {metrics.totalDanesa.toLocaleString()}
              </strong>
              <span className="text-[11px] font-semibold text-zinc-500">
                de {metrics.totalCde.toLocaleString()} tot.
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Equipos de nuestra sucursal atendidos en CDE
            </p>
          </div>

          {/* Card 2: En Tránsito por Transportadora */}
          <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-600" />
              <span>En Transportadora</span>
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
              Cerrados por CDE pendientes de confirmar en caja
            </p>
          </div>

          {/* Card 3: Cajas Recibidas en Depósito */}
          <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-emerald-600" />
              <span>Recibidos en Depósito</span>
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
              Cajas físicas ya recibidas al día siguiente
            </p>
          </div>

          {/* Card 4: Días de Retorno Danesa */}
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Tiempo Prom. Retorno
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-zinc-900">
                {metrics.avgDiasDanesa} <span className="text-sm font-normal text-zinc-500">días</span>
              </strong>
              <span className="text-[11px] font-mono text-zinc-400">
                CDE: {metrics.avgDiasCdeTotal}d
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Lapso entre FechaIngreso y FechaEntregada
            </p>
          </div>

          {/* Card 5: Activos en Laboratorio CDE */}
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              En Laboratorio CDE
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-zinc-900">
                {metrics.danesaEnLaboratorio}
              </strong>
              <span className="text-[11px] font-semibold text-zinc-500">
                En proceso
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Equipos de Danesa en diagnóstico o reparación
            </p>
          </div>

          {/* Card 6: Efectividad / Reparados vs Sin Reparo */}
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Resolución Danesa
            </span>
            <div className="flex items-baseline justify-between">
              <strong className="text-2xl font-black text-emerald-600">
                {metrics.reparadosDanesa}
              </strong>
              <span className="text-[11px] font-semibold text-rose-600">
                {metrics.sinReparoDanesa} Sin Rep.
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              Reparados / Nuevos vs Sin Reparo / RMA
            </p>
          </div>
        </section>

        {/* Barra de Filtros, Selector de Ámbito y Búsqueda */}
        <section className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            
            {/* Selector de Ámbito: Danesa vs Todos */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setViewScope("DANESA");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  viewScope === "DANESA"
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Solo Danesa SA (Nuestra Sucursal / Depósito)</span>
                <span className="px-1.5 py-0.2 bg-white/20 text-white rounded text-[10px] font-mono font-normal">
                  {metrics.totalDanesa}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewScope("TODOS");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  viewScope === "TODOS"
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Todos los Clientes (Casa Matriz CDE)</span>
                <span className="px-1.5 py-0.2 bg-zinc-200 text-zinc-700 rounded text-[10px] font-mono font-normal">
                  {metrics.totalCde}
                </span>
              </button>
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
                placeholder="Buscar por ID Orden, Serial, Modelo, Cliente o Mensaje..."
                className="w-full pl-9 pr-8 py-2 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white border border-zinc-200 focus:border-zinc-900 rounded-xl text-xs outline-none transition-all placeholder:text-zinc-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtros Secundarios */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100">
            {/* Filtro de Tránsito / Caja */}
            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTransitFilter("TODOS");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
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
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  transitFilter === "EN_TRANSITO"
                    ? "bg-amber-500 text-white font-bold shadow-xs"
                    : "text-amber-700 hover:bg-amber-100/60"
                }`}
              >
                <Truck className="w-3 h-3" />
                <span>En camino ({metrics.danesaEnTransito})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransitFilter("RECIBIDOS");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  transitFilter === "RECIBIDOS"
                    ? "bg-emerald-600 text-white font-bold shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-100/60"
                }`}
              >
                <Check className="w-3 h-3" />
                <span>Recibidos en caja ({metrics.danesaRecibidos})</span>
              </button>
            </div>

            {/* Filtro de Estado */}
            <CleanSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              className="w-56"
            />

            {/* Filtro de Componente */}
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
            {(statusFilter !== "TODOS" || componentFilter !== "TODOS" || transitFilter !== "TODOS" || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("TODOS");
                  setComponentFilter("TODOS");
                  setTransitFilter("TODOS");
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

        {/* Tabla de Órdenes SATI Casa Matriz CDE */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Órdenes SATI CDE · Rendimiento & Retornos de Laboratorio ({filteredTickets.length.toLocaleString()})
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
                  <th className="py-3 px-3">Ingreso CDE</th>
                  <th className="py-3 px-3">Despacho CDE</th>
                  <th className="py-3 px-3 text-center">Días Taller</th>
                  <th className="py-3 px-3">Estado CDE</th>
                  <th className="py-3 px-3">Dictamen / Informe Técnico</th>
                  <th className="py-3 px-3 text-center">Llegada Depósito</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500">
                      <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="font-semibold text-sm text-zinc-700">No se encontraron órdenes con los filtros actuales.</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Pruebe modificando los términos de búsqueda o el selector de ámbito.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => {
                    const isDanesa = ticket.esDanesa;
                    const isDelivered = ticket.estado.toLowerCase().includes("entregada");
                    const days = ticket.diasResolucion;

                    return (
                      <tr
                        key={ticket.idOrden}
                        className={`hover:bg-zinc-50/80 transition-colors ${
                          ticket.recibidoEnDeposito ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        {/* Nº Orden */}
                        <td className="py-3 px-3.5 font-mono font-bold text-zinc-900 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                            #{ticket.idOrden}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-3 max-w-[170px] truncate">
                          {isDanesa ? (
                            <span className="inline-flex items-center gap-1 font-bold text-zinc-900 bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                              <Building2 className="w-3 h-3 text-amber-700" />
                              <span>{ticket.cliente}</span>
                            </span>
                          ) : (
                            <span className="font-medium text-zinc-700">{ticket.cliente}</span>
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

                        {/* Fecha Ingreso CDE */}
                        <td className="py-3 px-3 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                          {ticket.fechaIngreso}
                        </td>

                        {/* Despacho CDE */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                          {ticket.fechaEntregada ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900">{ticket.fechaEntregada}</span>
                              {isDanesa && (
                                <span className="text-[10px] text-amber-700 font-sans flex items-center gap-0.5">
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
                          {days !== null && days !== undefined && days >= 0 ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                                days <= 7
                                  ? "bg-emerald-100 text-emerald-800"
                                  : days <= 20
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                              title={`Tiempo total en taller CDE: ${days} días`}
                            >
                              {days} d
                            </span>
                          ) : (
                            <span className="text-zinc-300 font-mono">-</span>
                          )}
                        </td>

                        {/* Estado CDE */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(ticket.estado)}
                        </td>

                        {/* Dictamen / Informe Técnico */}
                        <td className="py-3 px-3 max-w-[280px]">
                          <p className="truncate text-zinc-700 text-[11px] font-sans" title={ticket.mensaje}>
                            {ticket.mensaje || <span className="text-zinc-400 italic">Sin observaciones</span>}
                          </p>
                        </td>

                        {/* Llegada a Depósito Danesa (Checkbox de confirmación física) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isDanesa ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCheckin(ticket.idOrden)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                                ticket.recibidoEnDeposito
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : isDelivered
                                  ? "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                                  : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                              }`}
                              title={
                                ticket.recibidoEnDeposito
                                  ? "Caja física recibida y confirmada en depósito"
                                  : isDelivered
                                  ? "Haga click para confirmar llegada de la caja en transportadora"
                                  : "Aún en laboratorio CDE"
                              }
                            >
                              {ticket.recibidoEnDeposito ? (
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
                          ) : (
                            <span className="text-zinc-300 font-mono text-[10px]">Cliente CDE</span>
                          )}
                        </td>

                        {/* Acción / Ver Detalle */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(ticket)}
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
              de <strong className="text-zinc-900">{filteredTickets.length.toLocaleString()}</strong> órdenes CDE
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

      {/* Modal de Detalle de Orden SATI CDE */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  DETALLE DE ORDEN SATI · CASA MATRIZ CDE
                </span>
                <h3 className="text-lg font-black text-zinc-900">
                  Orden #{selectedTicket.idOrden} · {selectedTicket.marca} {selectedTicket.modelo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Cuadrícula de Datos Principales */}
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
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
                  <span className="text-zinc-500 block text-[11px]">Fecha de Ingreso a CDE</span>
                  <span className="text-zinc-800 font-mono font-semibold">{selectedTicket.fechaIngreso}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Despacho CDE (Transportadora)</span>
                  <span className="text-zinc-800 font-mono font-semibold">
                    {selectedTicket.fechaEntregada || "Pendiente de cierre en CDE"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Fecha de Venta</span>
                  <span className="text-zinc-800 font-mono">{selectedTicket.fechaVenta || "No registrada"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Días en Taller CDE</span>
                  <span className="text-zinc-900 font-mono font-bold">
                    {selectedTicket.diasResolucion !== null ? `${selectedTicket.diasResolucion} días` : "En proceso"}
                  </span>
                </div>
              </div>

              {/* Hardware */}
              <div className="p-3 bg-white border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 block text-[11px]">Hardware & Identificación</span>
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
                  Dictamen Técnico & Mensaje de Servicio de CDE
                </span>
                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 text-xs font-sans leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.mensaje || "Sin observaciones técnicas cargadas en CDE."}
                </div>
              </div>

              {/* Estado de Llegada a Depósito */}
              {selectedTicket.esDanesa && (
                <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-5 h-5 text-amber-600" />
                    <div>
                      <strong className="block text-zinc-900 text-xs">
                        {selectedTicket.recibidoEnDeposito
                          ? "Caja Física Recibida en Depósito Danesa"
                          : "En Tránsito por Transportadora hacia Depósito"}
                      </strong>
                      <span className="text-[11px] text-zinc-600 block">
                        {selectedTicket.recibidoEnDeposito
                          ? "El equipo ya se encuentra físicamente en nuestra sucursal listo para post-venta."
                          : "Cerrado por CDE. Llegada física estimada en las cajas del día siguiente."}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCheckin(selectedTicket.idOrden)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                      selectedTicket.recibidoEnDeposito
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-zinc-900 text-white hover:bg-black"
                    }`}
                  >
                    {selectedTicket.recibidoEnDeposito ? "✓ Recibido en Caja" : "Confirmar Recepción"}
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carga de Archivo CSV recepcion-cde.csv */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-zinc-900">
                  Importar recepcion-cde.csv
                </h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
              <p>
                Suba el archivo exportado de SATI Casa Matriz CDE. El sistema validará automáticamente las 12 columnas:
              </p>
              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg font-mono text-[10px] text-zinc-700">
                idOrden, CodigoProducto, Cliente, Mensaje, FechaIngreso, FechaEntregada, FechaVenta, Estado, TipoComponente, Modelo, Marca, Serial
              </div>

              {/* Botón selector de archivo */}
              <div className="pt-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  onChange={handleImportCSVFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-zinc-300 hover:border-zinc-900 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer bg-zinc-50 hover:bg-zinc-100/60"
                >
                  <Upload className="w-6 h-6 text-zinc-600" />
                  <span className="font-bold text-zinc-900 text-xs">Haga click para seleccionar recepcion-cde.csv</span>
                  <span className="text-[11px] text-zinc-400">Archivo CSV separado por comas o tabuladores</span>
                </button>
              </div>

              {importNotice && (
                <div className="p-3 bg-zinc-900 text-white rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{importNotice}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
