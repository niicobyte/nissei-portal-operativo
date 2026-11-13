"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Layers,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Printer,
  RotateCcw,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Share2,
  Info,
  Sliders,
  Check,
  Sparkles,
  Search,
  Wrench,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import {
  CATALOGO_PRESUPUESTO_OFICIAL,
  HardwarePresupuestoItem,
  verificarCompatibilidadPC,
  TIPO_CAMBIO_PYG_DEFECTO,
  enriquecerComponente,
} from "@/data/compatibilidadPcData";
import {
  LISTA_VENDEDORES_REALES,
  getStoredVendedores,
  CATALOGO_HARDWARE_REAL,
  ComponenteMontaje,
} from "@/data/montajesData";

// Categorías del ensamble
const SLOTS_CONFIG: Array<{
  categoria: HardwarePresupuestoItem["categoria"];
  nombre: string;
  descripcion: string;
  icono: any;
  obligatorio: boolean;
}> = [
  {
    categoria: "PROCESADOR",
    nombre: "Procesador (CPU)",
    descripcion: "Cerebro del equipo (Intel LGA1700/1851 o AMD AM4/AM5)",
    icono: Cpu,
    obligatorio: true,
  },
  {
    categoria: "PLACA_MADRE",
    nombre: "Placa Madre (Motherboard)",
    descripcion: "Base de interconexión con socket y formato compatible",
    icono: Layers,
    obligatorio: true,
  },
  {
    categoria: "RAM",
    nombre: "Memoria RAM (DDR4 / DDR5)",
    descripcion: "Módulos de alta velocidad y baja latencia",
    icono: Sliders,
    obligatorio: true,
  },
  {
    categoria: "GPU",
    nombre: "Placa de Video (GPU)",
    descripcion: "Gráficos dedicados para gaming, render y diseño",
    icono: Zap,
    obligatorio: false,
  },
  {
    categoria: "ALMACENAMIENTO",
    nombre: "Almacenamiento (SSD NVMe)",
    descripcion: "Unidad ultrarrápida PCIe Gen3/4/5 para sistema y juegos",
    icono: Layers,
    obligatorio: true,
  },
  {
    categoria: "FUENTE",
    nombre: "Fuente de Poder (PSU)",
    descripcion: "Alimentación certificada 80 Plus para estabilidad eléctrica",
    icono: Zap,
    obligatorio: true,
  },
  {
    categoria: "GABINETE",
    nombre: "Gabinete (Chasis)",
    descripcion: "Estructura con flujo de aire optimizado y ventiladores",
    icono: ShoppingBag,
    obligatorio: true,
  },
  {
    categoria: "REFRIGERACION",
    nombre: "Refrigeración / Cooler",
    descripcion: "Cooler de fábrica, aire de alto rendimiento o líquida AIO",
    icono: Wrench,
    obligatorio: true,
  },
];

// Plantillas pre-armadas sugeridas
const PRESETS = [
  {
    id: "OFICINA_PRO",
    nombre: "Oficina & Negocios",
    tag: "Económica & Rápida",
    color: "emerald",
    skus: ["774198", "879268", "769941", "868531", "164052", "100673", "STOCK-COOLER"],
  },
  {
    id: "GAMING_1080P",
    nombre: "Gaming 1080p Ultra",
    tag: "Ryzen 5 + RTX 3060",
    color: "cyan",
    skus: ["120078", "113586", "115445", "161802", "132446", "159652", "158760", "117934"],
  },
  {
    id: "GAMING_1440P",
    nombre: "Gaming 1440p / Streaming",
    tag: "AM5 + RTX 5060 Ti",
    color: "indigo",
    skus: ["127768", "117746", "158216", "153654", "132953", "108532", "131853", "159675"],
  },
  {
    id: "CREATOR_X3D",
    nombre: "Workstation High-End",
    tag: "AM5 X870E + RTX 5070",
    color: "amber",
    skus: ["102643", "154683", "156275", "138249", "153053", "141174", "141341", "151363"],
  },
];

export default function ArmarPcPresupuestadorPage() {
  const router = useRouter();

  // Estados del Presupuesto
  const [vendedores, setVendedores] = useState<string[]>(LISTA_VENDEDORES_REALES);
  const [selectedVendedor, setSelectedVendedor] = useState<string>("Salón de Ventas");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [clienteTelefono, setClienteTelefono] = useState<string>("");
  const [observacionesPresupuesto, setObservacionesPresupuesto] = useState<string>("");
  const [tipoCambio, setTipoCambio] = useState<number>(TIPO_CAMBIO_PYG_DEFECTO);
  const [moneda, setMoneda] = useState<"USD" | "PYG">("USD");
  const [costoMontajeUsd, setCostoMontajeUsd] = useState<number>(0); // 0 = Montaje Bonificado / Gratis

  // Componentes seleccionados en la configuración
  const [selectedComponents, setSelectedComponents] = useState<HardwarePresupuestoItem[]>([]);
  
  // Feedback interactivo
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [activeTabSlot, setActiveTabSlot] = useState<HardwarePresupuestoItem["categoria"] | "TODO">("PROCESADOR");
  const [catalogSearchTerm, setCatalogSearchTerm] = useState<string>("");
  const [onlyCompatible, setOnlyCompatible] = useState<boolean>(true);

  // Inicialización de vendedores
  useEffect(() => {
    setVendedores(getStoredVendedores());
  }, []);

  // Catálogo disponible combinado
  const catalogoCompleto = useMemo(() => {
    return CATALOGO_PRESUPUESTO_OFICIAL;
  }, []);

  // Componente seleccionado por categoría para referencia de socket/RAM
  const currentCpu = useMemo(() => selectedComponents.find((c) => c.categoria === "PROCESADOR"), [selectedComponents]);
  const currentMb = useMemo(() => selectedComponents.find((c) => c.categoria === "PLACA_MADRE"), [selectedComponents]);

  // Verificación reactiva de compatibilidad
  const resultadoCompatibilidad = useMemo(() => {
    return verificarCompatibilidadPC(selectedComponents);
  }, [selectedComponents]);

  // Selección o reemplazo de componente en la configuración
  const handleSelectComponent = (item: HardwarePresupuestoItem) => {
    setSelectedComponents((prev) => {
      // Si ya hay un item de esa categoría (salvo RAM o Almacenamiento que pueden ser múltiples), reemplazamos
      if (item.categoria === "RAM" || item.categoria === "ALMACENAMIENTO") {
        const existingIdx = prev.findIndex((p) => p.sku === item.sku);
        if (existingIdx >= 0) {
          // Si ya existe exactamente el mismo SKU, sumamos cantidad
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            cantidad: (updated[existingIdx].cantidad || 1) + 1,
          };
          return updated;
        }
      }

      const sinMismaCat = prev.filter((p) => {
        if (item.categoria === "RAM" || item.categoria === "ALMACENAMIENTO") {
          return true; // Permitimos más de uno
        }
        return p.categoria !== item.categoria;
      });

      return [...sinMismaCat, { ...item, cantidad: 1 }];
    });
  };

  // Quitar componente
  const handleRemoveComponent = (sku: string) => {
    setSelectedComponents((prev) => prev.filter((c) => c.sku !== sku));
  };

  // Modificar cantidad
  const handleChangeCantidad = (sku: string, delta: number) => {
    setSelectedComponents((prev) =>
      prev
        .map((c) => {
          if (c.sku === sku) {
            const nueva = (c.cantidad || 1) + delta;
            return nueva > 0 ? { ...c, cantidad: nueva } : null;
          }
          return c;
        })
        .filter(Boolean) as HardwarePresupuestoItem[]
    );
  };

  // Cargar Preset
  const handleLoadPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const items = preset.skus
      .map((sku) => catalogoCompleto.find((c) => c.sku === sku))
      .filter(Boolean) as HardwarePresupuestoItem[];

    setSelectedComponents(items.map((i) => ({ ...i, cantidad: 1 })));
  };

  // Limpiar configuración
  const handleReset = () => {
    if (confirm("¿Desea limpiar todos los componentes seleccionados?")) {
      setSelectedComponents([]);
    }
  };

  // Cálculo de totales
  const totalHardwareUsd = useMemo(() => {
    return selectedComponents.reduce((acc, c) => acc + c.precioUsd * (c.cantidad || 1), 0);
  }, [selectedComponents]);

  const totalPresupuestoUsd = totalHardwareUsd + costoMontajeUsd;
  const totalPresupuestoPyg = Math.round(totalPresupuestoUsd * tipoCambio);

  // Filtrado del catálogo en pantalla
  const catalogoFiltrado = useMemo(() => {
    return catalogoCompleto.filter((item) => {
      // 1. Filtro por categoría / slot activo
      if (activeTabSlot !== "TODO" && item.categoria !== activeTabSlot) {
        return false;
      }

      // 2. Filtro de búsqueda por texto / SKU
      if (catalogSearchTerm.trim()) {
        const q = catalogSearchTerm.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchDesc = item.descripcion.toLowerCase().includes(q);
        if (!matchSku && !matchDesc) return false;
      }

      // 3. Filtro inteligente de compatibilidad
      if (onlyCompatible) {
        // Si hay una CPU elegida y estamos viendo placas madre:
        if (item.categoria === "PLACA_MADRE" && currentCpu && currentCpu.socket && currentCpu.socket !== "UNIVERSAL") {
          if (item.socket && item.socket !== "UNIVERSAL" && item.socket !== currentCpu.socket) {
            return false;
          }
        }
        // Si hay una Placa Madre elegida y estamos viendo CPUs:
        if (item.categoria === "PROCESADOR" && currentMb && currentMb.socket && currentMb.socket !== "UNIVERSAL") {
          if (item.socket && item.socket !== "UNIVERSAL" && item.socket !== currentMb.socket) {
            return false;
          }
        }
        // Si hay una Placa Madre elegida y estamos viendo RAMs:
        if (item.categoria === "RAM" && currentMb && currentMb.ramType && currentMb.ramType !== "UNIVERSAL") {
          if (item.ramType && item.ramType !== "UNIVERSAL" && item.ramType !== currentMb.ramType) {
            return false;
          }
        }
      }

      return true;
    });
  }, [catalogoCompleto, activeTabSlot, catalogSearchTerm, onlyCompatible, currentCpu, currentMb]);

  // Generación de texto formal para WhatsApp
  const generarTextoWhatsApp = () => {
    const fechaHoy = new Date().toLocaleDateString("es-PY");
    let text = `🖥️ *PRESUPUESTO DE PC PERSONALIZADA — NISSEI*\n`;
    text += `📅 *Fecha:* ${fechaHoy} · *Vendedor:* ${selectedVendedor}\n`;
    if (clienteNombre.trim()) {
      text += `👤 *Cliente:* ${clienteNombre.trim()}\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `*COMPONENTES SELECCIONADOS:*\n`;
    selectedComponents.forEach((c) => {
      const cant = (c.cantidad || 1) > 1 ? ` (x${c.cantidad})` : "";
      const subUsd = c.precioUsd * (c.cantidad || 1);
      const subGs = Math.round(subUsd * tipoCambio).toLocaleString("es-PY");
      text += `▫️ *[${c.categoria}]* ${c.descripcion}${cant}\n`;
      text += `   ↳ *US$ ${subUsd.toLocaleString()}*  /  ₲ ${subGs}  _(Garantía: ${c.garantiaMeses} meses)_\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⚡ *Consumo Estimado:* ${resultadoCompatibilidad.consumoTotalWatts}W\n`;
    text += `🔌 *Fuente Recomendada:* ${resultadoCompatibilidad.fuenteRecomendadaWatts}W+\n`;
    text += `🛠️ *Servicio de Armado, Cable Management & QA:* ${costoMontajeUsd === 0 ? "¡BONIFICADO / GRATIS!" : `US$ ${costoMontajeUsd}`}\n`;
    text += `💰 *TOTAL GENERAL:*\n`;
    text += `👉 *US$ ${totalPresupuestoUsd.toLocaleString()} Dólares*\n`;
    text += `👉 *₲ ${totalPresupuestoPyg.toLocaleString("es-PY")} Guaraníes*\n\n`;

    if (resultadoCompatibilidad.compatible) {
      text += `✅ *Compatibilidad de Hardware:* 100% Verificado y Certificado por Taller de Montajes NISSEI.\n`;
    } else {
      text += `⚠️ *Nota Técnica:* Revisar compatibilidad antes de facturar.\n`;
    }
    text += `🛡️ *Garantía NISSEI:* Componentes oficiales con garantía local y servicio técnico en Asunción.\n`;
    text += `📍 *NISSEI Asunción & CDE* · Precios válidos por 5 días o hasta agotar stock.`;

    return text;
  };

  const handleCopyWhatsApp = () => {
    const txt = generarTextoWhatsApp();
    navigator.clipboard.writeText(txt);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Convertir a Orden de Montaje Oficial en /tecnicos/nuevo
  const handleCrearOrdenMontaje = () => {
    if (selectedComponents.length === 0) {
      alert("Agregue al menos un componente al presupuesto para generar la orden.");
      return;
    }

    const payload = {
      cliente: clienteNombre || "Cliente Presupuesto",
      vendedor: selectedVendedor,
      canal: "Tienda",
      tipoServicio: "Montaje",
      consumoEstimado: `${resultadoCompatibilidad.consumoTotalWatts}W`,
      observaciones: observacionesPresupuesto || `Presupuesto armado el ${new Date().toLocaleDateString("es-PY")}. Consumo estimado: ${resultadoCompatibilidad.consumoTotalWatts}W.`,
      componentes: selectedComponents.map((c) => ({
        sku: c.sku,
        descripcion: c.descripcion,
        seriales: "Pendiente de facturación / escaneo",
        categoria: c.categoria,
      })),
    };

    try {
      sessionStorage.setItem("nissei_presupuesto_export_v1", JSON.stringify(payload));
      router.push("/tecnicos/nuevo?from=presupuesto");
    } catch {
      router.push("/tecnicos/nuevo");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Barra Superior con Navegación y Acciones Rápidas */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Volver a la pantalla de Acceso"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                <Wrench className="w-4 h-4" />
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Configurador &amp; Presupuestador de PC
              </h1>
              <span className="hidden md:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                HARDWARE COMPATIBLE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Herramienta oficial para vendedores NISSEI · Verificación de sockets, RAM y fuentes en tiempo real
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2">
          {/* Selector de Moneda */}
          <div className="flex items-center bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-700 text-xs font-mono">
            <button
              type="button"
              onClick={() => setMoneda("USD")}
              className={`px-2 py-1 rounded transition-colors ${
                moneda === "USD" ? "bg-cyan-600 text-white font-bold" : "text-zinc-400 hover:text-white"
              }`}
            >
              USD $
            </button>
            <button
              type="button"
              onClick={() => setMoneda("PYG")}
              className={`px-2 py-1 rounded transition-colors ${
                moneda === "PYG" ? "bg-cyan-600 text-white font-bold" : "text-zinc-400 hover:text-white"
              }`}
            >
              PYG ₲
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyWhatsApp}
            disabled={selectedComponents.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              copiedSuccess
                ? "bg-emerald-600 text-white"
                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {copiedSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedSuccess ? "¡Copiado!" : "Copiar WhatsApp"}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={selectedComponents.length === 0}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
            title="Imprimir presupuesto en formato formal"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </header>

      {/* Contenedor Principal: 2 Columnas (Catálogo / Selector vs Resumen Presupuesto) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Columna Izquierda: Configurador y Catálogo de Componentes (7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          
          {/* Ficha de Datos del Vendedor y Cliente */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                Datos de la Cotización
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Vendedor Asignado
                </label>
                <select
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500"
                >
                  <option value="Salón de Ventas">Salón de Ventas CDE / ASU</option>
                  {vendedores.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Marcelo Gomez..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Ej: +595 981 123456..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Plantillas Rápidas de Ensambles Recomendados */}
            <div className="pt-2 border-t border-zinc-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
                ⚡ Plantillas de Ensamble Rápido:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleLoadPreset(p.id)}
                    className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-cyan-500/80 text-left transition-all group cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-white block truncate group-hover:text-cyan-400">
                      {p.nombre}
                    </span>
                    <span className="text-[9px] text-zinc-500 block truncate">
                      {p.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ranuras Principales del Ensamble */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Ranuras de Hardware &amp; Componentes
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-zinc-400 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyCompatible}
                    onChange={(e) => setOnlyCompatible(e.target.checked)}
                    className="accent-cyan-500 rounded"
                  />
                  <span>Filtrar solo compatibles</span>
                </label>
              </div>
            </div>

            {/* Pestañas de Ranuras */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {SLOTS_CONFIG.map((slot) => {
                const Icon = slot.icono;
                const isSelected = activeTabSlot === slot.categoria;
                const hasItem = selectedComponents.some((c) => c.categoria === slot.categoria);
                return (
                  <button
                    key={slot.categoria}
                    type="button"
                    onClick={() => setActiveTabSlot(slot.categoria)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500 text-zinc-950 font-bold shadow-sm"
                        : hasItem
                        ? "bg-zinc-900 border border-cyan-800/60 text-cyan-300 hover:bg-zinc-800"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{slot.nombre.split(" ")[0]}</span>
                    {hasItem && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActiveTabSlot("TODO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTabSlot === "TODO"
                    ? "bg-cyan-500 text-zinc-950 font-bold shadow-sm"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Ver Todo
              </button>
            </div>
          </div>

          {/* Buscador en Catálogo */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={catalogSearchTerm}
              onChange={(e) => setCatalogSearchTerm(e.target.value)}
              placeholder="Buscar por SKU, marca, procesador, modelo..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3.5 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-500 transition-colors"
            />
            {catalogSearchTerm && (
              <button
                type="button"
                onClick={() => setCatalogSearchTerm("")}
                className="absolute right-3 top-2 text-xs text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de Componentes Disponibles en Catálogo */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/80 max-h-[460px] overflow-y-auto">
            {catalogoFiltrado.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 space-y-2">
                <Info className="w-6 h-6 mx-auto opacity-40 text-cyan-400" />
                <p className="text-xs">
                  No se encontraron componentes compatibles con los filtros aplicados.
                </p>
                {onlyCompatible && (
                  <button
                    type="button"
                    onClick={() => setOnlyCompatible(false)}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Desactivar filtro estricto de compatibilidad
                  </button>
                )}
              </div>
            ) : (
              catalogoFiltrado.map((item) => {
                const isSelected = selectedComponents.some((c) => c.sku === item.sku);
                const precioPyg = Math.round(item.precioUsd * tipoCambio);

                return (
                  <div
                    key={item.sku}
                    className={`p-3 transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-cyan-950/30 border-l-4 border-l-cyan-500"
                        : "hover:bg-zinc-850/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          SKU {item.sku}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase">
                          {item.categoria}
                        </span>
                        {item.socket && item.socket !== "UNIVERSAL" && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                            {item.socket}
                          </span>
                        )}
                        {item.ramType && item.ramType !== "UNIVERSAL" && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                            {item.ramType}
                          </span>
                        )}
                        {item.tdpWatts ? (
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {item.tdpWatts}W
                          </span>
                        ) : null}
                      </div>

                      <h4 className="text-xs font-semibold text-zinc-200 line-clamp-2">
                        {item.descripcion}
                      </h4>

                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-1">
                        <span>Garantía: {item.garantiaMeses} meses</span>
                        {item.hasIGpu === false && (
                          <span className="text-amber-400 font-semibold">
                            ⚠️ Requiere GPU dedicada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Precios y Botón de Selección */}
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className="text-sm font-extrabold font-mono text-white block">
                          US$ {item.precioUsd.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 block">
                          ₲ {precioPyg.toLocaleString("es-PY")}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectComponent(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500 text-zinc-950 hover:bg-cyan-400 shadow-sm"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700"
                        }`}
                      >
                        {isSelected ? "Agregado ✓" : "+ Agregar"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Columna Derecha: Hoja de Presupuesto en Vivo & Compatibilidad (5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          
          {/* Tarjeta de Resumen del Ensamble */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm sticky top-16">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>Presupuesto de PC</span>
                  <span className="text-xs font-mono font-normal text-zinc-400">
                    ({selectedComponents.length} componentes)
                  </span>
                </h3>
                <span className="text-[11px] text-zinc-400 block">
                  {clienteNombre ? `Cliente: ${clienteNombre}` : "Ensamble a medida"}
                </span>
              </div>

              {/* Estado de Compatibilidad General */}
              <div
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
                  resultadoCompatibilidad.compatible
                    ? "bg-emerald-950/60 border-emerald-600 text-emerald-300"
                    : "bg-rose-950/60 border-rose-600 text-rose-300 animate-pulse"
                }`}
              >
                {resultadoCompatibilidad.compatible ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Compatible 100%</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Incompatibilidad</span>
                  </>
                )}
              </div>
            </div>

            {/* Alertas de Compatibilidad */}
            {resultadoCompatibilidad.alertas.length > 0 && (
              <div className="space-y-1.5">
                {resultadoCompatibilidad.alertas.map((a, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs ${
                      a.tipo === "ERROR"
                        ? "bg-rose-950/40 border-rose-700/80 text-rose-200"
                        : a.tipo === "WARNING"
                        ? "bg-amber-950/40 border-amber-700/80 text-amber-200"
                        : "bg-cyan-950/40 border-cyan-700/80 text-cyan-200"
                    }`}
                  >
                    <strong className="block font-bold">{a.titulo}</strong>
                    <p className="text-[11px] opacity-90 mt-0.5">{a.detalle}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Barra de Consumo Eléctrico & Fuente */}
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Consumo Estimado:
                </span>
                <span className="font-bold text-white">
                  {resultadoCompatibilidad.consumoTotalWatts} W
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Fuente Recomendada:</span>
                <span className="font-bold text-cyan-400">
                  {resultadoCompatibilidad.fuenteRecomendadaWatts} W+
                </span>
              </div>
            </div>

            {/* Lista de Componentes Cargados */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {selectedComponents.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  <p className="text-xs">
                    Ningún componente seleccionado aún. Seleccione componentes del catálogo o elija una plantilla de ensamble rápido.
                  </p>
                </div>
              ) : (
                selectedComponents.map((c) => {
                  const subUsd = c.precioUsd * (c.cantidad || 1);
                  const subPyg = Math.round(subUsd * tipoCambio);
                  return (
                    <div
                      key={c.sku}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/90 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase">
                            {c.categoria}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">
                            #{c.sku}
                          </span>
                        </div>
                        <h5 className="font-medium text-zinc-200 line-clamp-1">
                          {c.descripcion}
                        </h5>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                          <span>
                            US$ {c.precioUsd} {c.cantidad && c.cantidad > 1 ? `x ${c.cantidad}` : ""}
                          </span>
                          <span>·</span>
                          <span>Garantía: {c.garantiaMeses}m</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-white block">
                          US$ {subUsd.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, -1)}
                            className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs px-1 text-zinc-200">
                            {c.cantidad || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, 1)}
                            className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(c.sku)}
                            className="w-5 h-5 rounded hover:bg-rose-950 text-zinc-500 hover:text-rose-400 text-xs flex items-center justify-center ml-1"
                            title="Quitar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Servicio de Armado & Garantía de Ensamble */}
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Servicio de Montaje &amp; QA:</span>
                <select
                  value={costoMontajeUsd}
                  onChange={(e) => setCostoMontajeUsd(Number(e.target.value))}
                  className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
                >
                  <option value={0}>¡Bonificado / GRATIS!</option>
                  <option value={15}>Básico (US$ 15)</option>
                  <option value={25}>Avanzado + AIO (US$ 25)</option>
                  <option value={40}>Custom Loop / Express (US$ 40)</option>
                </select>
              </div>

              {/* Resumen Total */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-cyan-800/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-zinc-400">Total en Dólares:</span>
                  <span className="text-xl font-black font-mono text-white">
                    US$ {totalPresupuestoUsd.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono">Total en Guaraníes:</span>
                  <span className="font-mono font-bold text-cyan-400">
                    ₲ {totalPresupuestoPyg.toLocaleString("es-PY")}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 block pt-1 border-t border-zinc-900 font-mono">
                  TC Ref: {tipoCambio.toLocaleString()} Gs/USD · IVA 10% Incluido
                </span>
              </div>

              {/* Botón Convertir en Orden Oficial */}
              <button
                type="button"
                onClick={handleCrearOrdenMontaje}
                disabled={selectedComponents.length === 0}
                className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-zinc-950 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Generar Orden de Montaje Oficial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </section>

      </main>

      {/* Pie de Página */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-3 text-center text-xs text-zinc-500 font-mono">
        NISSEI Tech Service Ops · Sistema Integrado de Presupuestos de PC &amp; Montajes
      </footer>
    </div>
  );
}
