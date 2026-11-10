"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { AuthBadge } from "@/components/common/AuthBadge";
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
  X,
  Check,
  Info,
  Link2,
} from "lucide-react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import {
  RecepcionCdeTicket,
  INITIAL_RECEPCION_CDE_DATA,
  getStoredCdeTickets,
  saveCdeTickets,
  toggleCheckinDeposito,
  procesarActualizacionCdeCSV,
  ResultadoCargaCdeCSV,
  isFechaValida,
  fetchCdeTicketsFromMySQL,
} from "@/data/recepcionCdeData";
import { getStoredTickets } from "@/data/recepcionData";
import { crossMatchCdeWithAsu } from "@/lib/crossMatch";

const ITEMS_PER_PAGE = 25;

export default function RecepcionCdeDashboardPage() {
  const [tickets, setTickets] = useState<RecepcionCdeTicket[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Filtros
  const [viewScope, setViewScope] = useState<"DANESA" | "CLIENTES" | "TODOS">("DANESA");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [componentFilter, setComponentFilter] = useState("TODOS");
  const [transitFilter, setTransitFilter] = useState<"TODOS" | "EN_TRANSITO" | "RECIBIDOS">("TODOS");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de Detalle
  const [selectedTicket, setSelectedTicket] = useState<RecepcionCdeTicket | null>(null);

  // Subida y procesamiento de CSV (idéntico a Recepción)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [csvReport, setCsvReport] = useState<
    (ResultadoCargaCdeCSV & { fileName: string; timestamp: string }) | null
  >(null);

  useEffect(() => {
    setIsClient(true);
    const asuTickets = getStoredTickets();
    const loaded = getStoredCdeTickets();
    const crossed = crossMatchCdeWithAsu(loaded, asuTickets);
    setTickets(crossed);

    // Sincronizar en tiempo real directamente con MySQL
    fetchCdeTicketsFromMySQL().then((dbData) => {
      if (Array.isArray(dbData) && dbData.length > 0) {
        const enrichedDb = crossMatchCdeWithAsu(dbData, asuTickets);
        setTickets(enrichedDb);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  // Manejar carga de archivo CSV para actualizar órdenes CDE y cruzar con ASU
  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    try {
      const text = await file.text();
      const resultado = procesarActualizacionCdeCSV(text, tickets);
      const asuTickets = getStoredTickets();
      const crossed = crossMatchCdeWithAsu(resultado.updatedTickets, asuTickets);
      setTickets(crossed);

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
          `CSV CDE procesado: ${resultado.totalActualizadas} orden(es) actualizaron su estado${
            resultado.totalNuevas > 0 ? ` y ${resultado.totalNuevas} nueva(s)` : ""
          } (${resultado.totalEnTransitoNuevos} pasaron a En Tránsito por transportadora).`
        );
      } else {
        showToast(
          `CSV verificado (${resultado.totalFilasLeidas.toLocaleString()} órdenes): No se detectaron cambios de estado.`
        );
      }
    } catch (err) {
      console.error("Error al procesar el archivo CSV CDE:", err);
      showToast("Error al procesar el archivo CSV. Verifique que sea el formato oficial de SATI.");
    } finally {
      setIsUploadingCSV(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Recalcular métricas de rendimiento según el ámbito seleccionado (Danesa SA / Clientes CDE / Todos)
  const metrics = useMemo(() => {
    const totalCde = tickets.length;
    const danesaTickets = tickets.filter((t) => t.esDanesa);
    const cdeDirectosTickets = tickets.filter((t) => !t.esDanesa);
    const scopeTickets =
      viewScope === "DANESA" ? danesaTickets : viewScope === "CLIENTES" ? cdeDirectosTickets : tickets;

    const conDias = (list: RecepcionCdeTicket[]) =>
      list.filter((t) => t.diasResolucion !== null && t.diasResolucion !== undefined && t.diasResolucion >= 0);
    const promedio = (list: RecepcionCdeTicket[]) => {
      const c = conDias(list);
      return c.length > 0 ? c.reduce((acc, t) => acc + (t.diasResolucion || 0), 0) / c.length : 0;
    };

    const esEntregada = (t: RecepcionCdeTicket) => t.estado.toLowerCase().includes("entregada");

    // Tránsito por transportadora: solo aplica a envíos de Danesa SA
    const danesaRecibidos = danesaTickets.filter((t) => t.recibidoEnDeposito);
    const danesaEnTransito = danesaTickets.filter((t) => esEntregada(t) && !t.recibidoEnDeposito);

    // Equipos del ámbito aún en laboratorio CDE / ya cerrados
    const scopeEnLaboratorio = scopeTickets.filter((t) => !esEntregada(t));
    const scopeEntregadas = scopeTickets.filter(esEntregada);

    // Dictámenes: reparados vs sin reparo del ámbito
    const reparados = scopeTickets.filter(
      (t) =>
        t.estado === "Reparada" ||
        t.mensaje.toLowerCase().includes("cambio") ||
        t.mensaje.toLowerCase().includes("ok") ||
        t.mensaje.toLowerCase().includes("reparacion") ||
        t.mensaje.toLowerCase().includes("reemplazo")
    ).length;

    const sinReparo = scopeTickets.filter(
      (t) =>
        t.estado.toLowerCase().includes("sin reparo") ||
        t.mensaje.toLowerCase().includes("sin reparo") ||
        t.mensaje.toLowerCase().includes("sem reparo")
    ).length;

    return {
      totalCde,
      totalDanesa: danesaTickets.length,
      totalCdeDirectos: cdeDirectosTickets.length,
      totalScope: scopeTickets.length,
      avgDiasScope: promedio(scopeTickets).toFixed(1),
      avgDiasCdeTotal: promedio(tickets).toFixed(1),
      danesaRecibidos: danesaRecibidos.length,
      danesaEnTransito: danesaEnTransito.length,
      scopeEnLaboratorio: scopeEnLaboratorio.length,
      scopeEntregadas: scopeEntregadas.length,
      reparados,
      sinReparo,
    };
  }, [tickets, viewScope]);

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
        label: st === "Entregada" ? "Entregada / En Tránsito" : st,
        count: counts[st],
      })),
    ];
  }, [tickets]);

  // Filtrado de tickets
  const filteredTickets = useMemo(() => {
    let result = tickets;

    // 1. Ámbito: Danesa SA / Clientes directos CDE / Todos
    if (viewScope === "DANESA") {
      result = result.filter((t) => t.esDanesa);
    } else if (viewScope === "CLIENTES") {
      result = result.filter((t) => !t.esDanesa);
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

    // 5. Búsqueda por texto libre (incluyendo Orden ASU y Cliente final)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.idOrden.toLowerCase().includes(q) ||
          (t.idOrdenAsu && t.idOrdenAsu.toLowerCase().includes(q)) ||
          (t.clienteAsu && t.clienteAsu.toLowerCase().includes(q)) ||
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

  const getStatusBadge = (ticket: RecepcionCdeTicket) => {
    const est = ticket.estado.toLowerCase();

    // Si dice Entregada en un envío de Danesa SA: CDE cerró la orden y la despachó por transportadora
    if (est.includes("entregada") && !ticket.esDanesa) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
          <span>Entregada al cliente</span>
        </span>
      );
    }
    if (est.includes("entregada")) {
      if (ticket.recibidoEnDeposito) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
            <span>Recibido en Depósito</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
          <Truck className="w-3 h-3 text-amber-700" />
          <span>En Tránsito (Transportadora)</span>
        </span>
      );
    }

    if (est.includes("reparada")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
          <CheckCircle2 className="w-3 h-3 text-sky-600" />
          <span>{ticket.estado}</span>
        </span>
      );
    }

    if (est.includes("sin reparo")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>{ticket.estado}</span>
        </span>
      );
    }

    if (est.includes("qc")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          <ShieldCheck className="w-3 h-3 text-purple-600" />
          <span>{ticket.estado}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
        <Clock className="w-3 h-3 text-zinc-600" />
        <span>{ticket.estado}</span>
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
            <Link
              href="/recepcion"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-700 hover:text-zinc-900 rounded-lg shadow-2xs transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Volver a Recepción</span>
            </Link>

            {/* Input oculto para carga de CSV */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVFileChange}
              className="hidden"
            />

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
                  {isUploadingCSV ? "Procesando CSV..." : "Subir CSV · Estados"}
                </strong>
                <span className="text-[11px] text-zinc-500 font-normal">
                  Actualizar órdenes SATI
                </span>
              </div>
            </button>

            {/* UN SOLO AuthBadge al extremo derecho */}
            <AuthBadge requiredModule="deposito.danesa" />
          </div>
        </div>

        {/* Panel de Notificación y Recuento de Actualización por CSV (idéntico a Recepción) */}
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
                        } y se integraron ${csvReport.totalNuevas} orden(es) nuevas.`
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
                {viewScope === "DANESA" ? "Envíos Danesa SA" : viewScope === "CLIENTES" ? "Clientes CDE" : "Todos CDE"}
              </span>
              <div className="flex items-baseline justify-between">
                <strong className="text-2xl font-black text-zinc-900">
                  {metrics.totalScope.toLocaleString()}
                </strong>
                <span className="text-[11px] font-semibold text-zinc-500">
                  de {metrics.totalCde.toLocaleString()} tot.
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Órdenes del ámbito registradas en CDE
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
                Entregadas por CDE, pendientes de confirmar en caja
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
                Órdenes cerradas y entregadas por CDE
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
                Para comparar contra los clientes de CDE
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
                  CDE: {metrics.avgDiasCdeTotal}d
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Lapso entre ingreso y fecha de entrega CDE
              </p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-1">
              <span className="text-[11px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                En Laboratorio CDE
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

        {/* Barra de Filtros, Selector de Ámbito y Búsqueda */}
        <section className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">

            {/* Selector de Ámbito: Danesa SA / Clientes CDE / Todos */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200 flex-wrap">
              {(
                [
                  { key: "DANESA", label: "Danesa SA (Nuestra Sucursal)", count: metrics.totalDanesa, icon: <Package className="w-3.5 h-3.5" /> },
                  { key: "CLIENTES", label: "Clientes CDE", count: metrics.totalCdeDirectos, icon: <Building2 className="w-3.5 h-3.5" /> },
                  { key: "TODOS", label: "Todos", count: metrics.totalCde, icon: <Layers className="w-3.5 h-3.5" /> },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setViewScope(s.key);
                    setTransitFilter("TODOS");
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
                placeholder="Buscar por ID Orden, Serial, Modelo, Cliente o Mensaje..."
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
            {/* Filtro de Tránsito / Caja */}
            {viewScope === "DANESA" && (
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
                <span>En camino ({metrics.danesaEnTransito})</span>
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
                <span>Recibidos en caja ({metrics.danesaRecibidos})</span>
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
                Órdenes SATI CDE · Rendimiento &amp; Retornos de Laboratorio ({filteredTickets.length.toLocaleString()})
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
                        {/* Nº Orden (CDE cruzado con ASU) */}
                        <td className="py-3 px-3.5 font-mono font-bold text-zinc-900 whitespace-nowrap">
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
                                title={`Vinculado a Orden ASU #${ticket.idOrdenAsu} (${ticket.matchReason || 'Match'})`}
                              >
                                <Link2 className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                <span>ASU: #{ticket.idOrdenAsu}</span>
                              </div>
                            )}
                          </div>
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

                        {/* Fecha de Ingreso (nuestra recepción ASU) */}
                        <td className="py-3 px-3 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                          {isFechaValida(ticket.fechaIngreso) ? ticket.fechaIngreso : "-"}
                        </td>

                        {/* Despacho CDE: solo se muestra la fecha */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                          {isFechaValida(ticket.fechaEntregada) ? (
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

                        {/* Estado CDE con indicación de En Tránsito si dice Entregada */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(ticket)}
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
                className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Cruce Inteligente con Orden de ASU */}
              {selectedTicket.idOrdenAsu && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-900 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      CRUCE DE DATOS: ORDEN ASU VINCULADA #{selectedTicket.idOrdenAsu}
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-200/60 text-indigo-800">
                      Match: {selectedTicket.matchReason || "Serial Físico"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-white p-2.5 rounded-lg border border-indigo-100">
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-mono">Cliente en ASU:</span>
                      <strong className="text-zinc-900 truncate block">{selectedTicket.clienteAsu || "Danesa SA"}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-mono">Ingreso en ASU:</span>
                      <span className="font-mono text-zinc-800">{selectedTicket.fechaIngresoAsu || "---"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[10px] block uppercase font-mono">Estado en ASU:</span>
                      <span className="font-mono font-bold text-zinc-800">{selectedTicket.estadoAsu || "---"}</span>
                    </div>
                  </div>
                </div>
              )}

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
                  <span className="text-zinc-500 block text-[11px]">Fecha de Ingreso ASU</span>
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
                  Dictamen Técnico &amp; Mensaje de Servicio de CDE
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
                          ? "Caja Física Recibida en Sucursal ASU"
                          : "En Tránsito por Transportadora hacia ASU"}
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
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
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
