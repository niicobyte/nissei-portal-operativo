"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { HeaderActions } from "@/components/common/HeaderActions";
import {
  Award,
  Printer,
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
  Plus
} from "lucide-react";
import {
  getStoredMontajes,
  fetchMontajesFromMySQL,
  updateMontajeStage,
  updateMontajeTecnico,
  resetMontajes,
  LISTA_TECNICOS_MONTAJE,
  OrdenMontajeReal
} from "@/data/montajesData";
import { getActiveUser } from "@/data/authData";

export default function TecnicosDashboardPage() {
  const [montajes, setMontajes] = useState<OrdenMontajeReal[]>([]);
  const [selectedOrderForCert, setSelectedOrderForCert] = useState<OrdenMontajeReal | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Filtros interactivos
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoServicioFilter, setTipoServicioFilter] = useState<"TODOS" | "Montaje" | "Expansion">("TODOS");
  const [tecnicoFilter, setTecnicoFilter] = useState<string>("TODOS");
  const [vendedorFilter, setVendedorFilter] = useState<string>("TODOS");

  // Carga reactiva de datos reales desde MySQL + LocalStorage (solo con sesión autenticada)
  useEffect(() => {
    const active = getActiveUser();
    if (!active) return;

    setMontajes(getStoredMontajes());
    fetchMontajesFromMySQL().then((dbData) => {
      if (dbData && dbData.length > 0) {
        setMontajes(dbData);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
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

    // Carga por técnico asignado en el portal operativo (Nicolas Solis, Magaly Yegros, Juan Ronnebeck)
    const cargaPorTecnico = LISTA_TECNICOS_MONTAJE.map((tNombre) => {
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

  return (
    <main className="min-h-screen bg-[#fbf9f9] py-6 sm:py-8 2xl:py-12 px-3 sm:px-6 lg:px-8 2xl:px-16">
      <div className="max-w-7xl 2xl:max-w-[1700px] 3xl:max-w-[2200px] mx-auto space-y-6 2xl:space-y-8">
        
        {/* Cabecera unificada */}
        <HeaderActions
          title="Taller de Montajes & Ensambles de PC"
          subtitle="Control integral de armado de PC & Expansiones de notebooks con asignación de técnicos"
          activeModule="tecnicos"
          hideBadge
        />

        {/* 5 KPIs Principales Basados en los Datos Reales de montaje.csv */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 2xl:gap-6">
          
          {/* KPI 1: Total Órdenes */}
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block font-medium">Órdenes en Taller</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalOrdenes}
              </span>
              <span className="text-xs text-zinc-600 font-medium">Registros</span>
            </div>
            <span className="text-[11px] text-zinc-500 block mt-1">Base oficial NISSEI CDE</span>
          </div>

          {/* KPI 2: Montajes de PC (con desglose de equipos) */}
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block font-medium">Montajes de PC</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalEquiposMontados}
              </span>
              <span className="text-xs text-sky-700 font-semibold font-mono">
                {metrics.totalMontajesOrdenes} órdenes
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 block mt-1">
              {metrics.clientesConLote} clientes con 2 equipos
            </span>
          </div>

          {/* KPI 3: Expansiones de Notebook */}
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block font-medium">Expansiones Notebook</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalExpansiones}
              </span>
              <span className="text-xs text-purple-700 font-semibold font-mono">RAM &amp; SSD</span>
            </div>
            <span className="text-[11px] text-zinc-500 block mt-1">SODIMM y discos M.2</span>
          </div>

          {/* KPI 4: Asesores Comerciales Reales */}
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block font-medium">Asesores Comerciales</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.totalVendedores}
              </span>
              <span className="text-xs text-zinc-600 font-medium">Salón &amp; Web</span>
            </div>
            <span className="text-[11px] text-zinc-500 block mt-1">Ventas canalizadas a taller</span>
          </div>

          {/* KPI 5: Canales de Venta */}
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-xs text-zinc-500 block font-medium">Canal Predominante</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.canales.canalTienda}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">Tienda CDE</span>
            </div>
            <span className="text-[11px] text-zinc-500 block mt-1">
              {metrics.canales.canalEmpresas} Empresas · {metrics.canales.canalEcommerce} Web
            </span>
          </div>

        </section>

        {/* Notificación Toast */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border border-zinc-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
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
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, Nº registro interno, hardware..."
                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-zinc-900 focus:bg-white transition-colors"
              />
            </div>

            {/* Filtro por Modalidad: Todos / Montaje / Expansión */}
            <div className="lg:col-span-3 flex items-center gap-2">
              <select
                value={tipoServicioFilter}
                onChange={(e) => setTipoServicioFilter(e.target.value as any)}
                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white text-zinc-900 font-medium outline-none focus:border-zinc-900"
              >
                <option value="TODOS">Todos los Servicios ({montajes.length})</option>
                <option value="Montaje">Montaje de PC Completa ({metrics.totalMontajesOrdenes})</option>
                <option value="Expansion">Expansión / Notebook ({metrics.totalExpansiones})</option>
              </select>
            </div>

            {/* Filtro por Técnico (Nicolas Solis, Magaly Yegros, Juan Ronnebeck) */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <select
                value={tecnicoFilter}
                onChange={(e) => setTecnicoFilter(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white text-zinc-900 font-medium outline-none focus:border-zinc-900"
              >
                <option value="TODOS">Todos los Técnicos</option>
                <option value="Sin Asignar">Sin Asignar ({metrics.sinAsignarCount})</option>
                {LISTA_TECNICOS_MONTAJE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Vendedor */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <select
                value={vendedorFilter}
                onChange={(e) => setVendedorFilter(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white text-zinc-900 font-medium outline-none focus:border-zinc-900"
              >
                <option value="TODOS">Todos los Vendedores</option>
                {listaVendedores.map((vend) => (
                  <option key={vend} value={vend}>
                    {vend}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Tabla de Resultados */}
          <div className="overflow-x-auto border border-zinc-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wide border-b border-zinc-200 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reg. Interno</th>
                  <th className="py-3 px-4 font-semibold">Cliente &amp; Canal</th>
                  <th className="py-3 px-4 font-semibold">Modalidad &amp; Cantidad</th>
                  <th className="py-3 px-4 font-semibold">Hardware Verificado</th>
                  <th className="py-3 px-4 font-semibold">Técnico Responsable</th>
                  <th className="py-3 px-4 font-semibold">Progreso</th>
                  <th className="py-3 px-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900">
                {filteredMontajes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      No se encontraron órdenes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredMontajes.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50/75 transition-colors">
                      
                      {/* Nro. Registro / Interno */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="font-bold text-zinc-900 text-xs">
                          Reg: {order.nro_reg}
                        </div>
                        {order.prioridad === "URGENTE" && (
                          <span className="inline-block mt-1 text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-semibold uppercase">
                            Urgente
                          </span>
                        )}
                        {order.prioridad === "EXPRESS" && (
                          <span className="inline-block mt-1 text-[10px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded font-semibold uppercase">
                            Express
                          </span>
                        )}
                      </td>

                      {/* Cliente, Vendedor y Canal */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900">{order.cliente}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-mono text-zinc-700">
                            <ShoppingBag className="w-2.5 h-2.5" />
                            {order.vendedor}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {order.canal}
                          </span>
                        </div>
                      </td>

                      {/* Modalidad y Equipos */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.tipo_servicio === "Montaje" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded font-mono text-[11px] font-semibold">
                              <Cpu className="w-3 h-3" />
                              Montaje PC
                            </span>
                            {order.cantidadEquipos > 1 && (
                              <span className="block text-[11px] text-sky-900 font-bold font-mono">
                                2 Equipos en lote
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded font-mono text-[11px] font-semibold">
                            <Laptop className="w-3 h-3" />
                            Expansión Notebook
                          </span>
                        )}
                      </td>

                      {/* Hardware Verificado */}
                      <td className="py-3.5 px-4 text-zinc-600 max-w-sm">
                        <div className="line-clamp-2 text-xs leading-relaxed" title={getHardwareSummary(order)}>
                          {getHardwareSummary(order)}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5 inline-block">
                          {order.componentes.length} piezas verificadas
                        </span>
                      </td>

                      {/* Técnico Responsable */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.tecnico && order.tecnico !== "Sin Asignar" ? (
                          <div>
                            <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                              <span>{order.tecnico}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">Técnico Asignado</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-block text-[11px] font-mono text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                              Sin Asignar (Histórico)
                            </span>
                            <div>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) handleAssignTecnico(order.id, e.target.value);
                                }}
                                className="text-[11px] bg-zinc-50 border border-zinc-200 hover:border-zinc-400 rounded px-1.5 py-0.5 text-zinc-700 outline-none"
                              >
                                <option value="" disabled>Asignar técnico...</option>
                                <option value="Nicolas Solis">Nicolas Solis</option>
                                <option value="Magaly Yegros">Magaly Yegros</option>
                                <option value="Juan Ronnebeck">Juan Ronnebeck</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Progreso */}
                      <td className="py-3.5 px-4 w-28">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1 tabular-nums">
                          <span>{order.progreso}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 rounded h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded ${
                              order.progreso === 100 ? "bg-emerald-600" : "bg-zinc-900"
                            }`}
                            style={{ width: `${order.progreso}%` }}
                          />
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrderForCert(order)}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
                          >
                            Certificado QA
                          </button>
                          {order.progreso < 100 && (
                            <button
                              onClick={() => handleAdvanceStage(order.id)}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-black text-white rounded text-xs font-semibold transition-colors"
                            >
                              Avanzar →
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

        {/* Modal Certificado QA */}
        {selectedOrderForCert && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-zinc-200 print:p-0 max-h-[90vh] overflow-y-auto">
              
              <div className="text-center border-b border-zinc-200 pb-4">
                <div className="inline-block px-3 py-1 bg-zinc-900 text-white text-xs font-mono rounded uppercase font-semibold mb-2">
                  NISSEI QUALITY ASSURANCE LABORATORY
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                  CERTIFICADO DE CONFORMIDAD TÉCNICA
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Laboratorio de Montaje &amp; Expansiones · Sucursal Ciudad del Este
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                <div>
                  <span className="text-zinc-500 block">Nº ORDEN / INTERNO:</span>
                  <strong className="text-sm text-zinc-900">
                    {selectedOrderForCert.id} (Reg: {selectedOrderForCert.nro_reg})
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">CLIENTE:</span>
                  <strong className="text-sm text-zinc-900">{selectedOrderForCert.cliente}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">TÉCNICO RESPONSABLE:</span>
                  <strong className="text-sm text-zinc-900">{selectedOrderForCert.tecnico}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">VENDEDOR / CANAL:</span>
                  <strong className="text-sm text-zinc-900">
                    {selectedOrderForCert.vendedor} ({selectedOrderForCert.canal})
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">SERVICIO:</span>
                  <strong className="text-sm text-zinc-900">
                    {selectedOrderForCert.tipo_servicio === "Montaje"
                      ? `Montaje PC (${selectedOrderForCert.cantidadEquipos || 1} Equipos)`
                      : "Expansión Notebook"}
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">ESTADO FINAL:</span>
                  <strong className="text-sm text-emerald-700">APROBADO QA</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-semibold text-zinc-900 block">
                  Componentes Verificados ({selectedOrderForCert.componentes.length} ítems):
                </span>
                <div className="max-h-40 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded p-2 bg-zinc-50/50 space-y-1">
                  {selectedOrderForCert.componentes.map((c, i) => (
                    <div key={i} className="text-[11px] flex justify-between gap-2 pt-1">
                      <span className="font-medium text-zinc-800 truncate">{c.descripcion}</span>
                      <span className="font-mono text-zinc-500 whitespace-nowrap">S/N: {c.seriales}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-dashed border-zinc-300 pt-3 flex items-center justify-between text-xs text-zinc-600">
                <div>
                  <p className="font-bold text-zinc-900">Garantía NISSEI Paraguay</p>
                  <p>12 meses en ensamble y mano de obra técnica.</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span>Firma Digital: </span>
                  <strong className="text-emerald-700">VERIFICADA-SATI</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-between items-center">
                <button
                  onClick={() => setSelectedOrderForCert(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Certificado QA
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
