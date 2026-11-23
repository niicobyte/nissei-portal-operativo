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
  formatearNombreComponenteBasico,
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
import { ThermalLengthSelect } from "@/components/common/ThermalLengthSelect";
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
      <main className="min-h-dvh bg-[#FAF6EE] text-[#111111] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10 print:min-h-0 print:bg-white print:p-0">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 print:hidden min-w-0">
        
        {/* Cabecera unificada */}
        <HeaderActions
          title="Taller de Montajes & Ensambles de PC"
          subtitle="Control integral de armado de PC & Expansiones de notebooks con asignación de técnicos"
          activeModule="tecnicos"
          hideBadge
        />

        {/* 5 KPIs Principales Basados en los Datos Reales de montaje.csv (Neo-Brutalismo Retro) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 2xl:gap-6">
          
          {/* KPI 1: Total Órdenes */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
            <span className="text-xs sm:text-sm text-neutral-700 block font-heading font-extrabold uppercase tracking-wider">Órdenes en Taller</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-mono font-extrabold text-black tabular-nums">
                {metrics.totalOrdenes}
              </span>
              <span className="text-xs sm:text-sm text-neutral-800 font-bold">Registros</span>
            </div>
            <span className="text-xs text-neutral-700 block mt-1.5 font-mono font-semibold">Base oficial NISSEI CDE</span>
          </div>

          {/* KPI 2: Montajes de PC (con desglose de equipos) */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
            <span className="text-xs sm:text-sm text-neutral-700 block font-heading font-extrabold uppercase tracking-wider">Montajes de PC</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-mono font-extrabold text-black tabular-nums">
                {metrics.totalEquiposMontados}
              </span>
              <span className="text-xs sm:text-sm text-black font-extrabold font-mono bg-[#FFD23F] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                {metrics.totalMontajesOrdenes} órdenes
              </span>
            </div>
            <span className="text-xs text-neutral-700 block mt-1.5 font-mono font-semibold">
              {metrics.clientesConLote} clientes con 2 equipos
            </span>
          </div>

          {/* KPI 3: Expansiones de Notebook */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
            <span className="text-xs sm:text-sm text-neutral-700 block font-heading font-extrabold uppercase tracking-wider">Expansiones Notebook</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-mono font-extrabold text-black tabular-nums">
                {metrics.totalExpansiones}
              </span>
              <span className="text-xs sm:text-sm text-white font-extrabold font-mono bg-[#2A9D8F] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                RAM &amp; SSD
              </span>
            </div>
            <span className="text-xs text-neutral-700 block mt-1.5 font-mono font-semibold">SODIMM y discos M.2</span>
          </div>

          {/* KPI 4: Asesores Comerciales Reales */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
            <span className="text-xs sm:text-sm text-neutral-700 block font-heading font-extrabold uppercase tracking-wider">Asesores Comerciales</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-mono font-extrabold text-black tabular-nums">
                {metrics.totalVendedores}
              </span>
              <span className="text-xs sm:text-sm text-neutral-800 font-bold">Salón &amp; Web</span>
            </div>
            <span className="text-xs text-neutral-700 block mt-1.5 font-mono font-semibold">Ventas canalizadas a taller</span>
          </div>

          {/* KPI 5: Canales de Venta */}
          <div className="bg-[#FFFDF9] p-4 sm:p-5 2xl:p-6 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] col-span-2 sm:col-span-1">
            <span className="text-xs sm:text-sm text-neutral-700 block font-heading font-extrabold uppercase tracking-wider">Canal Predominante</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl sm:text-4xl 2xl:text-5xl font-mono font-extrabold text-black tabular-nums">
                {metrics.canales.canalTienda}
              </span>
              <span className="text-xs sm:text-sm text-black font-extrabold bg-[#FFD23F] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">Tienda</span>
            </div>
            <span className="text-xs text-neutral-700 block mt-1.5 font-mono font-semibold">
              {metrics.canales.canalEmpresas} Emp · {metrics.canales.canalEcommerce} Web
            </span>
          </div>

        </section>

        {/* Notificación Toast Neo-Brutalista */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 max-w-md bg-[#FFD23F] text-black px-4 py-3 rounded-xl text-xs font-heading font-extrabold shadow-[4px_4px_0px_#000] border-2 border-black flex items-start gap-2.5">
            {/no se pudo|error|falló|no está configurado|sin confirmar/i.test(notification) ? (
              <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-black shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{notification}</span>
          </div>
        )}

        {/* Dashboard Operativo: Vendedores Reales y Modalidades de Servicio de montaje.csv */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Columna Izquierda: Ranking de Órdenes por Vendedor Comercial (7 cols) */}
          <div className="lg:col-span-7 bg-[#FFFDF9] p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-black" />
                <h3 className="text-sm font-heading font-extrabold text-black">
                  Órdenes por Asesor / Vendedor Comercial
                </h3>
              </div>
              <span className="text-xs text-neutral-800 font-mono font-bold">
                {metrics.totalOrdenes} órdenes en tabla real
              </span>
            </div>

            <div className="space-y-3">
              {metrics.rankingVendedores.slice(0, 6).map((v) => {
                const pct = Math.round((v.ordenes / (metrics.totalOrdenes || 1)) * 100);
                return (
                  <div key={v.nombre} className="space-y-1.5 p-2.5 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-black font-heading font-bold">{v.nombre}</strong>
                        <span className="text-[11px] text-neutral-700 font-mono font-semibold">
                          ({v.montajes} Montajes · {v.expansiones} Expansiones)
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-black tabular-nums">
                        {v.ordenes} {v.ordenes === 1 ? "orden" : "órdenes"} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200 border border-black rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-black h-2 rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 text-[11px] text-neutral-700 border-t-2 border-black flex items-center justify-between font-mono font-medium">
              <span>Supervisión de pedidos comercializados desde Salón Central CDE y Web.</span>
              <span className="font-mono text-black font-bold">Registro NISSEI</span>
            </div>
          </div>

          {/* Columna Derecha: Canales y Desglose de Modalidades (5 cols) */}
          <div className="lg:col-span-5 bg-[#FFFDF9] p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-black" />
                  <h3 className="text-sm font-heading font-extrabold text-black">
                    Modalidades &amp; Canales Comerciales
                  </h3>
                </div>
              </div>

              {/* Comparativa Montaje vs Expansión */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border-2 border-black bg-[#FFFDF9] shadow-[2px_2px_0px_#000] space-y-1">
                  <span className="text-[10px] font-mono text-black uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#FFD23F] border border-black inline-block">
                    Montaje de PC Completa
                  </span>
                  <div className="text-xl font-mono font-extrabold text-black tabular-nums">
                    {metrics.totalEquiposMontados} <span className="text-xs font-normal text-neutral-800">PCs</span>
                  </div>
                  <p className="text-[10px] text-neutral-800 leading-tight font-medium">
                    Ensamble de procesador, placa madre, GPU, fuente, gabinete y cooler.
                  </p>
                </div>

                <div className="p-3 rounded-lg border-2 border-black bg-[#FFFDF9] shadow-[2px_2px_0px_#000] space-y-1">
                  <span className="text-[10px] font-mono text-white uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#2A9D8F] border border-black inline-block">
                    Expansión Notebook
                  </span>
                  <div className="text-xl font-mono font-extrabold text-black tabular-nums">
                    {metrics.totalExpansiones} <span className="text-xs font-normal text-neutral-800">Laptops</span>
                  </div>
                  <p className="text-[10px] text-neutral-800 leading-tight font-medium">
                    Ampliación de memoria RAM SODIMM (DDR4/DDR5) o almacenamiento SSD.
                  </p>
                </div>
              </div>

              {/* Canales: Tienda, Ecommerce, Empresas */}
              <div className="p-3 bg-[#FAF6EE] rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] space-y-2 text-xs">
                <span className="font-heading font-extrabold text-black block text-[11px] uppercase">
                  Origen por Canal Comercial:
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-800 flex items-center gap-1.5 font-medium">
                    <ShoppingBag className="w-3.5 h-3.5 text-black" /> Tienda:
                  </span>
                  <strong className="text-black font-mono font-bold">{metrics.canales.canalTienda} pedidos</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-800 flex items-center gap-1.5 font-medium">
                    <Globe className="w-3.5 h-3.5 text-black" /> Ecommerce - Web:
                  </span>
                  <strong className="text-black font-mono font-bold">{metrics.canales.canalEcommerce} pedidos</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-800 flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-black" /> Empresas / Corporativo:
                  </span>
                  <strong className="text-black font-mono font-bold">{metrics.canales.canalEmpresas} pedidos</strong>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-700 pt-2 border-t-2 border-black font-medium">
              * Los clientes con 2 equipos ensamblados cuentan con 2 gabinetes, 2 placas y 2 CPUs facturados en lote.
            </p>
          </div>

        </section>

        {/* Sección Operativa: Equipo Técnico para Asignaciones a partir del Portal */}
        <section className="bg-[#FFFDF9] p-4 sm:p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-black" />
              <div>
                <h3 className="text-sm font-heading font-extrabold text-black">
                  Equipo Técnico Habilitado para Asignaciones en Portal
                </h3>
                <p className="text-xs text-neutral-800 font-medium">
                  A partir de este sistema los nuevos montajes se asignan a Nicolás Solís, Magaly Yegros o Juan Ronnebeck
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#FFD23F] text-black rounded-full border border-black shadow-[1px_1px_0px_#000]">
              {metrics.totalAsignadasPortal} asignadas en portal · {metrics.sinAsignarCount} históricas sin técnico en planilla
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metrics.cargaPorTecnico.map((t) => (
              <div
                key={t.nombre}
                className="p-3.5 rounded-lg border-2 border-black bg-[#FAF6EE] space-y-1.5 hover:bg-[#FFD23F]/20 shadow-[2px_2px_0px_#000] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-heading font-extrabold text-black">
                    {t.nombre}
                  </strong>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full tabular-nums border border-black shadow-[1px_1px_0px_#000] ${
                    t.total > 0
                      ? "bg-[#2A9D8F] text-white"
                      : "bg-neutral-200 text-black"
                  }`}>
                    {t.total} órdenes asignadas
                  </span>
                </div>
                <div className="text-[11px] text-neutral-700 font-mono font-semibold">
                  {t.montajes} Montajes PC · {t.expansiones} Expansiones
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tabla de Órdenes de Montaje & Expansión (Neo-Brutalismo Retro) */}
        <section className="bg-[#FFFDF9] rounded-xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000] space-y-4 p-4 sm:p-5">
          
          {/* Barra Superior con Filtros */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b-2 border-black">
            <div>
              <h3 className="text-base font-heading font-extrabold text-black">
                Cola de Órdenes de Montajes &amp; Expansiones
              </h3>
              <p className="text-xs text-neutral-800 font-medium">
                Registros operativos oficiales con asignación a técnicos (Nicolas Solis, Magaly Yegros, Juan Ronnebeck).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/tecnicos/nuevo"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-heading font-extrabold text-[#FFD23F] bg-black hover:bg-neutral-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
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
              <Search className="w-4 h-4 text-black absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, Nº registro interno, hardware..."
                className="w-full text-sm bg-[#FAF6EE] border-2 border-black rounded-lg pl-10 pr-3.5 py-2.5 outline-none focus:bg-white text-black font-medium shadow-[2px_2px_0px_#000] transition-colors"
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
          <div className="overflow-x-auto border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF6EE] text-black uppercase tracking-wider border-b-2 border-black font-mono text-xs font-black select-none">
                <tr>
                  <th className="py-3.5 px-4 font-black text-black">Reg. Interno</th>
                  <th className="py-3.5 px-4 font-black text-black">Cliente &amp; Canal</th>
                  <th className="py-3.5 px-4 font-black text-black">Modalidad &amp; Cantidad</th>
                  <th className="py-3.5 px-4 font-black text-black">Hardware Verificado</th>
                  <th className="py-3.5 px-4 font-black text-black">Técnico Responsable</th>
                  <th className="py-3.5 px-4 font-black text-black">Progreso</th>
                  <th className="py-3.5 px-4 font-black text-black text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-black">
                {filteredMontajes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-neutral-600 font-mono text-sm">
                      No se encontraron órdenes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredMontajes.map((order) => (
                    <tr key={order.id} className="hover:bg-[#FAF6EE] transition-colors border-b border-black/10">
                      
                      {/* Nro. Registro / Interno */}
                      <td className="py-4 px-4 font-mono whitespace-nowrap">
                        <div className="font-extrabold text-black text-sm">
                          Reg: {order.nro_reg}
                        </div>
                        {order.prioridad === "URGENTE" && (
                          <span className="inline-block mt-1 text-xs text-white bg-[#E76F51] border border-black px-2 py-0.5 rounded-full font-mono font-bold uppercase shadow-[1px_1px_0px_#000]">
                            Urgente
                          </span>
                        )}
                        {order.prioridad === "EXPRESS" && (
                          <span className="inline-block mt-1 text-xs text-black bg-[#FFD23F] border border-black px-2 py-0.5 rounded-full font-mono font-bold uppercase shadow-[1px_1px_0px_#000]">
                            Express
                          </span>
                        )}
                      </td>

                      {/* Cliente, Vendedor y Canal */}
                      <td className="py-4 px-4">
                        <div className="font-heading font-bold text-black text-sm">{order.cliente}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF6EE] border border-black text-xs font-mono font-bold text-black shadow-[1px_1px_0px_#000]">
                            <ShoppingBag className="w-3 h-3 text-black" />
                            {order.vendedor}
                          </span>
                          <span className="text-xs text-neutral-700 font-mono font-semibold">
                            {order.canal}
                          </span>
                        </div>
                      </td>

                      {/* Modalidad y Equipos */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.tipo_servicio === "Montaje" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFD23F] text-black border border-black rounded-full font-mono text-xs font-bold shadow-[1px_1px_0px_#000]">
                              <Cpu className="w-3.5 h-3.5 text-black" />
                              Montaje PC
                            </span>
                            {order.cantidadEquipos > 1 && (
                              <span className="block text-xs text-black font-extrabold font-mono">
                                2 Equipos en lote
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2A9D8F] text-white border border-black rounded-full font-mono text-xs font-bold shadow-[1px_1px_0px_#000]">
                            <Laptop className="w-3.5 h-3.5 text-white" />
                            Expansión Notebook
                          </span>
                        )}
                      </td>

                      {/* Hardware Verificado */}
                      <td className="py-4 px-4 text-neutral-800 max-w-sm">
                        <div className="line-clamp-2 text-xs sm:text-sm leading-relaxed font-medium" title={getHardwareSummary(order)}>
                          {getHardwareSummary(order)}
                        </div>
                        <span className="text-xs text-neutral-600 font-mono font-semibold mt-1 inline-block">
                          {order.componentes.length} piezas verificadas
                        </span>
                      </td>

                      {/* Técnico Responsable */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.tecnico && order.tecnico !== "Sin Asignar" ? (
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-bold text-black flex items-center gap-1.5 text-sm font-heading">
                                <UserCheck className="w-4 h-4 text-[#2A9D8F]" />
                                <span>{order.tecnico}</span>
                              </div>
                              <span className="text-xs text-neutral-700 font-mono font-semibold">Técnico Asignado</span>
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
                              className="text-xs py-1 px-2.5"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-block text-xs font-mono font-bold text-neutral-800 bg-[#FAF6EE] border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
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
                                className="text-xs py-1 px-2.5"
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Progreso */}
                      <td className="py-4 px-4 w-32">
                        <div className="flex items-center justify-between text-xs font-mono font-extrabold mb-1.5 tabular-nums text-black">
                          <span>{order.progreso}%</span>
                        </div>
                        <div className="w-full bg-[#FAF6EE] border-2 border-black rounded-full h-2.5 overflow-hidden shadow-[1px_1px_0px_#000]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              order.progreso === 100 ? "bg-[#2A9D8F]" : "bg-black"
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
                            className="p-2 text-black bg-[#FFFDF9] hover:bg-[#FFD23F] rounded-lg transition-all flex items-center justify-center cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setSelectedOrderForCert(order)}
                            className="p-2 text-black bg-[#FFFDF9] hover:bg-[#FFD23F] rounded-lg transition-all flex items-center justify-center cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                            title="Imprimir Sticker Térmico"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {order.estado.toLowerCase() === "entregado" || order.estado.toLowerCase() === "entregada" ? (
                            <span className="px-3 py-1 bg-neutral-200 text-black border-2 border-black rounded-lg font-mono text-xs font-bold">
                              Entregado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEntregar(order.id)}
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
        </section>

        {/* Modal de Detalle Completo de Orden de Montaje */}
        {/* Modal de Detalle Completo de la Orden (Neo-Brutalismo Retro) */}
        {selectedOrderForDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-[#FFFDF9] rounded-xl max-w-xl w-full p-5 sm:p-6 shadow-[6px_6px_0px_#000] space-y-4 border-2 border-black max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div>
                  <span className="text-[11px] font-mono text-neutral-700 uppercase font-bold tracking-wider">
                    DETALLE DE ORDEN DE MONTAJE &amp; TALLER
                  </span>
                  <h3 className="text-lg font-heading font-extrabold text-black">
                    Orden #{selectedOrderForDetail.id} · {selectedOrderForDetail.cliente}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="text-neutral-500 hover:text-black text-xl font-bold p-1 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Ficha Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-[#FAF6EE] p-3.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Nº Registro Interno:</span>
                  <strong className="text-black font-mono text-sm">{selectedOrderForDetail.nro_reg}</strong>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Vendedor:</span>
                  <span className="text-black font-bold truncate block">{selectedOrderForDetail.vendedor}</span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Canal:</span>
                  <span className="text-neutral-800 font-mono text-[11px] font-semibold">{selectedOrderForDetail.canal}</span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Modalidad:</span>
                  <span className="font-bold text-black">
                    {selectedOrderForDetail.tipo_servicio === "Montaje" ? "Montaje de PC" : "Expansión Notebook"}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Técnico Asignado:</span>
                  <strong className="text-black font-bold">{selectedOrderForDetail.tecnico}</strong>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Prioridad:</span>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border border-black shadow-[1px_1px_0px_#000] ${
                    selectedOrderForDetail.prioridad === "URGENTE"
                      ? "bg-[#E76F51] text-white"
                      : selectedOrderForDetail.prioridad === "EXPRESS"
                      ? "bg-[#FFD23F] text-black"
                      : "bg-[#FFFDF9] text-black"
                  }`}>
                    {selectedOrderForDetail.prioridad}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Fecha de Montaje:</span>
                  <span className="text-black font-mono font-semibold">{selectedOrderForDetail.fecha_montaje}</span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Estado:</span>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border border-black shadow-[1px_1px_0px_#000] ${
                    selectedOrderForDetail.estado === "Entregado"
                      ? "bg-[#2A9D8F] text-white"
                      : "bg-[#FFD23F] text-black"
                  }`}>
                    {selectedOrderForDetail.estado}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-mono text-[10px] uppercase font-bold">Progreso QA:</span>
                  <strong className="text-black font-mono font-extrabold">{selectedOrderForDetail.progreso}%</strong>
                </div>
              </div>

              {/* Componentes Verificados */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-extrabold text-black">
                    Componentes de Hardware ({selectedOrderForDetail.componentes.length} ítems):
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-black/10 border-2 border-black rounded-lg p-2.5 bg-[#FAF6EE] shadow-[2px_2px_0px_#000] space-y-1">
                  {selectedOrderForDetail.componentes.map((c, i) => (
                    <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5">
                      <div className="truncate pr-2">
                        <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#FFD23F] text-black border border-black mr-1.5 shadow-[1px_1px_0px_#000]">
                          {c.categoria}
                        </span>
                        <span className="font-bold text-black" title={c.descripcion}>
                          {formatearNombreComponenteBasico(c.descripcion, c.categoria)}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-neutral-700 shrink-0 font-semibold">
                        SKU: {c.sku} {c.seriales ? `· S/N: ${c.seriales}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              {detailObservaciones && (
                <div className="text-xs space-y-1 bg-[#FFD23F]/20 border-2 border-black p-2.5 rounded-lg shadow-[2px_2px_0px_#000]">
                  <span className="font-heading font-extrabold text-black block text-[10px] uppercase">
                    Instrucciones &amp; Observaciones:
                  </span>
                  <p className="text-neutral-900 text-[11px] leading-relaxed font-medium">
                    {detailObservaciones}
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="pt-3 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="w-full sm:w-auto px-4 py-2 border-2 border-black rounded-lg text-xs font-heading font-extrabold text-black bg-[#FFFDF9] hover:bg-neutral-200 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
                >
                  Cerrar
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <button
                    type="button"
                    disabled={isSendingWhatsApp}
                    onClick={() => void handleSendOrderToWhatsApp(selectedOrderForDetail)}
                    className="px-3.5 py-2 border-2 border-black bg-[#2A9D8F] hover:bg-[#238276] disabled:opacity-50 text-white text-xs font-heading font-extrabold rounded-lg flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
                    title={`Enviar resumen al grupo ${MONTAJES_WHATSAPP_GROUP_ID}`}
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>{isSendingWhatsApp ? "Enviando..." : "Enviar a WhatsApp"}</span>
                  </button>

                  <button
                    onClick={() => {
                      const ord = selectedOrderForDetail;
                      setSelectedOrderForDetail(null);
                      setSelectedOrderForCert(ord);
                    }}
                    className="px-3.5 py-2 border-2 border-black bg-[#FFD23F] hover:bg-yellow-400 text-black text-xs font-heading font-extrabold rounded-lg flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
                  >
                    <Printer className="w-3.5 h-3.5 text-black" />
                    <span>Imprimir Sticker</span>
                  </button>

                  {selectedOrderForDetail.estado.toLowerCase() !== "entregado" &&
                    selectedOrderForDetail.estado.toLowerCase() !== "entregada" && (
                      <button
                        onClick={() => {
                          handleEntregar(selectedOrderForDetail.id);
                        }}
                        className="px-4 py-2 bg-black hover:bg-neutral-800 text-[#FFD23F] text-xs font-heading font-extrabold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
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

          <div className="bg-[#FFFDF9] rounded-xl w-full max-w-lg p-5 shadow-[6px_6px_0px_#000] space-y-4 border-2 border-black max-h-[92dvh] overflow-y-auto overscroll-contain print:w-auto print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-0 print:shadow-none print:rounded-none">

            {/* Cabecera del modal (oculta al imprimir) */}
            <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-3 print:hidden">
              <div className="min-w-0">
                <h2 className="text-base font-heading font-extrabold text-black flex items-center gap-2">
                  <Printer className="w-4 h-4 text-black" />
                  <span>Sticker: {stickerHeaderTitle} · {activeThermalMeta.pageWidthMm}mm</span>
                </h2>
                <p className="text-[11px] text-neutral-700 font-mono font-semibold mt-0.5">
                  {activeThermalMeta.shortLabel} ({activeThermalContentMm}mm útil) · {thermalSettings.scalePct}% · {thermalSettings.highContrast ? "Negro Intenso ON" : "Estándar"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowThermalConfig((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer ${
                    showThermalConfig
                      ? "bg-black text-[#FFD23F]"
                      : "bg-[#FFD23F] text-black hover:bg-yellow-400"
                  }`}
                  title="Calibrar papel, márgenes, escala y oscuridad de tinta"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Calibrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForCert(null)}
                  className="text-neutral-500 hover:text-black p-1.5 rounded-lg hover:bg-neutral-200 cursor-pointer transition-colors"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Panel Colapsable de Calibración de Impresora Térmica */}
            {showThermalConfig && (
              <div className="rounded-xl border-2 border-black bg-[#FAF6EE] p-4 space-y-3.5 text-xs shadow-[3px_3px_0px_#000] print:hidden animate-in fade-in">
                <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                  <span className="font-heading font-extrabold text-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
                    Calibración de Impresora Térmica
                  </span>
                  <button
                    type="button"
                    onClick={() => setThermalSettings(resetThermalPrintSettings())}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-black bg-[#FFFDF9] hover:bg-[#FFD23F] border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3 h-3 text-black" />
                    <span>Restablecer</span>
                  </button>
                </div>

                {/* Ancho de papel */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">
                    Ancho del rollo / cabezal:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(THERMAL_PROFILE_META) as ThermalPaperProfile[]).map((key) => {
                      const active = thermalSettings.paperProfile === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateThermalSetting("paperProfile", key)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-heading border-2 border-black text-center transition-all cursor-pointer ${
                            active
                              ? "bg-black text-[#FFD23F] font-extrabold shadow-[2px_2px_0px_#000]"
                              : "bg-[#FFFDF9] text-black font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                          }`}
                        >
                          {THERMAL_PROFILE_META[key].shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Formato y Márgenes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">
                      Largo de corte:
                    </label>
                    <ThermalLengthSelect
                      value={thermalSettings.lengthMode}
                      onChange={(val) => updateThermalSetting("lengthMode", val)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">
                      Márgenes laterales (X):
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2, 4].map((mm) => (
                        <button
                          key={mm}
                          type="button"
                          onClick={() => updateThermalSetting("marginMm", mm)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono border-2 border-black transition-all cursor-pointer ${
                            thermalSettings.marginMm === mm
                              ? "bg-black text-[#FFD23F] font-bold shadow-[2px_2px_0px_#000]"
                              : "bg-[#FFFDF9] text-black font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                          }`}
                        >
                          {mm}mm
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Escala y Centrados X / Y */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-heading font-bold text-black">Escala:</span>
                      <span className="font-mono font-black text-black">{thermalSettings.scalePct}%</span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={120}
                      step={5}
                      value={thermalSettings.scalePct}
                      onChange={(e) => updateThermalSetting("scalePct", Number(e.target.value))}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-heading font-bold text-black">Posición (X):</span>
                      <span className="font-mono font-black text-black">
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
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-heading font-bold text-black">Subir/Bajar (Y):</span>
                      <span className="font-mono font-black text-black">
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
                      className="w-full accent-black cursor-pointer"
                      title="Desplaza el inicio verticalmente. Valores negativos (-15mm, -25mm) contrarrestan el avance en blanco de la impresora"
                    />
                    <div className="flex items-center justify-between text-[10px] pt-0.5">
                      <button
                        type="button"
                        onClick={() => updateThermalSetting("offsetYMm", -20)}
                        className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                      >
                        Subir -20mm
                      </button>
                      <button
                        type="button"
                        onClick={() => updateThermalSetting("offsetYMm", -10)}
                        className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                      >
                        -10mm
                      </button>
                      <button
                        type="button"
                        onClick={() => updateThermalSetting("offsetYMm", 0)}
                        className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                      >
                        0mm
                      </button>
                    </div>
                  </div>
                </div>

                {/* Opción Bien Negro / Alto Contraste */}
                <div className="pt-2 border-t-2 border-black border-dashed">
                  <label className="flex items-start gap-3 text-xs font-medium text-black cursor-pointer p-3 rounded-lg bg-[#FFFDF9] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FAF6EE] transition-colors">
                    <input
                      type="checkbox"
                      checked={thermalSettings.highContrast}
                      onChange={(e) => updateThermalSetting("highContrast", e.target.checked)}
                      className="rounded border-2 border-black accent-black mt-0.5 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="font-heading font-extrabold text-black block text-xs">
                        Negro Intenso (Ultra Black / Cabezal térmico nítido)
                      </span>
                      <span className="text-[11px] text-neutral-800 leading-tight block mt-0.5 font-medium">
                        Aplica tinta negra pura (#000000), trazo engrosado y bordes sólidos de 2px para que la impresora térmica imprima bien oscuro y legible.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Tip operativo y solución para espacio arriba y saltos en 3nStar / POS-80 */}
                <div className="rounded-lg bg-[#FFD23F]/30 border-2 border-black p-3 text-xs text-black shadow-[2px_2px_0px_#000] space-y-1.5 font-sans">
                  <div className="flex items-center gap-1.5 font-heading font-extrabold text-black">
                    <Info className="w-4 h-4 text-black shrink-0" />
                    <span>Solución a saltos en blanco y espacio arriba (3nStar / POS-80):</span>
                  </div>
                  <ul className="text-[11px] leading-relaxed list-disc list-inside space-y-1 text-black font-medium">
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

                {/* Componentes (Formato Idéntico a Presupuesto) */}
                <div className="py-2 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono font-black uppercase text-black border-b-2 border-black pb-0.5 thermal-label">
                    <span>COMPONENTES ({selectedOrderForCert.componentes.length}):</span>
                    <span>CANT</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    {(() => {
                      const map = new Map<
                        string,
                        { sku: string; nombre: string; categoria: string; cantidad: number }
                      >();
                      for (const c of selectedOrderForCert.componentes) {
                        const nombre = formatearNombreComponenteBasico(c.descripcion, c.categoria);
                        const key = `${c.sku || ""}:::${nombre}`;
                        const existing = map.get(key);
                        if (existing) {
                          existing.cantidad += 1;
                        } else {
                          map.set(key, {
                            sku: c.sku || "",
                            nombre,
                            categoria: c.categoria,
                            cantidad: 1,
                          });
                        }
                      }
                      return Array.from(map.values()).map((item, idx) => (
                        <div key={idx} className="text-[11px] font-mono leading-tight space-y-0.5">
                          <div className="font-black text-black break-words whitespace-normal leading-snug thermal-value">
                            {item.nombre}
                          </div>
                          <div className="text-[10px] text-black/80 font-bold font-mono">
                            <span>
                              {item.sku ? `SKU #${item.sku}` : formatCategoriaSticker(item.categoria)} · Cant: {item.cantidad}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
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
            <div className="pt-3 border-t-2 border-black flex justify-between items-center print:hidden">
              <button
                type="button"
                onClick={() => setSelectedOrderForCert(null)}
                className="px-4 py-2 border-2 border-black rounded-lg text-xs font-heading font-extrabold text-black bg-[#FFFDF9] hover:bg-neutral-200 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-[#FFD23F] hover:bg-yellow-400 text-black border-2 border-black rounded-lg text-xs font-heading font-extrabold flex items-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-black" />
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
