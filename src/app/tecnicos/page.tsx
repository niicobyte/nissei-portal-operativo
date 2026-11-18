"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { HeaderActions } from "@/components/common/HeaderActions";
import { AuthGuard } from "@/components/common/AuthGuard";
import {
  Printer,
  Eye,
  RotateCcw,
  Cpu,
  Laptop,
  CheckCircle2,
  Search,
  Filter,
  ShoppingBag,
  UserCheck,
  Building2,
  Globe,
  Layers,
  ArrowRight,
  Plus,
  X,
  Send,
  AlertCircle,
  SlidersHorizontal,
  Info,
  Wrench,
} from "lucide-react";
import {
  getStoredMontajes,
  fetchMontajesFromMySQL,
  updateMontajeStage,
  updateMontajeTecnico,
  updateMontajeEstado,
  resetMontajes,
  LISTA_TECNICOS_MONTAJE,
  getStoredTecnicos,
  MONTAJES_WHATSAPP_GROUP_ID,
  formatMontajeWhatsAppMessage,
  OrdenMontajeReal
} from "@/data/montajesData";
import { getActiveUser } from "@/data/authData";
import { consumeCloudSyncWarning } from "@/lib/cloudSync";
import {
  saveWorkDraft,
  loadWorkDraft,
  useFlushDraftBeforeLogout,
} from "@/lib/workDrafts";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import {
  ThermalPrintSettings,
  ThermalPaperProfile,
  ThermalLengthMode,
  THERMAL_PROFILE_META,
  DEFAULT_THERMAL_PRINT_SETTINGS,
  getStoredThermalPrintSettings,
  saveThermalPrintSettings,
  resetThermalPrintSettings,
  getThermalEffectiveContentMm,
  buildThermalPrintCss,
} from "@/lib/thermalPrintConfig";

const STICKER_CAT_LABELS: Record<string, string> = {
  PROCESADOR: "CPU",
  PLACA_MADRE: "PLACA",
  RAM: "RAM",
  GPU: "GPU",
  ALMACENAMIENTO: "SSD/ALM",
  FUENTE: "FUENTE",
  GABINETE: "GABINETE",
  REFRIGERACION: "COOLER",
  NOTEBOOK: "NOTEBOOK",
  OTROS: "OTRO",
};

function formatCategoriaSticker(categoria?: string): string {
  if (!categoria) return "ITEM";
  return STICKER_CAT_LABELS[categoria] || categoria.replace(/_/g, " ");
}

function getRealObservaciones(observaciones?: string | null): string | null {
  const clean = (observaciones || "").trim();
  if (!clean) return null;
  if (/^sin observaciones\.?$/i.test(clean)) return null;
  if (/^(Montaje de PC|Expansión de Notebook) registrad[oa] por .+$/i.test(clean)) return null;
  if (/^Orden (Montaje|Expansion|Expansión) cargada desde archivo CSV\.?$/i.test(clean)) return null;
  return clean;
}

export default function TecnicosDashboardPage() {
  const [montajes, setMontajes] = useState<OrdenMontajeReal[]>([]);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<OrdenMontajeReal | null>(null);
  const [selectedOrderForCert, setSelectedOrderForCert] = useState<OrdenMontajeReal | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Estados de interacción y notificaciones
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Filtros interactivos
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoServicioFilter, setTipoServicioFilter] = useState<"TODOS" | "Montaje" | "Expansion">("TODOS");
  const [tecnicoFilter, setTecnicoFilter] = useState<string>("TODOS");
  const [vendedorFilter, setVendedorFilter] = useState<string>("TODOS");
  const [thermalSettings, setThermalSettings] = useState<ThermalPrintSettings>(DEFAULT_THERMAL_PRINT_SETTINGS);
  const [showThermalConfig, setShowThermalConfig] = useState(false);
  const [overrideStickerType, setOverrideStickerType] = useState<"auto" | "nuevo" | "finalizado">("auto");
  const draftHydratedRef = useRef(false);

  // Carga reactiva de datos reales desde MySQL + LocalStorage y resincronización automática al enfocar ventana
  useEffect(() => {
    setThermalSettings(getStoredThermalPrintSettings());
    const active = getActiveUser();
    if (!active) return;

    const loadedMontajes = getStoredMontajes();
    setMontajes(loadedMontajes);

    const draft = loadWorkDraft<{
      searchTerm?: string;
      tipoServicioFilter?: "TODOS" | "Montaje" | "Expansion";
      tecnicoFilter?: string;
      vendedorFilter?: string;
      detailOrderId?: string | null;
      certOrderId?: string | null;
    }>("tecnicos_workspace");

    if (draft) {
      if (typeof draft.searchTerm === "string") setSearchTerm(draft.searchTerm);
      if (draft.tipoServicioFilter) setTipoServicioFilter(draft.tipoServicioFilter);
      if (draft.tecnicoFilter) setTecnicoFilter(draft.tecnicoFilter);
      if (draft.vendedorFilter) setVendedorFilter(draft.vendedorFilter);
      if (draft.detailOrderId) {
        const ord = loadedMontajes.find((m) => m.id === draft.detailOrderId);
        if (ord) setSelectedOrderForDetail(ord);
      }
      if (draft.certOrderId) {
        const ord = loadedMontajes.find((m) => m.id === draft.certOrderId);
        if (ord) setSelectedOrderForCert(ord);
      }
    }
    draftHydratedRef.current = true;

    const pendingWarning = consumeCloudSyncWarning();
    if (pendingWarning) {
      showToast(pendingWarning);
    }

    fetchMontajesFromMySQL({ throwOnError: true })
      .then((dbData) => {
        if (dbData && dbData.length > 0) {
          setMontajes(dbData);
        }
      })
      .catch((err) => {
        if (!pendingWarning) {
          showToast(
            err instanceof Error
              ? err.message
              : "No se pudo sincronizar montajes con MySQL en la nube."
          );
        }
      });

    const handleWindowFocus = () => {
      fetchMontajesFromMySQL().then((dbData) => {
        if (dbData && dbData.length > 0) {
          setMontajes(dbData);
        }
      });
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  const buildTecnicosDraft = () => ({
    searchTerm,
    tipoServicioFilter,
    tecnicoFilter,
    vendedorFilter,
    detailOrderId: selectedOrderForDetail?.id || null,
    certOrderId: selectedOrderForCert?.id || null,
  });

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    saveWorkDraft("tecnicos_workspace", buildTecnicosDraft());
  }, [
    searchTerm,
    tipoServicioFilter,
    tecnicoFilter,
    vendedorFilter,
    selectedOrderForDetail,
    selectedOrderForCert,
  ]);

  useFlushDraftBeforeLogout(() => {
    if (draftHydratedRef.current) {
      saveWorkDraft("tecnicos_workspace", buildTecnicosDraft());
    }
  });

  // Activar clase compacta de impresión térmica 80mm mientras está abierto el modal de sticker
  useEffect(() => {
    if (selectedOrderForCert) {
      document.body.classList.add("thermal-80mm-print");
      setOverrideStickerType("auto");
    } else {
      document.body.classList.remove("thermal-80mm-print");
    }
    return () => {
      document.body.classList.remove("thermal-80mm-print");
    };
  }, [selectedOrderForCert]);

  const showToast = (msg: string) => {
    setNotification(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const duration = msg.length > 70 ? 7000 : 4000;
    toastTimerRef.current = setTimeout(() => setNotification(null), duration);
  };

  // Enviar o reenviar la ficha del montaje al grupo de WhatsApp configurado en el servidor
  const handleSendOrderToWhatsApp = async (order: OrdenMontajeReal) => {
    setIsSendingWhatsApp(true);
    try {
      const msg = formatMontajeWhatsAppMessage({
        cliente: order.cliente,
        nro_reg: order.nro_reg,
        vendedor: order.vendedor,
        canal: order.canal,
        tipo_servicio: order.tipo_servicio,
        cantidadEquipos: order.cantidadEquipos || 1,
        tecnico: order.tecnico,
        prioridad: order.prioridad,
        fecha_montaje: order.fecha_montaje,
        componentes: order.componentes || [],
        observaciones: getRealObservaciones(order.observaciones) || undefined,
      });

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "MONTAJES",
          to: MONTAJES_WHATSAPP_GROUP_ID,
          body: msg,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        showToast(
          `Aviso de la orden #${order.id} enviado al grupo de WhatsApp (${MONTAJES_WHATSAPP_GROUP_ID}).`
        );
      } else {
        showToast(
          `No se pudo enviar al grupo WhatsApp: ${json?.error || `HTTP ${res.status}`}`
        );
      }
    } catch {
      showToast("Error de red al conectar con el envío de WhatsApp.");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleAdvanceStage = (id: string) => {
    const current = montajes.find((m) => m.id === id);
    if (!current) return;

    let nextEtapa: "PENDIENTE_PIEZAS" | "ARMADO_MECANICO" | "ESTRES_TERMICO" | "LISTO_ENTREGA" = "ARMADO_MECANICO";
    let nextProgreso = 50;

    if (current.etapa === "PENDIENTE_PIEZAS") {
      nextEtapa = "ARMADO_MECANICO";
      nextProgreso = 60;
    } else if (current.etapa === "ARMADO_MECANICO") {
      nextEtapa = "ESTRES_TERMICO";
      nextProgreso = 85;
    } else if (current.etapa === "ESTRES_TERMICO") {
      nextEtapa = "LISTO_ENTREGA";
      nextProgreso = 100;
    }

    const updated = updateMontajeStage(id, nextEtapa, nextProgreso);
    setMontajes(updated);
    showToast(`Orden ${id} avanzada a etapa: ${nextEtapa}`);
  };

  const handleEntregar = (id: string) => {
    const updated = updateMontajeEstado(id, "Entregado");
    setMontajes(updated);
    if (selectedOrderForDetail && selectedOrderForDetail.id === id) {
      setSelectedOrderForDetail((prev) =>
        prev
          ? {
              ...prev,
              estado: "Entregado",
              etapa: "LISTO_ENTREGA",
              progreso: 100,
            }
          : null
      );
    }
    showToast(`Orden #${id} entregada al cliente con éxito.`);
  };

  const handleResetData = () => {
    if (confirm("¿Desea restablecer las órdenes a los registros reales de la tabla de montajes y expansiones?")) {
      const reset = resetMontajes();
      setMontajes(reset);
      showToast("Datos de montajes restablecidos a los registros originales.");
    }
  };

  const handleAssignTecnico = (id: string, tecnico: string) => {
    const updated = updateMontajeTecnico(id, tecnico);
    setMontajes(updated);
    showToast(`Orden ${id} asignada a ${tecnico}`);
  };

  // Resumen inteligente del hardware
  const getHardwareSummary = (m: OrdenMontajeReal) => {
    if (m.tipo_servicio === "Expansion") {
      const nb = m.componentes.find((c) => c.categoria === "NOTEBOOK")?.descripcion || "Notebook";
      const ram = m.componentes.find((c) => c.categoria === "RAM")?.descripcion || "";
      const ssd = m.componentes.find((c) => c.categoria === "ALMACENAMIENTO")?.descripcion || "";
      const upgrade = [ram, ssd].filter(Boolean).join(" + ");
      return `${nb} → Expansión: ${upgrade || "Hardware adicional"}`;
    }

    const cpu = m.componentes.find((c) => c.categoria === "PROCESADOR")?.descripcion || "";
    const gpu = m.componentes.find((c) => c.categoria === "GPU")?.descripcion || "";
    const mb = m.componentes.find((c) => c.categoria === "PLACA_MADRE")?.descripcion || "";
    const gab = m.componentes.find((c) => c.categoria === "GABINETE")?.descripcion || "";
    const parts = [cpu, gpu, mb, gab].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : m.observaciones;
  };

  // Lista dinámica de técnicos (incluye técnicos oficiales y nuevos agregados)
  const listaTecnicos = useMemo(() => {
    const fromStorage = getStoredTecnicos();
    const set = new Set<string>(fromStorage);
    montajes.forEach((m) => {
      if (m.tecnico && m.tecnico !== "Sin Asignar") {
        set.add(m.tecnico.trim());
      }
    });
    return Array.from(set);
  }, [montajes]);

  // Métricas avanzadas basadas estrictamente en la tabla real montaje.csv
  const metrics = useMemo(() => {
    const totalOrdenes = montajes.length;
    const montajesPC = montajes.filter((m) => m.tipo_servicio === "Montaje");
    const expansionesNB = montajes.filter((m) => m.tipo_servicio === "Expansion");
    
    // Total de equipos completos ensamblados (sumando los clientes con 2 equipos)
    const totalEquiposMontados = montajesPC.reduce((acc, m) => acc + (m.cantidadEquipos || 1), 0);
    const clientesConLote = montajesPC.filter((m) => m.cantidadEquipos > 1).length;

    // Ranking de Vendedores Reales desde montaje.csv
    const vendMap: Record<string, { ordenes: number; montajes: number; expansiones: number }> = {};
    montajes.forEach((m) => {
      const v = m.vendedor?.trim() || "Salón CDE";
      if (!vendMap[v]) {
        vendMap[v] = { ordenes: 0, montajes: 0, expansiones: 0 };
      }
      vendMap[v].ordenes += 1;
      if (m.tipo_servicio === "Montaje") {
        vendMap[v].montajes += 1;
      } else {
        vendMap[v].expansiones += 1;
      }
    });

    const rankingVendedores = Object.entries(vendMap)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.ordenes - a.ordenes);

    // Carga por técnico asignado en el portal operativo
    const cargaPorTecnico = listaTecnicos.map((tNombre) => {
      const asignadas = montajes.filter((m) => m.tecnico === tNombre);
      const montajesCount = asignadas.filter((m) => m.tipo_servicio === "Montaje").length;
      const expansionesCount = asignadas.filter((m) => m.tipo_servicio === "Expansion").length;
      return {
        nombre: tNombre,
        total: asignadas.length,
        montajes: montajesCount,
        expansiones: expansionesCount
      };
    });

    const totalAsignadasPortal = cargaPorTecnico.reduce((acc, t) => acc + t.total, 0);
    const sinAsignarCount = montajes.filter((m) => !m.tecnico || m.tecnico === "Sin Asignar").length;

    // Canales de Venta
    const canalTienda = montajes.filter((m) => m.canal === "Tienda").length;
    const canalEcommerce = montajes.filter((m) => m.canal === "Ecommerce - Web").length;
    const canalEmpresas = montajes.filter((m) => m.canal === "Empresas / Coorporativo").length;

    return {
      totalOrdenes,
      totalMontajesOrdenes: montajesPC.length,
      totalEquiposMontados,
      clientesConLote,
      totalExpansiones: expansionesNB.length,
      rankingVendedores,
      totalVendedores: rankingVendedores.length,
      cargaPorTecnico,
      totalAsignadasPortal,
      sinAsignarCount,
      canales: { canalTienda, canalEcommerce, canalEmpresas }
    };
  }, [montajes]);

  // Lista de vendedores únicos
  const listaVendedores = useMemo(() => {
    const set = new Set<string>();
    montajes.forEach((m) => {
      if (m.vendedor) set.add(m.vendedor.trim());
    });
    return Array.from(set).sort();
  }, [montajes]);

  // Opciones CleanSelect para filtros
  const servicioOptions: CleanSelectOption[] = useMemo(() => [
    { value: "TODOS", label: `Todos los Servicios (${montajes.length})` },
    { value: "Montaje", label: `Montaje de PC Completa (${metrics.totalMontajesOrdenes})` },
    { value: "Expansion", label: `Expansión / Notebook (${metrics.totalExpansiones})` },
  ], [montajes.length, metrics.totalMontajesOrdenes, metrics.totalExpansiones]);

  const tecnicoFilterOptions: CleanSelectOption[] = useMemo(() => [
    { value: "TODOS", label: "Todos los Técnicos" },
    { value: "Sin Asignar", label: `Sin Asignar (${metrics.sinAsignarCount})` },
    ...listaTecnicos.map((t) => ({ value: t, label: t })),
  ], [metrics.sinAsignarCount, listaTecnicos]);

  const vendedorFilterOptions: CleanSelectOption[] = useMemo(() => [
    { value: "TODOS", label: "Todos los Vendedores" },
    ...listaVendedores.map((v) => ({ value: v, label: v })),
  ], [listaVendedores]);

  // Filtrado de órdenes y ordenamiento por REG. INTERNO (más recientes primero)
  const filteredMontajes = useMemo(() => {
    const filtered = montajes.filter((m) => {
      const matchSearch =
        !searchTerm ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.nro_reg.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.vendedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.tecnico && m.tecnico.toLowerCase().includes(searchTerm.toLowerCase())) ||
        m.componentes.some(
          (c) =>
            c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.sku.includes(searchTerm)
        );

      const matchTipo = tipoServicioFilter === "TODOS" || m.tipo_servicio === tipoServicioFilter;
      const matchTecnico =
        tecnicoFilter === "TODOS" ||
        (tecnicoFilter === "Sin Asignar"
          ? !m.tecnico || m.tecnico === "Sin Asignar"
          : m.tecnico === tecnicoFilter);
      const matchVendedor = vendedorFilter === "TODOS" || m.vendedor === vendedorFilter;

      return matchSearch && matchTipo && matchTecnico && matchVendedor;
    });

    // Ordenar por REG. INTERNO de más reciente (mayor número) a más antiguo
    return [...filtered].sort((a, b) => {
      const regA = parseInt((a.nro_reg || "0").replace(/\D/g, ""), 10) || 0;
      const regB = parseInt((b.nro_reg || "0").replace(/\D/g, ""), 10) || 0;
      return regB - regA;
    });
  }, [montajes, searchTerm, tipoServicioFilter, tecnicoFilter, vendedorFilter]);

  const updateThermalSetting = <K extends keyof ThermalPrintSettings>(
    key: K,
    value: ThermalPrintSettings[K]
  ) => {
    setThermalSettings((prev) => saveThermalPrintSettings({ ...prev, [key]: value }));
  };

  const activeThermalMeta = THERMAL_PROFILE_META[thermalSettings.paperProfile];
  const activeThermalContentMm = getThermalEffectiveContentMm(thermalSettings);

  // Detección inteligente de estado: Nuevo Ingreso vs Montaje Finalizado
  const isOrderFinalizado = selectedOrderForCert
    ? selectedOrderForCert.estado === "Entregado" ||
      selectedOrderForCert.estado === "Rev. Cerrado" ||
      selectedOrderForCert.etapa === "LISTO_ENTREGA" ||
      (Number(selectedOrderForCert.progreso) || 0) >= 100
    : false;

  const isExpansion = selectedOrderForCert?.tipo_servicio === "Expansion";

  const effectiveIsFinalizado =
    overrideStickerType === "auto"
      ? isOrderFinalizado
      : overrideStickerType === "finalizado";

  const stickerHeaderTitle = effectiveIsFinalizado
    ? (isExpansion ? "Expansión Finalizada" : "Montaje Finalizado")
    : (isExpansion ? "Nueva Expansión" : "Nuevo Montaje");

  const stickerObservaciones = selectedOrderForCert
    ? getRealObservaciones(selectedOrderForCert.observaciones)
    : null;
  const detailObservaciones = selectedOrderForDetail
    ? getRealObservaciones(selectedOrderForDetail.observaciones)
    : null;

  return (
    <AuthGuard requiredModule="montajes">
      <main className="min-h-dvh bg-[#fbf9f9] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10 print:min-h-0 print:bg-white print:p-0">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 print:hidden min-w-0">
        
        {/* Cabecera unificada */}
        <HeaderActions
          title="Taller de Montajes & Ensambles de PC"
          subtitle="Control integral de armado de PC & Expansiones de notebooks con asignación de técnicos"
          activeModule="tecnicos"
          hideBadge
        />

        {/* 5 KPIs Principales Basados en los Datos Reales de montaje.csv */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 2xl:gap-6">
          
          {/* KPI 1: Total Órdenes */}
          <div className="bg-white p-4 sm:p-5 2xl:p-6 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs sm:text-sm text-zinc-500 block font-bold uppercase tracking-wider">Órdenes en Taller</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalOrdenes}
              </span>
              <span className="text-xs sm:text-sm text-zinc-600 font-medium">Registros</span>
            </div>
            <span className="text-xs text-zinc-500 block mt-1.5 font-mono">Base oficial NISSEI CDE</span>
          </div>

          {/* KPI 2: Montajes de PC (con desglose de equipos) */}
          <div className="bg-white p-4 sm:p-5 2xl:p-6 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs sm:text-sm text-zinc-500 block font-bold uppercase tracking-wider">Montajes de PC</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalEquiposMontados}
              </span>
              <span className="text-xs sm:text-sm text-sky-700 font-bold font-mono">
                {metrics.totalMontajesOrdenes} órdenes
              </span>
            </div>
            <span className="text-xs text-zinc-500 block mt-1.5 font-mono">
              {metrics.clientesConLote} clientes con 2 equipos
            </span>
          </div>

          {/* KPI 3: Expansiones de Notebook */}
          <div className="bg-white p-4 sm:p-5 2xl:p-6 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs sm:text-sm text-zinc-500 block font-bold uppercase tracking-wider">Expansiones Notebook</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalExpansiones}
              </span>
              <span className="text-xs sm:text-sm text-purple-700 font-bold font-mono">RAM &amp; SSD</span>
            </div>
            <span className="text-xs text-zinc-500 block mt-1.5 font-mono">SODIMM y discos M.2</span>
          </div>

          {/* KPI 4: Asesores Comerciales Reales */}
          <div className="bg-white p-4 sm:p-5 2xl:p-6 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs sm:text-sm text-zinc-500 block font-bold uppercase tracking-wider">Asesores Comerciales</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalVendedores}
              </span>
              <span className="text-xs sm:text-sm text-zinc-600 font-medium">Salón &amp; Web</span>
            </div>
            <span className="text-xs text-zinc-500 block mt-1.5 font-mono">Ventas canalizadas a taller</span>
          </div>

          {/* KPI 5: Canales de Venta */}
          <div className="bg-white p-4 sm:p-5 2xl:p-6 rounded-xl border border-zinc-200 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-xs sm:text-sm text-zinc-500 block font-bold uppercase tracking-wider">Canal Predominante</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.canales.canalTienda}
              </span>
              <span className="text-xs sm:text-sm text-emerald-700 font-bold">Tienda CDE</span>
            </div>
            <span className="text-xs text-zinc-500 block mt-1.5 font-mono">
              {metrics.canales.canalEmpresas} Emp · {metrics.canales.canalEcommerce} Web
            </span>
          </div>

        </section>

        {/* Notificación Toast */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 max-w-md bg-zinc-900 text-white px-4 py-3 rounded-xl text-xs font-semibold shadow-xl border border-zinc-700 flex items-start gap-2.5">
            {/no se pudo|error|falló|no está configurado|sin confirmar/i.test(notification) ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{notification}</span>
          </div>
        )}

        {/* Dashboard Operativo: Vendedores Reales y Modalidades de Servicio de montaje.csv */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Columna Izquierda: Ranking de Órdenes por Vendedor Comercial (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-zinc-700" />
                <h3 className="text-sm font-bold text-zinc-900">
                  Órdenes por Asesor / Vendedor Comercial
                </h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {metrics.totalOrdenes} órdenes en tabla real
              </span>
            </div>

            <div className="space-y-3">
              {metrics.rankingVendedores.slice(0, 6).map((v) => {
                const pct = Math.round((v.ordenes / (metrics.totalOrdenes || 1)) * 100);
                return (
                  <div key={v.nombre} className="space-y-1.5 p-2.5 rounded-lg bg-zinc-50/75 border border-zinc-200">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-zinc-900 font-bold">{v.nombre}</strong>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          ({v.montajes} Montajes · {v.expansiones} Expansiones)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-zinc-900 tabular-nums">
                        {v.ordenes} {v.ordenes === 1 ? "orden" : "órdenes"} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-zinc-900 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 text-[11px] text-zinc-500 border-t border-zinc-100 flex items-center justify-between">
              <span>Supervisión de pedidos comercializados desde Salón Central CDE y Web.</span>
              <span className="font-mono text-zinc-700 font-semibold">Registro NISSEI</span>
            </div>
          </div>

          {/* Columna Derecha: Canales y Desglose de Modalidades (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-700" />
                  <h3 className="text-sm font-bold text-zinc-900">
                    Modalidades &amp; Canales Comerciales
                  </h3>
                </div>
              </div>

              {/* Comparativa Montaje vs Expansión */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-zinc-200 bg-sky-50/50 space-y-1">
                  <span className="text-[11px] font-mono text-sky-800 uppercase block font-semibold">
                    Montaje de PC Completa
                  </span>
                  <div className="text-xl font-extrabold text-zinc-900 tabular-nums">
                    {metrics.totalEquiposMontados} <span className="text-xs font-normal text-zinc-600">PCs</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-tight">
                    Ensamble de procesador, placa madre, GPU, fuente, gabinete y cooler.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-200 bg-purple-50/50 space-y-1">
                  <span className="text-[11px] font-mono text-purple-800 uppercase block font-semibold">
                    Expansión Notebook
                  </span>
                  <div className="text-xl font-extrabold text-zinc-900 tabular-nums">
                    {metrics.totalExpansiones} <span className="text-xs font-normal text-zinc-600">Laptops</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-tight">
                    Ampliación de memoria RAM SODIMM (DDR4/DDR5) o almacenamiento SSD.
                  </p>
                </div>
              </div>

              {/* Canales: Tienda, Ecommerce, Empresas */}
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2 text-xs">
                <span className="font-semibold text-zinc-700 block text-[11px] uppercase font-mono">
                  Origen por Canal Comercial:
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" /> Tienda:
                  </span>
                  <strong className="text-zinc-900 font-mono">{metrics.canales.canalTienda} pedidos</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" /> Ecommerce - Web:
                  </span>
                  <strong className="text-zinc-900 font-mono">{metrics.canales.canalEcommerce} pedidos</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" /> Empresas / Coorporativo:
                  </span>
                  <strong className="text-zinc-900 font-mono">{metrics.canales.canalEmpresas} pedidos</strong>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-100">
              * Los clientes con 2 equipos ensamblados cuentan con 2 gabinetes, 2 placas y 2 CPUs facturados en lote.
            </p>
          </div>

        </section>

        {/* Sección Operativa: Equipo Técnico para Asignaciones a partir del Portal */}
        <section className="bg-white p-4 sm:p-5 rounded-xl border border-zinc-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-zinc-700" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Equipo Técnico Habilitado para Asignaciones en Portal
                </h3>
                <p className="text-xs text-zinc-500">
                  A partir de este sistema los nuevos montajes se asignan a Nicolás Solís, Magaly Yegros o Juan Ronnebeck
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded border border-zinc-200">
              {metrics.totalAsignadasPortal} asignadas en portal · {metrics.sinAsignarCount} históricas sin técnico en planilla
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metrics.cargaPorTecnico.map((t) => (
              <div
                key={t.nombre}
                className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-1.5 hover:border-zinc-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-bold text-zinc-900">
                    {t.nombre}
                  </strong>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded tabular-nums border ${
                    t.total > 0
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  }`}>
                    {t.total} órdenes asignadas
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {t.montajes} Montajes PC · {t.expansiones} Expansiones
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabla de Órdenes de Montaje & Expansión */}
        <section className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm space-y-4 p-4 sm:p-5">
          
          {/* Barra Superior con Filtros */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Cola de Órdenes de Montajes &amp; Expansiones
              </h3>
              <p className="text-xs text-zinc-500">
                Registros operativos oficiales con asignación a técnicos (Nicolas Solis, Magaly Yegros, Juan Ronnebeck).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/armar-pc"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg shadow-2xs transition-colors"
                title="Configurador de PC y Presupuestos con Hardware Compatible"
              >
                <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                <span>Armar PC &amp; Presupuestos</span>
              </Link>

              <Link
                href="/tecnicos/nuevo"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-black rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nuevo Ingreso</span>
              </Link>
            </div>
          </div>

          {/* Filtros Activos: Buscador, Modalidad, Técnico y Vendedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            
            {/* Buscador */}
            <div className="lg:col-span-5 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, Nº registro interno, hardware..."
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-lg pl-10 pr-3.5 py-2.5 outline-none focus:border-zinc-900 focus:bg-white transition-colors"
              />
            </div>

            {/* Filtro por Modalidad: Todos / Montaje / Expansión */}
            <div className="lg:col-span-3 flex items-center gap-2">
              <CleanSelect
                value={tipoServicioFilter}
                onChange={(val) => setTipoServicioFilter(val as any)}
                options={servicioOptions}
                fullWidth
                dropdownWidth="w-full"
                className="w-full justify-between"
              />
            </div>

            {/* Filtro por Técnico (Nicolas Solis, Magaly Yegros, Juan Ronnebeck) */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <CleanSelect
                value={tecnicoFilter}
                onChange={(val) => setTecnicoFilter(val)}
                options={tecnicoFilterOptions}
                fullWidth
                dropdownWidth="w-full"
                className="w-full justify-between"
              />
            </div>

            {/* Filtro por Vendedor */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <CleanSelect
                value={vendedorFilter}
                onChange={(val) => setVendedorFilter(val)}
                options={vendedorFilterOptions}
                fullWidth
                dropdownWidth="w-full"
                className="w-full justify-between"
              />
            </div>

          </div>

          {/* Tabla de Resultados */}
          <div className="overflow-x-auto border border-zinc-200 rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600 uppercase tracking-wide border-b border-zinc-200 font-mono text-xs">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Reg. Interno</th>
                  <th className="py-3.5 px-4 font-bold">Cliente &amp; Canal</th>
                  <th className="py-3.5 px-4 font-bold">Modalidad &amp; Cantidad</th>
                  <th className="py-3.5 px-4 font-bold">Hardware Verificado</th>
                  <th className="py-3.5 px-4 font-bold">Técnico Responsable</th>
                  <th className="py-3.5 px-4 font-bold">Progreso</th>
                  <th className="py-3.5 px-4 font-bold text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900">
                {filteredMontajes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-zinc-500 text-sm">
                      No se encontraron órdenes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredMontajes.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50/75 transition-colors">
                      
                      {/* Nro. Registro / Interno */}
                      <td className="py-4 px-4 font-mono whitespace-nowrap">
                        <div className="font-extrabold text-zinc-900 text-sm">
                          Reg: {order.nro_reg}
                        </div>
                        {order.prioridad === "URGENTE" && (
                          <span className="inline-block mt-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase">
                            Urgente
                          </span>
                        )}
                        {order.prioridad === "EXPRESS" && (
                          <span className="inline-block mt-1 text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded font-bold uppercase">
                            Express
                          </span>
                        )}
                      </td>

                      {/* Cliente, Vendedor y Canal */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-zinc-900 text-sm">{order.cliente}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-xs font-mono text-zinc-700">
                            <ShoppingBag className="w-3 h-3" />
                            {order.vendedor}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono">
                            {order.canal}
                          </span>
                        </div>
                      </td>

                      {/* Modalidad y Equipos */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.tipo_servicio === "Montaje" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg font-mono text-xs font-bold">
                              <Cpu className="w-3.5 h-3.5" />
                              Montaje PC
                            </span>
                            {order.cantidadEquipos > 1 && (
                              <span className="block text-xs text-sky-900 font-extrabold font-mono">
                                2 Equipos en lote
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg font-mono text-xs font-bold">
                            <Laptop className="w-3.5 h-3.5" />
                            Expansión Notebook
                          </span>
                        )}
                      </td>

                      {/* Hardware Verificado */}
                      <td className="py-4 px-4 text-zinc-700 max-w-sm">
                        <div className="line-clamp-2 text-xs sm:text-sm leading-relaxed" title={getHardwareSummary(order)}>
                          {getHardwareSummary(order)}
                        </div>
                        <span className="text-xs text-zinc-500 font-mono mt-1 inline-block">
                          {order.componentes.length} piezas verificadas
                        </span>
                      </td>

                      {/* Técnico Responsable */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.tecnico && order.tecnico !== "Sin Asignar" ? (
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-bold text-zinc-900 flex items-center gap-1.5 text-sm">
                                <UserCheck className="w-4 h-4 text-emerald-700" />
                                <span>{order.tecnico}</span>
                              </div>
                              <span className="text-xs text-zinc-500 font-mono">Técnico Asignado</span>
                            </div>
                            <CleanSelect
                              value={order.tecnico}
                              onChange={(val) => {
                                if (val) handleAssignTecnico(order.id, val);
                              }}
                              options={listaTecnicos.map((t) => ({
                                value: t,
                                label: t,
                              }))}
                              size="sm"
                              dropdownWidth="w-48"
                              align="right"
                              className="text-xs py-1 px-2.5 border-zinc-200 hover:border-zinc-400"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-block text-xs font-mono text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                              Sin Asignar (Histórico)
                            </span>
                            <div>
                              <CleanSelect
                                value=""
                                onChange={(val) => {
                                  if (val) handleAssignTecnico(order.id, val);
                                }}
                                placeholder="Asignar técnico..."
                                options={listaTecnicos.map((t) => ({
                                  value: t,
                                  label: t,
                                }))}
                                size="sm"
                                dropdownWidth="w-48"
                                className="bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 text-xs py-1 px-2.5"
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Progreso */}
                      <td className="py-4 px-4 w-32">
                        <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5 tabular-nums">
                          <span>{order.progreso}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              order.progreso === 100 ? "bg-emerald-600" : "bg-zinc-900"
                            }`}
                            style={{ width: `${order.progreso}%` }}
                          />
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrderForDetail(order)}
                            className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer border border-transparent hover:border-zinc-200"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setSelectedOrderForCert(order)}
                            className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer border border-transparent hover:border-zinc-200"
                            title="Imprimir Sticker 80mm"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {order.estado.toLowerCase() === "entregado" || order.estado.toLowerCase() === "entregada" ? (
                            <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-lg font-mono text-xs font-bold">
                              Entregado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEntregar(order.id)}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg font-bold text-xs transition-colors shadow-sm cursor-pointer"
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
        </section>

        {/* Modal de Detalle Completo de Orden de Montaje */}
        {selectedOrderForDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-zinc-200 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div>
                  <span className="text-[11px] font-mono text-zinc-500 uppercase font-semibold">
                    DETALLE DE ORDEN DE MONTAJE &amp; TALLER
                  </span>
                  <h3 className="text-lg font-bold text-zinc-900">
                    Orden #{selectedOrderForDetail.id} · {selectedOrderForDetail.cliente}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="text-zinc-400 hover:text-zinc-900 text-xl font-bold p-1 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Ficha Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Nº Registro Interno:</span>
                  <strong className="text-zinc-900 font-mono">{selectedOrderForDetail.nro_reg}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Vendedor:</span>
                  <span className="text-zinc-900 font-semibold truncate block">{selectedOrderForDetail.vendedor}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Canal:</span>
                  <span className="text-zinc-700 font-mono text-[11px]">{selectedOrderForDetail.canal}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Modalidad:</span>
                  <span className="font-semibold text-zinc-900">
                    {selectedOrderForDetail.tipo_servicio === "Montaje" ? "Montaje de PC" : "Expansión Notebook"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Técnico Asignado:</span>
                  <strong className="text-zinc-900 font-semibold">{selectedOrderForDetail.tecnico}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Prioridad:</span>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                    selectedOrderForDetail.prioridad === "URGENTE"
                      ? "bg-rose-100 text-rose-800"
                      : selectedOrderForDetail.prioridad === "EXPRESS"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-zinc-200 text-zinc-800"
                  }`}>
                    {selectedOrderForDetail.prioridad}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Fecha de Montaje:</span>
                  <span className="text-zinc-700 font-mono">{selectedOrderForDetail.fecha_montaje}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Estado:</span>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                    selectedOrderForDetail.estado === "Entregado"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {selectedOrderForDetail.estado}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-mono text-[10px] uppercase">Progreso QA:</span>
                  <strong className="text-zinc-900 font-mono">{selectedOrderForDetail.progreso}%</strong>
                </div>
              </div>

              {/* Componentes Verificados */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900">
                    Componentes de Hardware ({selectedOrderForDetail.componentes.length} ítems):
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-xl p-2 bg-zinc-50/50 space-y-1">
                  {selectedOrderForDetail.componentes.map((c, i) => (
                    <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5">
                      <div className="truncate pr-2">
                        <span className="inline-block text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700 mr-1.5">
                          {c.categoria}
                        </span>
                        <span className="font-semibold text-zinc-900">{c.descripcion}</span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500 shrink-0">
                        SKU: {c.sku} {c.seriales ? `· S/N: ${c.seriales}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              {detailObservaciones && (
                <div className="text-xs space-y-1 bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl">
                  <span className="font-bold text-amber-900 block font-mono text-[10px] uppercase">
                    Instrucciones &amp; Observaciones:
                  </span>
                  <p className="text-amber-950 text-[11px] leading-relaxed">
                    {detailObservaciones}
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="pt-3 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="w-full sm:w-auto px-4 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  Cerrar
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <button
                    type="button"
                    disabled={isSendingWhatsApp}
                    onClick={() => void handleSendOrderToWhatsApp(selectedOrderForDetail)}
                    className="px-3.5 py-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    title={`Enviar resumen al grupo ${MONTAJES_WHATSAPP_GROUP_ID}`}
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isSendingWhatsApp ? "Enviando..." : "Enviar a WhatsApp"}</span>
                  </button>

                  <button
                    onClick={() => {
                      const ord = selectedOrderForDetail;
                      setSelectedOrderForDetail(null);
                      setSelectedOrderForCert(ord);
                    }}
                    className="px-3.5 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Imprimir Sticker</span>
                  </button>

                  {selectedOrderForDetail.estado.toLowerCase() !== "entregado" &&
                    selectedOrderForDetail.estado.toLowerCase() !== "entregada" && (
                      <button
                        onClick={() => {
                          handleEntregar(selectedOrderForDetail.id);
                        }}
                        className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer transition-colors"
                      >
                        Entregar al Cliente
                      </button>
                    )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Modal Sticker Térmico Configurable (80mm / 58mm) para Identificación de Montaje */}
      {selectedOrderForCert && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 print:static print:inset-auto print:bg-transparent print:p-0 print:block animate-in fade-in">
          <style media="print">{buildThermalPrintCss(thermalSettings)}</style>

          {/* Estilos especiales para ultra negro y cabezales térmicos POS */}
          <style>{`
            .thermal-pure-black {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              opacity: 1 !important;
            }
            .thermal-label {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              font-weight: 900 !important;
              opacity: 1 !important;
            }
            .thermal-value {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              font-weight: 900 !important;
              opacity: 1 !important;
            }
            .thermal-ultra-black {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              font-weight: 900 !important;
            }
            .thermal-ultra-black-title {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              font-weight: 900 !important;
            }
            .thermal-ultra-mode,
            .thermal-ultra-mode * {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              font-weight: 900 !important;
            }
            @media print {
              body.thermal-80mm-print,
              body.thermal-80mm-print #thermal-sticker-80mm,
              body.thermal-80mm-print #thermal-sticker-80mm * {
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
                border-color: #000000 !important;
                opacity: 1 !important;
                text-shadow: none !important;
                filter: none !important;
              }
              .thermal-label,
              .thermal-value,
              .thermal-ultra-black,
              .thermal-ultra-black-title,
              .thermal-ultra-mode,
              .thermal-ultra-mode * {
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
                font-weight: 900 !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 border border-zinc-200 max-h-[92dvh] overflow-y-auto overscroll-contain print:w-auto print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-0 print:shadow-none print:rounded-none">

            {/* Cabecera del modal (oculta al imprimir) */}
            <div className="flex items-start justify-between gap-2 border-b border-zinc-200 pb-3 print:hidden">
              <div className="min-w-0">
                <h2 className="text-base font-black text-zinc-900 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-zinc-700" />
                  <span>Sticker: {stickerHeaderTitle} · {activeThermalMeta.pageWidthMm}mm</span>
                </h2>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {activeThermalMeta.shortLabel} ({activeThermalContentMm}mm útil) · {thermalSettings.scalePct}% · {thermalSettings.highContrast ? "Negro Intenso ON" : "Estándar"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowThermalConfig((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    showThermalConfig
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                      : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300"
                  }`}
                  title="Calibrar papel, márgenes, escala y oscuridad de tinta"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Calibrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForCert(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1.5 rounded-xl hover:bg-zinc-100 cursor-pointer transition-colors"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Panel Colapsable de Calibración de Impresora Térmica */}
            {showThermalConfig && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-3 text-xs print:hidden">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <span className="font-extrabold text-zinc-900 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-700" />
                    Calibración de Impresora Térmica
                  </span>
                  <button
                    type="button"
                    onClick={() => setThermalSettings(resetThermalPrintSettings())}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restablecer
                  </button>
                </div>

                {/* Tipo de Comprobante / Título (Detección automática + selección manual) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-zinc-700">
                      Tipo de Comprobante / Título:
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Detectado: {isOrderFinalizado ? "Finalizado" : "Nuevo Ingreso"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOverrideStickerType("auto")}
                      className={`px-2 py-1.5 rounded-lg text-[10.5px] font-semibold border text-center transition-colors cursor-pointer ${
                        overrideStickerType === "auto"
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      Automático ({isOrderFinalizado ? "Finalizado" : "Nuevo"})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverrideStickerType("nuevo")}
                      className={`px-2 py-1.5 rounded-lg text-[10.5px] font-semibold border text-center transition-colors cursor-pointer ${
                        overrideStickerType === "nuevo"
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {isExpansion ? "Nueva Expansión" : "Nuevo Montaje"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverrideStickerType("finalizado")}
                      className={`px-2 py-1.5 rounded-lg text-[10.5px] font-semibold border text-center transition-colors cursor-pointer ${
                        overrideStickerType === "finalizado"
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {isExpansion ? "Expansión Finalizada" : "Montaje Finalizado"}
                    </button>
                  </div>
                </div>

                {/* Ancho de papel */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-zinc-700">
                    Ancho del rollo / cabezal:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(THERMAL_PROFILE_META) as ThermalPaperProfile[]).map((key) => {
                      const active = thermalSettings.paperProfile === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateThermalSetting("paperProfile", key)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border text-center transition-colors cursor-pointer ${
                            active
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          {THERMAL_PROFILE_META[key].shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Formato y Márgenes */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-zinc-700">
                      Largo de corte:
                    </label>
                    <select
                      value={thermalSettings.lengthMode}
                      onChange={(e) =>
                        updateThermalSetting("lengthMode", e.target.value as ThermalLengthMode)
                      }
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-900 outline-none focus:border-zinc-900"
                    >
                      <option value="auto">Rollo continuo (Recomendado - Auto)</option>
                      <option value="120mm">Etiqueta 120mm (Stickers precortados)</option>
                      <option value="150mm">Etiqueta 150mm (Stickers precortados)</option>
                      <option value="200mm">Etiqueta 200mm (Stickers precortados)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-zinc-700">
                      Márgenes laterales (X):
                    </label>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 4].map((mm) => (
                        <button
                          key={mm}
                          type="button"
                          onClick={() => updateThermalSetting("marginMm", mm)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                            thermalSettings.marginMm === mm
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          {mm}mm
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Escala y Centrados X / Y */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-zinc-700">Escala:</span>
                      <span className="font-mono font-bold text-zinc-900">{thermalSettings.scalePct}%</span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={120}
                      step={5}
                      value={thermalSettings.scalePct}
                      onChange={(e) => updateThermalSetting("scalePct", Number(e.target.value))}
                      className="w-full accent-zinc-900 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-zinc-700">Posición (X):</span>
                      <span className="font-mono font-bold text-zinc-900">
                        {thermalSettings.offsetXMm > 0 ? `+${thermalSettings.offsetXMm}` : thermalSettings.offsetXMm}mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-8}
                      max={8}
                      step={0.5}
                      value={thermalSettings.offsetXMm}
                      onChange={(e) => updateThermalSetting("offsetXMm", Number(e.target.value))}
                      className="w-full accent-zinc-900 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-zinc-700">Subir/Bajar (Y):</span>
                      <span className="font-mono font-bold text-zinc-900">
                        {thermalSettings.offsetYMm > 0 ? `+${thermalSettings.offsetYMm}` : thermalSettings.offsetYMm}mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-30}
                      max={15}
                      step={1}
                      value={thermalSettings.offsetYMm}
                      onChange={(e) => updateThermalSetting("offsetYMm", Number(e.target.value))}
                      className="w-full accent-zinc-900 cursor-pointer"
                      title="Desplaza el inicio verticalmente. Valores negativos (-15mm, -25mm) contrarrestan el avance en blanco de la impresora"
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                      <button
                        type="button"
                        onClick={() => updateThermalSetting("offsetYMm", -20)}
                        className="hover:text-zinc-900 underline cursor-pointer"
                      >
                        Subir -20mm
                      </button>
                      <button
                        type="button"
                        onClick={() => updateThermalSetting("offsetYMm", -10)}
                        className="hover:text-zinc-900 underline cursor-pointer"
                      >
                        -10mm
                      </button>
                      <button
                        type="button"
                        onClick={() => updateThermalSetting("offsetYMm", 0)}
                        className="hover:text-zinc-900 underline cursor-pointer"
                      >
                        0mm
                      </button>
                    </div>
                  </div>
                </div>

                {/* Opción Bien Negro / Alto Contraste */}
                <div className="pt-1 border-t border-zinc-200">
                  <label className="flex items-start gap-2.5 text-[11px] font-medium text-zinc-800 cursor-pointer p-2 rounded-lg bg-white border border-zinc-200 hover:border-zinc-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={thermalSettings.highContrast}
                      onChange={(e) => updateThermalSetting("highContrast", e.target.checked)}
                      className="rounded border-zinc-300 accent-zinc-900 mt-0.5 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-zinc-900 block">
                        Negro Intenso (Ultra Black / Cabezal térmico nítido)
                      </span>
                      <span className="text-[10px] text-zinc-500 leading-tight block mt-0.5">
                        Fuerza texto en negro puro (#000000), grosor Black (900) y bordes sólidos de 2px en todos los componentes para que la impresora térmica imprima bien oscuro y nítido.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Tip operativo y solución para espacio arriba y saltos en 3nStar / POS-80 */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Solución a saltos en blanco y espacio arriba (3nStar / POS-80):</span>
                  </div>
                  <ul className="text-[10.5px] leading-relaxed list-disc list-inside space-y-1 text-amber-950">
                    <li>
                      <strong>Evitar saltos en blanco en el medio:</strong> Dejá siempre <strong>Largo de corte: Rollo continuo (Auto)</strong>. Las etiquetas fijas cortan la lista de componentes a la mitad.
                    </li>
                    <li>
                      <strong>En la ventana de Chrome:</strong> Dejar <strong>Escala: 100%</strong> y <strong>Márgenes: Ninguno</strong>.
                    </li>
                    <li>
                      <strong>Tamaño de papel en Chrome:</strong> Cambiar de <em>80(72.1) x 210 mm</em> a <strong>80 x Receipt</strong> o <strong>Continuous / Rollo</strong> para evitar que Windows divida en hojas fijas de 210mm.
                    </li>
                    <li>
                      <strong>Compensar avance de cabezal:</strong> En impresoras 3nStar, podés usar <strong>Subir/Bajar (Y)</strong> en <strong>-10mm</strong> a <strong>-20mm</strong> para que el texto comience pegado al borde cortado.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Área Imprimible Calibrada */}
            <div
              id="thermal-sticker-wrapper"
              className="mx-auto print:mx-auto transition-all"
              style={{
                maxWidth:
                  thermalSettings.paperProfile === "58_48"
                    ? "230px"
                    : thermalSettings.paperProfile === "80_72"
                      ? "290px"
                      : "310px",
              }}
            >
              <div
                id="thermal-sticker-80mm"
                className={`w-full border ${thermalSettings.highContrast ? "border-2 border-black" : "border border-dashed border-zinc-300"} bg-white p-3.5 text-black print:w-full print:max-w-none print:border-0 print:p-0 print:pt-0 print:m-0 print:mt-0 space-y-2 print:space-y-1.5 ${
                  thermalSettings.highContrast ? "thermal-ultra-mode font-black" : ""
                }`}
                style={{
                  zoom: thermalSettings.scalePct / 100,
                }}
              >
                {/* Encabezado Compacto Dinámico (Nuevo Montaje vs Montaje Finalizado) */}
                <div className={`text-center ${thermalSettings.highContrast ? "border-b-[3px]" : "border-b-2"} border-black pb-1.5 print:pb-1 print:pt-0 print:mt-0`}>
                  <h1 className="text-sm font-black tracking-wider uppercase text-black thermal-label print:pt-0 print:mt-0 print:leading-none">
                    {stickerHeaderTitle}
                  </h1>
                </div>

                {/* Datos del Cliente & Orden */}
                <div className="border-b border-dashed border-black py-2 space-y-1">
                  <div>
                    <span className="text-[9px] font-mono font-black uppercase text-black block leading-none thermal-label">
                      CLIENTE:
                    </span>
                    <strong className="text-[15px] font-black uppercase text-black leading-tight block break-words mt-0.5 thermal-value">
                      {selectedOrderForCert.cliente}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-black pt-0.5">
                    <span>
                      <span className="thermal-label font-black">Reg:</span> <strong className="thermal-value font-black">{selectedOrderForCert.nro_reg}</strong>
                    </span>
                    <span>
                      <span className="thermal-label font-black">Fecha:</span> <strong className="thermal-value font-black">{selectedOrderForCert.fecha_montaje}</strong>
                    </span>
                  </div>
                  {selectedOrderForCert.prioridad !== "NORMAL" && (
                    <div className="inline-block border-2 border-black px-1.5 py-0.5 text-[9px] font-mono font-black uppercase text-black bg-white">
                      PRIORIDAD: {selectedOrderForCert.prioridad}
                    </div>
                  )}
                </div>

                {/* Datos de Vendedor / Canal */}
                <div className="border-b border-dashed border-black py-1.5 text-[10.5px] font-mono text-black space-y-0.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-black uppercase shrink-0 thermal-label">VENDEDOR:</span>
                    <span className="font-black text-right break-words thermal-value">
                      {selectedOrderForCert.vendedor}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-[10px]">
                    <span className="uppercase shrink-0 font-black thermal-label">CANAL:</span>
                    <span className="font-black text-right thermal-value">
                      {selectedOrderForCert.canal}
                    </span>
                  </div>
                  {selectedOrderForCert.tecnico &&
                    selectedOrderForCert.tecnico !== "Sin Asignar" && (
                      <div className="flex justify-between gap-2 text-[10px]">
                        <span className="uppercase shrink-0 font-black thermal-label">TÉCNICO:</span>
                        <span className="font-black text-right thermal-value">
                          {selectedOrderForCert.tecnico}
                        </span>
                      </div>
                    )}
                </div>

                {/* Componentes (Sin seriales) */}
                <div className="py-2 space-y-1">
                  <div className="text-[10px] font-mono font-black uppercase text-black border-b-2 border-black pb-0.5 thermal-label">
                    COMPONENTES ({selectedOrderForCert.componentes.length}):
                  </div>
                  <ul className="space-y-1 pt-0.5">
                    {selectedOrderForCert.componentes.map((c, i) => (
                      <li
                        key={i}
                        className="text-[10px] leading-snug text-black break-words border-b border-dotted border-zinc-400 print:border-black pb-1 last:border-b-0 last:pb-0"
                      >
                        <span className="font-mono font-black thermal-label">
                          [{c.sku ? `SKU: ${c.sku}` : formatCategoriaSticker(c.categoria)}]
                        </span>{" "}
                        <span className="font-black thermal-value">
                          {c.descripcion}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Observaciones (Solo si el campo está rellenado) */}
                {stickerObservaciones && (
                  <div className="mt-1.5 border-2 border-black p-1.5 bg-white">
                    <span className="text-[9px] font-mono font-black uppercase text-black block mb-0.5 thermal-label">
                      OBSERVACIONES:
                    </span>
                    <p className="text-[10px] text-black leading-snug whitespace-pre-wrap break-words font-black thermal-value">
                      {stickerObservaciones}
                    </p>
                  </div>
                )}

                {/* Garantía de Componentes (Solo en Montaje Finalizado / Para Entregar) */}
                {effectiveIsFinalizado && (
                  <div className="border-t-2 border-dashed border-black pt-1.5 mt-2 text-center">
                    <span className="text-[9.5px] font-mono font-black text-black block leading-tight uppercase thermal-value">
                      * Todos los componentes tienen 3 meses de garantía desde la fecha de compra.
                    </span>
                  </div>
                )}

                {/* Pie de Identificación */}
                <div className="border-t-2 border-black pt-1.5 mt-2 text-center text-[9.5px] font-mono font-black text-black uppercase">
                  <span className="thermal-label font-black tracking-wide">
                    || {effectiveIsFinalizado ? "ETIQUETA DE MONTAJE Y ENTREGA" : "ETIQUETA DE INGRESO A TALLER"} ||
                  </span>
                </div>
              </div>
            </div>

            {/* Botones de acción inferiores (ocultos al imprimir) */}
            <div className="pt-3 border-t border-zinc-200 flex justify-between items-center print:hidden">
              <button
                type="button"
                onClick={() => setSelectedOrderForCert(null)}
                className="px-4 py-2 border border-zinc-200 hover:border-zinc-400 rounded-xl text-xs font-semibold text-zinc-600 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Sticker ({activeThermalMeta.pageWidthMm}mm)</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
    </AuthGuard>
  );
}
