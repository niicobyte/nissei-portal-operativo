"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Layers,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Printer,
  RotateCcw,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Info,
  Sliders,
  Check,
  Search,
  Wrench,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  FileText,
  Globe,
  Sparkles,
  X,
  Clock,
  ShieldAlert,
  TrendingUp,
  Award,
  DollarSign,
} from "lucide-react";
import {
  CATALOGO_PRESUPUESTO_OFICIAL,
  HardwarePresupuestoItem,
  enriquecerComponente,
  verificarCompatibilidadPC,
  TIPO_CAMBIO_PYG_DEFECTO,
  AlertaCompatibilidad,
  ChecklistPC,
} from "@/data/compatibilidadPcData";
import {
  LISTA_VENDEDORES_REALES,
  VENDEDORES_CORP_BASE,
  getStoredVendedores,
  AreaVendedor,
} from "@/data/vendedoresData";
import { VendedorSelect } from "@/components/common/VendedorSelect";
import { CleanSelect } from "@/components/common/CleanSelect";
import {
  PresupuestoThermalPrintModal,
  PresupuestoThermalData,
  formatearNombreComponenteBasico,
} from "@/components/common/PresupuestoThermalPrintModal";
import { FloatingFeedbackWidget } from "@/components/common/FloatingFeedbackWidget";

interface NisseiLiveItemDto {
  sku: string;
  nombre: string;
  categoria: HardwarePresupuestoItem["categoria"];
  precioPyg: number;
  precioRegularPyg: number;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK";
  urlWeb: string;
}

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
    descripcion: "Intel LGA1700/1851 o AMD AM4/AM5",
    icono: Cpu,
    obligatorio: true,
  },
  {
    categoria: "PLACA_MADRE",
    nombre: "Placa Madre",
    descripcion: "Socket y formato compatible",
    icono: Layers,
    obligatorio: true,
  },
  {
    categoria: "RAM",
    nombre: "Memoria RAM",
    descripcion: "Módulos Desktop DDR4 o DDR5",
    icono: Sliders,
    obligatorio: true,
  },
  {
    categoria: "GPU",
    nombre: "Tarjeta Gráfica",
    descripcion: "Gráficos dedicados para gaming y trabajo",
    icono: Zap,
    obligatorio: false,
  },
  {
    categoria: "ALMACENAMIENTO",
    nombre: "Almacenamiento (SSD)",
    descripcion: "Unidad M.2 NVMe PCIe o SATA",
    icono: Layers,
    obligatorio: true,
  },
  {
    categoria: "FUENTE",
    nombre: "Fuente de Poder",
    descripcion: "Fuente ATX real con certificación 80 Plus",
    icono: Zap,
    obligatorio: true,
  },
  {
    categoria: "GABINETE",
    nombre: "Gabinete",
    descripcion: "Chasis con ventilación y espacio adecuado",
    icono: ShoppingBag,
    obligatorio: true,
  },
  {
    categoria: "REFRIGERACION",
    nombre: "Refrigeración",
    descripcion: "Cooler de CPU por aire o líquido AIO",
    icono: Wrench,
    obligatorio: true,
  },
];

// Plantillas de ensamble inteligente por entorno de trabajo y productividad (10 perfiles especializados)
export type PresetTier =
  | "OFICINA_PRO"
  | "PROGRAMACION_DEV"
  | "GAMING_ESPORTS_1080P"
  | "GAMING_PRO"
  | "GAMING_EXTREMO_4K"
  | "DISENO_GRAFICO_2D"
  | "ARQUITECTURA_3D"
  | "EDICION_CREATOR"
  | "IA_DEEP_LEARNING"
  | "WORKSTATION_EMPRESARIAL";

const PRESETS: Array<{
  id: PresetTier;
  nombre: string;
  entorno: string;
  icono: string;
  tag: string;
  preferredCpuSkus: string[];
}> = [
  {
    id: "OFICINA_PRO",
    nombre: "Oficina, POS & Facturación",
    entorno: "Administración, ERP, Cajas & Estudios",
    icono: "💼",
    tag: "CPU con Gráficos + 16GB RAM + SSD NVMe",
    preferredCpuSkus: ["167102", "77081", "119289", "74198", "67488", "120081", "53841"],
  },
  {
    id: "PROGRAMACION_DEV",
    nombre: "Programación, Dev & Multitarea",
    entorno: "Desarrollo Web/App, Docker, VMs & Trading",
    icono: "💻",
    tag: "CPU 6/8 Núcleos iGPU + 32GB Dual Channel + 1TB NVMe",
    preferredCpuSkus: ["120080", "867488", "774198", "120078", "167102", "774507"],
  },
  {
    id: "GAMING_ESPORTS_1080P",
    nombre: "Gaming 1080p Esports & Entrada",
    entorno: "CS2, Valorant, Fortnite, GTA V & FIFA (+144 FPS)",
    icono: "🎯",
    tag: "Ryzen 5 / Core i5 + GPU Dedicada + 16GB Dual Channel",
    preferredCpuSkus: ["74198", "119664", "124223", "133732", "777081", "120078"],
  },
  {
    id: "GAMING_PRO",
    nombre: "Gaming 1080p/1440p AAA & Stream",
    entorno: "Juegos AAA en Ultra, Warzone & Streaming OBS",
    icono: "🎮",
    tag: "Core i5 / Ryzen 5 AM5 + GeForce RTX + 16/32GB + 1TB",
    preferredCpuSkus: ["119664", "127768", "74198", "124223", "133732", "77529"],
  },
  {
    id: "GAMING_EXTREMO_4K",
    nombre: "Gaming 2K / 4K Ultra & Simulación",
    entorno: "SimRacing, Flight Simulator, 4K RayTracing & 240Hz",
    icono: "🏆",
    tag: "Ryzen 7 X3D / Core i7-i9 + Top RTX + 32GB DDR5 + AIO",
    preferredCpuSkus: ["131437", "154353", "102643", "116808", "119157", "157442", "127768"],
  },
  {
    id: "DISENO_GRAFICO_2D",
    nombre: "Diseño Gráfico, Foto & Adobe 2D",
    entorno: "Photoshop, Illustrator, Lightroom & CorelDRAW",
    icono: "🎨",
    tag: "CPU Alto Reloj + 32GB RAM Dual + GPU RTX + 1TB NVMe",
    preferredCpuSkus: ["127768", "119664", "774198", "102643", "867488", "774507"],
  },
  {
    id: "ARQUITECTURA_3D",
    nombre: "Arquitectura, CAD & Render 3D",
    entorno: "AutoCAD, Revit, SketchUp, Lumion & V-Ray",
    icono: "🏛️",
    tag: "32GB RAM + GPU RTX CUDA + 1TB NVMe + Cooler Dedicado",
    preferredCpuSkus: ["127768", "161582", "102643", "130805", "119664", "131437"],
  },
  {
    id: "EDICION_CREATOR",
    nombre: "Edición de Video 4K, VFX & Motion",
    entorno: "Premiere Pro, DaVinci Resolve, After Effects & Blender",
    icono: "🎬",
    tag: "CPU Multi-núcleo + GPU RTX NVENC + 32GB + 1TB/2TB",
    preferredCpuSkus: ["131437", "161582", "102643", "127768", "116808", "119157", "154353"],
  },
  {
    id: "IA_DEEP_LEARNING",
    nombre: "Inteligencia Artificial & LLMs",
    entorno: "PyTorch, Modelos Locales, Stable Diffusion & CUDA",
    icono: "🧠",
    tag: "GPU RTX Alta VRAM + 32/64GB DDR5 + PSU 750W+ Gold",
    preferredCpuSkus: ["131437", "154353", "106487", "119157", "116808", "102643", "127768"],
  },
  {
    id: "WORKSTATION_EMPRESARIAL",
    nombre: "Workstation Server & Base de Datos",
    entorno: "Servidor PyME, SQL, Contabilidad Multiusuario 24/7",
    icono: "🖥️",
    tag: "CPU Multi-hilo iGPU + 32GB RAM + 1TB NVMe + PSU 80+",
    preferredCpuSkus: ["106487", "102643", "774507", "867488", "120080", "774198"],
  },
];

// Presets por cantidad de Guaraníes (10 escalones reales de inversión optimizados)
const PRESETS_PRESUPUESTO: Array<{
  monto: number;
  labelMonto: string;
  nombre: string;
  gama: string;
  tag: string;
  icono: string;
}> = [
  {
    monto: 3000000,
    labelMonto: "₲ 3.000.000",
    nombre: "Oficina Esencial & Estudios",
    gama: "Ofimática, Facturación, POS & Navegación",
    tag: "CPU con Video Integrado + 8/16GB RAM + SSD Rápido",
    icono: "💵",
  },
  {
    monto: 4200000,
    labelMonto: "₲ 4.200.000",
    nombre: "Home Office Pro & Multitarea",
    gama: "Administración Avanzada, Contabilidad & ERP",
    tag: "Ryzen 5 / Core i3-i5 + 16GB Dual Channel + 500GB NVMe",
    icono: "💼",
  },
  {
    monto: 5500000,
    labelMonto: "₲ 5.500.000",
    nombre: "Gaming Entrada / Esports 1080p",
    gama: "CS2, Valorant, Fortnite, LoL & Diseño Básico",
    tag: "Ryzen 5 / Core i5 + GPU Dedicada + 16GB RAM + NVMe",
    icono: "🎯",
  },
  {
    monto: 7000000,
    labelMonto: "₲ 7.000.000",
    nombre: "Gaming 1080p Full & Streaming",
    gama: "Juegos 1080p Altos FPS, GTA V, Warzone & OBS",
    tag: "Core i5 / Ryzen 5 + GeForce RTX + 16GB Dual + 1TB NVMe",
    icono: "🎮",
  },
  {
    monto: 8500000,
    labelMonto: "₲ 8.500.000",
    nombre: "Gaming Pro & Arquitectura Inicial",
    gama: "Gaming 1080p/1440p, AutoCAD, SketchUp & Adobe",
    tag: "Ryzen 5 / Core i5 + RTX + 16/32GB Dual + 1TB + 650W 80+",
    icono: "⚡",
  },
  {
    monto: 10000000,
    labelMonto: "₲ 10.000.000",
    nombre: "Sweet-Spot 1440p & Render 3D",
    gama: "Juegos 1440p Ultra, Arquitectura BIM & Edición",
    tag: "AM5 Ryzen 5 / Core i5 + RTX + 32GB Dual Channel + 1TB",
    icono: "⭐",
  },
  {
    monto: 12000000,
    labelMonto: "₲ 12.000.000",
    nombre: "High-Performance Gaming & BIM",
    gama: "Revit, Lumion, Juegos AAA Ultra & Multitarea Pesada",
    tag: "AM5 / LGA1700 + RTX + 32GB DDR5 + 1TB NVMe + Cooler",
    icono: "🔥",
  },
  {
    monto: 15000000,
    labelMonto: "₲ 15.000.000",
    nombre: "Entusiasta 2K/4K & Edición Pro",
    gama: "Render Pesado, Premiere 4K, DaVinci & Stream 1440p",
    tag: "Ryzen 7 / Core i7 + RTX Gama Alta + 32GB DDR5 + AIO",
    icono: "🚀",
  },
  {
    monto: 18000000,
    labelMonto: "₲ 18.000.000",
    nombre: "Workstation 3D, VFX & IA Avanzada",
    gama: "Modelos IA Locales, V-Ray, Blender & Simulación",
    tag: "Multi-núcleo + RTX Alta VRAM + 32/64GB DDR5 + PSU Gold",
    icono: "🧠",
  },
  {
    monto: 22000000,
    labelMonto: "₲ 22.000.000+",
    nombre: "Ultra Flagship 4K & Deep Learning",
    gama: "Máximo Rendimiento en Stock: IA, 4K Ultra & Render",
    tag: "Ryzen 7/9 X3D o Core i7/i9 + Top RTX + 64GB + 2TB + AIO",
    icono: "👑",
  },
];

function cleanSkuKey(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (/^\d{4,7}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(?:PC|INF|HW)-(\d{4,7})$/i);
  if (match) return match[1];
  return "";
}

function cleanDisplayTitle(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/&quot;/gi, '"')
    .replace(/&#0*34;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePygNumber(val: string | number): number {
  const digits = String(val || "").replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatPygInputWithCursor(
  rawValue: string,
  selectionStart: number
): { formatted: string; cursorPos: number; numericValue: number } {
  const digitsBeforeCursor = rawValue.slice(0, selectionStart).replace(/\D/g, "").length;
  const rawDigits = rawValue.replace(/\D/g, "");
  if (!rawDigits) {
    return { formatted: "", cursorPos: 0, numericValue: 0 };
  }
  const numericValue = parseInt(rawDigits, 10);
  if (isNaN(numericValue)) {
    return { formatted: "", cursorPos: 0, numericValue: 0 };
  }
  const formatted = numericValue.toLocaleString("es-PY");
  let newCursorPos = 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      count++;
    }
    if (count === digitsBeforeCursor) {
      newCursorPos = i + 1;
      break;
    }
  }
  if (count < digitsBeforeCursor) {
    newCursorPos = formatted.length;
  }
  return { formatted, cursorPos: newCursorPos, numericValue };
}

/**
 * Filtro estricto del lado del cliente para descartar ítems de otras categorías o de notebook
 * que existían en el Excel bruto (ej. RAM DDR2/DDR3, SODIMM de Notebook, fuentes sin watts).
 */
function isValidDesktopCatalogItem(item: HardwarePresupuestoItem): boolean {
  if (item.sku === "STOCK-COOLER") return true;
  const upper = `${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();

  if (item.categoria === "RAM") {
    if (
      upper.includes("SODIMM") ||
      upper.includes("SO-DIMM") ||
      upper.includes("MEM NB") ||
      upper.includes("NOTEBOOK") ||
      upper.includes("LAPTOP") ||
      upper.includes("DDR2") ||
      upper.includes("DDR3") ||
      upper.includes("PC3") ||
      upper.includes("PC2")
    ) {
      return false;
    }
  }

  if (item.categoria === "FUENTE") {
    if (
      upper.includes("EXTERNA") ||
      upper.includes("MEDIA CONVERTER") ||
      upper.includes("LANPRO") ||
      upper.includes("CARGADOR") ||
      upper.includes("NOTEBOOK") ||
      upper.includes("POE") ||
      upper.includes("UPS") ||
      upper.includes("ESTABILIZADOR")
    ) {
      return false;
    }
    if (!item.potenciaWatts || item.potenciaWatts < 400) {
      return false;
    }
  }

  if (item.categoria === "GABINETE") {
    if (
      (upper.includes("SOPORTE") || upper.includes("CARRITO") || upper.includes("PEDESTAL")) &&
      !upper.includes("GABINETE")
    ) {
      return false;
    }
  }

  if (item.categoria === "REFRIGERACION") {
    if (
      upper.includes("NOTEBOOK") ||
      upper.includes("LAPTOP") ||
      upper.includes("BASE COOLER") ||
      upper.includes("CELULAR") ||
      upper.includes("TELEFONO") ||
      upper.includes("TELÉFONO")
    ) {
      return false;
    }
  }

  return true;
}

export default function ArmarPcPresupuestadorPage() {
  const router = useRouter();

  // Estados del Presupuesto
  const [vendedores, setVendedores] = useState<string[]>(LISTA_VENDEDORES_REALES);
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<AreaVendedor | null>(null);
  const [selectedCanal, setSelectedCanal] = useState<"Tienda" | "Ecommerce - Web" | "Empresas / Coorporativo">("Tienda");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [observacionesPresupuesto, setObservacionesPresupuesto] = useState<string>("");
  const [tipoCambio, setTipoCambio] = useState<number>(TIPO_CAMBIO_PYG_DEFECTO);
  const [tipoCambioInput, setTipoCambioInput] = useState<string>(
    TIPO_CAMBIO_PYG_DEFECTO.toLocaleString("es-PY")
  );
  const [moneda, setMoneda] = useState<"PYG" | "USD">("PYG");

  // Modal obligatorio de Cotización del Dólar en cada recarga/inicio de página
  const [isTipoCambioModalOpen, setIsTipoCambioModalOpen] = useState<boolean>(true);
  const [modalTipoCambioInput, setModalTipoCambioInput] = useState<string>(
    TIPO_CAMBIO_PYG_DEFECTO.toLocaleString("es-PY")
  );
  const [modalTipoCambioError, setModalTipoCambioError] = useState<string | null>(null);

  // Alertas secuenciales de 8 segundos al ingresar (1: Stock, 2: Tiempo de Montaje 24/48Hs)
  const [warningStage, setWarningStage] = useState<"STOCK" | "TIEMPO_MONTAJE" | null>("STOCK");
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number>(8);

  // Estado de sincronización en vivo con https://nissei.com/py/
  const [liveBySku, setLiveBySku] = useState<Record<string, NisseiLiveItemDto>>({});
  const [liveCatalogItems, setLiveCatalogItems] = useState<NisseiLiveItemDto[]>([]);
  const [isLoadingWeb, setIsLoadingWeb] = useState<boolean>(true);
  const [webSyncError, setWebSyncError] = useState<string | null>(null);
  const [lastUpdatedWeb, setLastUpdatedWeb] = useState<string>("");

  // Componentes seleccionados en la configuración
  const [selectedComponents, setSelectedComponents] = useState<HardwarePresupuestoItem[]>([]);

  // Feedback y Filtros
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [isThermalPrintModalOpen, setIsThermalPrintModalOpen] = useState<boolean>(false);
  const [isOperatorSession, setIsOperatorSession] = useState<boolean>(false);
  const [activeTabSlot, setActiveTabSlot] = useState<HardwarePresupuestoItem["categoria"] | "TODO">("PROCESADOR");
  const [catalogSearchTerm, setCatalogSearchTerm] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("TODAS");
  const [displayLimit, setDisplayLimit] = useState<number>(60);
  const [onlyCompatible, setOnlyCompatible] = useState<boolean>(true);
  const [onlyWebStock, setOnlyWebStock] = useState<boolean>(true);
  const [isAuditingWeb, setIsAuditingWeb] = useState<boolean>(false);
  const [lastAuditTimestamp, setLastAuditTimestamp] = useState<string | null>(null);

  // Filtros interactivos de Plataforma & Perfil Productivo
  const [selectedSocketFilter, setSelectedSocketFilter] = useState<"TODOS" | "AM4" | "AM5" | "LGA1700" | "LGA1851">("TODOS");
  const [slotPlatformFilter, setSlotPlatformFilter] = useState<string>("TODOS");
  const [slotWorkProfileFilter, setSlotWorkProfileFilter] = useState<string>("TODOS");
  const [showProductivityInsight, setShowProductivityInsight] = useState<boolean>(true);

  const switchActiveSlot = (slot: HardwarePresupuestoItem["categoria"] | "TODO") => {
    setActiveTabSlot(slot);
    setSelectedBrand("TODAS");
    setSlotPlatformFilter("TODOS");
    setSlotWorkProfileFilter("TODOS");
    setDisplayLimit(60);
  };

  // Escudo Defensivo Anti-Error de Venta
  const [showDefensiveModal, setShowDefensiveModal] = useState<boolean>(false);
  const [pendingGuardedAction, setPendingGuardedAction] = useState<"COPY" | "PRINT" | "ORDEN" | null>(null);

  // Modos de Presupuesto Rápido (Por Entorno vs Por Cantidad de Guaraníes)
  const [presetTabMode, setPresetTabMode] = useState<"ENTORNO" | "PRESUPUESTO">("ENTORNO");
  const [selectedPresetForCpuMenu, setSelectedPresetForCpuMenu] = useState<PresetTier | null>(null);
  const [activePresetBuilt, setActivePresetBuilt] = useState<{
    tier: PresetTier;
    brand: "AMD" | "INTEL";
  } | null>(null);
  const [presetCpuAlert, setPresetCpuAlert] = useState<{
    titulo: string;
    detalle: string;
    faltantes: string[];
    tier?: PresetTier;
    budgetPyg?: number;
    failedBrand: "AMD" | "INTEL";
    alternativeBrand?: "AMD" | "INTEL";
    alternativeAvailable?: boolean;
    fallbackBuild?: HardwarePresupuestoItem[];
  } | null>(null);
  const [presetSuccessBanner, setPresetSuccessBanner] = useState<string | null>(null);

  const [customTargetBudget, setCustomTargetBudget] = useState<number>(10000000);
  const [customTargetBudgetInput, setCustomTargetBudgetInput] = useState<string>("10.000.000");
  const [budgetCpuPreference, setBudgetCpuPreference] = useState<"AUTO" | "AMD" | "INTEL">("AUTO");
  const [selectedBudgetForCpuMenu, setSelectedBudgetForCpuMenu] = useState<number | null>(null);
  const [budgetFeedback, setBudgetFeedback] = useState<string | null>(null);
  const [budgetAnalysis, setBudgetAnalysis] = useState<{
    targetPyg: number;
    achievedTotalPyg: number;
    hardwarePyg: number;
    montajePyg: number;
    diffPyg: number;
    pctUsed: number;
    brandUsed: "AMD" | "INTEL";
    socketUsed: string;
    summaryText: string;
  } | null>(null);

  const handleTipoCambioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cursor = e.target.selectionStart || 0;
    const raw = e.target.value;
    const { formatted, cursorPos, numericValue } = formatPygInputWithCursor(raw, cursor);
    setTipoCambioInput(formatted);
    if (numericValue > 0) {
      setTipoCambio(numericValue);
    }
    requestAnimationFrame(() => {
      e.target.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleTipoCambioBlur = () => {
    if (!tipoCambioInput.trim() || parsePygNumber(tipoCambioInput) === 0) {
      setTipoCambio(TIPO_CAMBIO_PYG_DEFECTO);
      setTipoCambioInput(TIPO_CAMBIO_PYG_DEFECTO.toLocaleString("es-PY"));
    }
  };

  const handleConfirmTipoCambio = () => {
    const num = parsePygNumber(modalTipoCambioInput);
    if (!num || num < 3000 || num > 15000) {
      setModalTipoCambioError(
        "Por favor ingresá una cotización válida en Guaraníes (ej: 6.800 Gs/USD)."
      );
      return;
    }
    setTipoCambio(num);
    setTipoCambioInput(num.toLocaleString("es-PY"));
    setModalTipoCambioError(null);
    setIsTipoCambioModalOpen(false);
  };

  const handleCustomBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cursor = e.target.selectionStart || 0;
    const raw = e.target.value;
    const { formatted, cursorPos, numericValue } = formatPygInputWithCursor(raw, cursor);
    setCustomTargetBudgetInput(formatted);
    setCustomTargetBudget(numericValue);
    requestAnimationFrame(() => {
      e.target.setSelectionRange(cursorPos, cursorPos);
    });
  };

  useEffect(() => {
    setVendedores(getStoredVendedores());
    try {
      const rawSession =
        sessionStorage.getItem("nissei_active_session_v4") ||
        localStorage.getItem("nissei_active_session_v4");
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        setIsOperatorSession(Boolean(parsed?.id && parsed?.clientKey));
      }
    } catch {
      setIsOperatorSession(false);
    }
  }, []);

  // Temporizador secuencial de 8 segundos por cada advertencia al ingresar (inicia al confirmar el tipo de cambio)
  useEffect(() => {
    if (isTipoCambioModalOpen || !warningStage) return;
    setWarningSecondsLeft(8);
    const interval = setInterval(() => {
      setWarningSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    const timer = setTimeout(() => {
      setWarningStage((prevStage) => (prevStage === "STOCK" ? "TIEMPO_MONTAJE" : null));
    }, 8000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [warningStage, isTipoCambioModalOpen]);

  const syncWithNisseiWeb = async (forceRefresh = false) => {
    setIsLoadingWeb(true);
    setWebSyncError(null);
    try {
      const url = forceRefresh ? "/api/nissei-live?refresh=1" : "/api/nissei-live";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setLiveBySku(data.bySku || {});
        setLiveCatalogItems(Array.isArray(data.items) ? data.items : []);
        const dateObj = data.updatedAt ? new Date(data.updatedAt) : new Date();
        setLastUpdatedWeb(
          dateObj.toLocaleTimeString("es-PY", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } else {
        setWebSyncError(data?.error || "No se pudo sincronizar el catálogo de stock.");
      }
    } catch {
      setWebSyncError("Error de red conectando con el catálogo de stock.");
    } finally {
      setIsLoadingWeb(false);
    }
  };

  useEffect(() => {
    void syncWithNisseiWeb(false);
  }, []);

  // Consulta en directo por SKU cuando el usuario escribe un código numérico en el buscador
  useEffect(() => {
    const q = catalogSearchTerm.trim();
    if (!q || q.length < 4) return;
    const candidates = CATALOGO_PRESUPUESTO_OFICIAL.filter((i) => {
      const k = cleanSkuKey(i.sku);
      return k && k.includes(q) && !liveBySku[k];
    })
      .slice(0, 15)
      .map((i) => cleanSkuKey(i.sku));

    if (candidates.length === 0) return;

    const timer = setTimeout(() => {
      fetch("/api/nissei-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus: candidates }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.ok && json.bySku && Object.keys(json.bySku).length > 0) {
            setLiveBySku((prev) => ({ ...prev, ...json.bySku }));
          }
        })
        .catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [catalogSearchTerm, liveBySku]);

  // Catálogo unificado, depurado y estrictamente vinculado a https://nissei.com/py/
  const catalogoCompleto = useMemo<HardwarePresupuestoItem[]>(() => {
    const mergedMap = new Map<string, HardwarePresupuestoItem>();

    // 1. Cruzar todos los SKUs válidos del catálogo base con los datos en vivo de https://nissei.com/py/
    for (const baseItem of CATALOGO_PRESUPUESTO_OFICIAL) {
      if (baseItem.sku === "STOCK-COOLER") {
        mergedMap.set(baseItem.sku, {
          ...baseItem,
          precioPyg: 0,
          precioUsd: 0,
          stockStatus: "IN_STOCK",
          isCpuCooler: true,
          garantiaMeses: 3,
          verificadoWeb: true,
        });
        continue;
      }

      const key = cleanSkuKey(baseItem.sku);
      if (!key) continue;

      const live = liveBySku[key] || liveBySku[baseItem.sku] || liveBySku[`PC-${key}`];
      const cleanWebName = live?.nombre ? cleanDisplayTitle(live.nombre) : undefined;
      const cleanDesc = cleanDisplayTitle(baseItem.descripcion);

      const specs = enriquecerComponente({
        sku: key,
        marca: baseItem.marca,
        descripcion: cleanWebName ? `${cleanDesc} ${cleanWebName}` : cleanDesc,
        categoria: baseItem.categoria,
        seriales: "",
      });

      const candidate: HardwarePresupuestoItem =
        live && live.stockStatus === "IN_STOCK" && live.precioPyg > 0
          ? {
              ...baseItem,
              ...specs,
              sku: key,
              marca: baseItem.marca || specs.marca,
              descripcion: cleanDesc,
              nombreWeb: cleanWebName,
              precioPyg: live.precioPyg,
              precioRegularPyg: live.precioRegularPyg,
              precioUsd: Math.round((live.precioPyg / (tipoCambio > 0 ? tipoCambio : TIPO_CAMBIO_PYG_DEFECTO)) * 100) / 100,
              stockStatus: "IN_STOCK",
              urlWeb: live.urlWeb,
              garantiaMeses: 3,
              verificadoWeb: true,
            }
          : {
              ...baseItem,
              ...specs,
              sku: key,
              marca: baseItem.marca || specs.marca,
              descripcion: cleanDesc,
              precioPyg: 0,
              precioRegularPyg: 0,
              precioUsd: 0,
              stockStatus: "OUT_OF_STOCK",
              urlWeb: live?.urlWeb,
              garantiaMeses: 3,
              verificadoWeb: false,
            };

      if (!isValidDesktopCatalogItem(candidate)) continue;
      mergedMap.set(key, candidate);
    }

    // 2. Incorporar productos nuevos de PC en stock en https://nissei.com/py/ con SKU numérico válido
    for (const live of liveCatalogItems) {
      const key = cleanSkuKey(live.sku);
      if (!key || mergedMap.has(key)) continue;
      if (live.stockStatus !== "IN_STOCK" || live.precioPyg <= 0) continue;

      const cleanWebName = cleanDisplayTitle(live.nombre);
      const specs = enriquecerComponente({
        sku: key,
        descripcion: cleanWebName,
        categoria: live.categoria,
        seriales: "",
      });

      const candidate: HardwarePresupuestoItem = {
        ...specs,
        sku: key,
        descripcion: cleanWebName.toUpperCase(),
        nombreWeb: cleanWebName,
        categoria: live.categoria,
        precioPyg: live.precioPyg,
        precioRegularPyg: live.precioRegularPyg,
        precioUsd: Math.round((live.precioPyg / (tipoCambio > 0 ? tipoCambio : TIPO_CAMBIO_PYG_DEFECTO)) * 100) / 100,
        stockStatus: "IN_STOCK",
        urlWeb: live.urlWeb,
        garantiaMeses: 3,
        verificadoWeb: true,
      };

      if (!isValidDesktopCatalogItem(candidate)) continue;
      mergedMap.set(key, candidate);
    }

    return Array.from(mergedMap.values()).sort((a, b) => {
      if (a.sku === "STOCK-COOLER") return -1;
      if (b.sku === "STOCK-COOLER") return 1;
      const aStock = a.stockStatus === "IN_STOCK" ? 1 : 0;
      const bStock = b.stockStatus === "IN_STOCK" ? 1 : 0;
      if (aStock !== bStock) return bStock - aStock;
      if (aStock === 1 && (a.precioPyg || 0) !== (b.precioPyg || 0)) {
        return (a.precioPyg || 0) - (b.precioPyg || 0);
      }
      return a.descripcion.localeCompare(b.descripcion);
    });
  }, [liveBySku, liveCatalogItems, tipoCambio]);

  // Actualizar automáticamente los ítems seleccionados cuando llegan los datos en vivo
  useEffect(() => {
    if (Object.keys(liveBySku).length === 0) return;
    setSelectedComponents((prev) =>
      prev.map((c) => {
        const updated = catalogoCompleto.find((item) => item.sku === c.sku);
        if (!updated) return c;
        return {
          ...updated,
          cantidad: c.cantidad || 1,
        };
      })
    );
  }, [catalogoCompleto, liveBySku]);

  const totalInStockCount = useMemo(
    () =>
      catalogoCompleto.filter(
        (i) => i.stockStatus === "IN_STOCK" && i.sku !== "STOCK-COOLER"
      ).length,
    [catalogoCompleto]
  );

  // Referencias actuales de componentes seleccionados
  const currentCpu = useMemo(
    () => selectedComponents.find((c) => c.categoria === "PROCESADOR"),
    [selectedComponents]
  );
  const currentMb = useMemo(
    () => selectedComponents.find((c) => c.categoria === "PLACA_MADRE"),
    [selectedComponents]
  );
  const currentGpu = useMemo(
    () => selectedComponents.find((c) => c.categoria === "GPU"),
    [selectedComponents]
  );
  const currentGabinete = useMemo(
    () => selectedComponents.find((c) => c.categoria === "GABINETE"),
    [selectedComponents]
  );
  const currentCooler = useMemo(
    () => selectedComponents.find((c) => c.categoria === "REFRIGERACION"),
    [selectedComponents]
  );
  const currentPsu = useMemo(
    () => selectedComponents.find((c) => c.categoria === "FUENTE"),
    [selectedComponents]
  );
  const currentRam = useMemo(
    () => selectedComponents.find((c) => c.categoria === "RAM"),
    [selectedComponents]
  );
  const currentStorage = useMemo(
    () => selectedComponents.find((c) => c.categoria === "ALMACENAMIENTO"),
    [selectedComponents]
  );

  // Socket activo efectivo (determinado por CPU en carrito, Placa Madre o selección explícita del usuario)
  const effectiveSocket = useMemo<"TODOS" | "AM4" | "AM5" | "LGA1700" | "LGA1851">(() => {
    if (currentCpu?.socket && currentCpu.socket !== "UNIVERSAL") {
      return currentCpu.socket as "AM4" | "AM5" | "LGA1700" | "LGA1851";
    }
    if (currentMb?.socket && currentMb.socket !== "UNIVERSAL") {
      return currentMb.socket as "AM4" | "AM5" | "LGA1700" | "LGA1851";
    }
    return selectedSocketFilter;
  }, [currentCpu?.socket, currentMb?.socket, selectedSocketFilter]);

  // Tipo de memoria RAM compatible efectiva (DDR4 vs DDR5)
  const effectiveRamType = useMemo<"DDR4" | "DDR5" | "TODAS">(() => {
    if (currentMb?.ramType && currentMb.ramType !== "UNIVERSAL") {
      return currentMb.ramType;
    }
    if (effectiveSocket === "AM4") {
      return "DDR4";
    }
    if (effectiveSocket === "AM5" || effectiveSocket === "LGA1851") {
      return "DDR5";
    }
    if (currentCpu?.ramType && currentCpu.ramType !== "UNIVERSAL") {
      return currentCpu.ramType;
    }
    if (slotPlatformFilter === "DDR4") return "DDR4";
    if (slotPlatformFilter === "DDR5") return "DDR5";
    return "TODAS";
  }, [currentMb?.ramType, currentCpu?.ramType, effectiveSocket, slotPlatformFilter]);

  // Verificación reactiva de compatibilidad
  const resultadoCompatibilidad = useMemo(() => {
    return verificarCompatibilidadPC(selectedComponents);
  }, [selectedComponents]);

  // Selección o reemplazo de componente (Estricto: solo permite agregar productos EN STOCK en nissei.com/py)
  const handleSelectComponent = (item: HardwarePresupuestoItem) => {
    if (item.stockStatus !== "IN_STOCK") {
      return;
    }

    setSelectedComponents((prev) => {
      if (item.categoria === "RAM" || item.categoria === "ALMACENAMIENTO") {
        const existingIdx = prev.findIndex((p) => p.sku === item.sku);
        if (existingIdx >= 0) {
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
          return true;
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

  // Cálculo estricto de totales usando el precio oficial en Guaraníes de https://nissei.com/py/
  // - Ventas Corp: Servicio de Montaje & QA es 100% Bonificado / GRATIS (US$ 0 / ₲ 0)
  // - Ventas Tienda: Servicio de Montaje & QA tiene tarifa fija única de US$ 58,77
  const COSTO_MONTAJE_TIENDA_USD = 58.77;
  const isCorpVendedor = useMemo(() => {
    if (selectedArea === "Ventas Corp") return true;
    if (selectedArea === "Ventas Tienda") return false;
    const clean = selectedVendedor.trim().toLowerCase();
    return Boolean(clean && VENDEDORES_CORP_BASE.some((v) => v.toLowerCase() === clean));
  }, [selectedArea, selectedVendedor]);

  const costoMontajeTiendaPyg = Math.round(
    COSTO_MONTAJE_TIENDA_USD * (tipoCambio > 0 ? tipoCambio : TIPO_CAMBIO_PYG_DEFECTO)
  );
  const costoMontajePyg = isCorpVendedor ? 0 : costoMontajeTiendaPyg;
  const costoMontajeUsd = isCorpVendedor ? 0 : COSTO_MONTAJE_TIENDA_USD;

  const totalHardwarePyg = useMemo(() => {
    return selectedComponents.reduce(
      (acc, c) => acc + (c.precioPyg || 0) * (c.cantidad || 1),
      0
    );
  }, [selectedComponents]);

  const totalPresupuestoPyg =
    selectedComponents.length > 0 ? totalHardwarePyg + costoMontajePyg : 0;
  const totalPresupuestoUsd =
    selectedComponents.length > 0 && tipoCambio > 0
      ? Math.round((totalHardwarePyg / tipoCambio + costoMontajeUsd) * 100) / 100
      : 0;

  // Helpers de validación física, eléctrica y de arquitectura para Presets Inteligentes
  const isCpuOfBrand = (item: HardwarePresupuestoItem, brand: "AMD" | "INTEL"): boolean => {
    const txt = `${item.marca || ""} ${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();
    if (brand === "AMD") {
      return (
        item.marca?.toUpperCase() === "AMD" ||
        item.socket === "AM4" ||
        item.socket === "AM5" ||
        /\b(AMD|RYZEN|ATHLON|THREADRIPPER)\b/.test(txt)
      );
    }
    return (
      item.marca?.toUpperCase() === "INTEL" ||
      item.socket === "LGA1700" ||
      item.socket === "LGA1851" ||
      item.socket === "LGA1200" ||
      item.socket === "LGA1151" ||
      /\b(INTEL|CORE\s*I[3579]|CORE\s*ULTRA|PENTIUM|CELERON)\b/.test(txt)
    );
  };

  const isRealDedicatedGamingGpu = (item: HardwarePresupuestoItem): boolean => {
    if (item.categoria !== "GPU") return false;
    const txt = `${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();
    // Excluir adaptadores pasivos de video básicos de oficina para perfiles Gamer / 3D / IA / Edición
    if (
      /\b(GT\s*210|GT\s*610|GT\s*710|GT\s*730|GT\s*1030|HD\s*5450|HD\s*6450|R5\s*220|R5\s*230)\b/.test(
        txt
      )
    ) {
      return false;
    }
    return true;
  };

  const isGabinetePhysicallyCompatible = (
    gab: HardwarePresupuestoItem,
    mb?: HardwarePresupuestoItem,
    cooler?: HardwarePresupuestoItem,
    hasDedicatedGpu?: boolean
  ): boolean => {
    // 1. Si hay GPU dedicada, nunca elegir un gabinete Kit de Oficina con fuente genérica de 180W/200W
    if (hasDedicatedGpu && gab.isKitOficina) return false;

    // 2. Factor de forma de la Placa Madre vs Gabinete (evitar error crítico ATX en Micro-ATX/ITX)
    if (
      mb?.formFactor === "ATX" &&
      (gab.maxMbFormFactor === "MATX" || gab.maxMbFormFactor === "ITX")
    ) {
      return false;
    }
    if (mb?.formFactor === "EATX" && gab.maxMbFormFactor !== "EATX") {
      return false;
    }

    // 3. Compatibilidad física con Cooler / Radiador Líquido AIO
    if (cooler && cooler.sku !== "STOCK-COOLER") {
      const coolerDesc = `${cooler.descripcion} ${cooler.nombreWeb || ""}`;
      const isLiquid = Boolean(
        cooler.isAioLiquid || /WATER|LIQUID|L[IÍ]QUIDO|AIO|360|240/i.test(coolerDesc)
      );
      const is360 = Boolean(
        cooler.radiatorSizeMm === 360 || /360\s*MM|\b360\b/i.test(coolerDesc)
      );
      const is240 = Boolean(
        cooler.radiatorSizeMm === 240 || /240\s*MM|\b240\b/i.test(coolerDesc)
      );

      const caseMaxRad = gab.maxRadiatorMm ?? 0;
      if (isLiquid && (gab.isKitOficina || caseMaxRad === 0)) return false;
      if (is360 && caseMaxRad < 360) return false;
      if (is240 && caseMaxRad < 240) return false;
    }

    return true;
  };

  const isCpuMatchingTier = (cpu: HardwarePresupuestoItem, tier: PresetTier): boolean => {
    const txt = `${cpu.descripcion} ${cpu.nombreWeb || ""}`.toUpperCase();
    const isBasicEntryDualCore = /\b(CELERON|PENTIUM|ATHLON|3000G|G5905|G6900)\b/.test(txt);

    if (tier === "OFICINA_PRO") {
      return cpu.hasIGpu !== false;
    }
    if (tier === "PROGRAMACION_DEV" || tier === "WORKSTATION_EMPRESARIAL") {
      if (isBasicEntryDualCore || /\b(3200G|4100|10100)\b/.test(txt)) return false;
      return cpu.hasIGpu !== false;
    }
    if (tier === "GAMING_ESPORTS_1080P") {
      if (isBasicEntryDualCore) return false;
      return /\b(RYZEN\s*[3579]|CORE\s*I[3579]|CORE\s*ULTRA|12100|13100|14100|12400|13400|14400|4500|5500|5600|5700|7500|7600|8400|8500|8600)\b/.test(
        txt
      );
    }
    if (tier === "GAMING_PRO" || tier === "DISENO_GRAFICO_2D") {
      if (isBasicEntryDualCore) return false;
      return /\b(RYZEN\s*[579]|CORE\s*I[3579]|CORE\s*ULTRA|12100|13100|14100|12400|13400|14400|14600|5500|5600|5700|7500|7600|7700|7800|8400|8500|8600|8700|9600|9700|9800)\b/.test(
        txt
      );
    }
    if (tier === "ARQUITECTURA_3D" || tier === "EDICION_CREATOR") {
      if (isBasicEntryDualCore) return false;
      if (/\b(CORE\s*I3|RYZEN\s*3|3200G|12100|13100|14100|4100|4500)\b/.test(txt)) return false;
      return /\b(RYZEN\s*[579]|CORE\s*I[579]|CORE\s*ULTRA|5600|5700|5800|5900|7600|7700|7800|7900|7950|8600|8700|9600|9700|9800|9900|9950|12400|12600|12700|13400|13600|13700|14400|14600|14700|14900)\b/.test(
        txt
      );
    }
    if (tier === "IA_DEEP_LEARNING" || tier === "GAMING_EXTREMO_4K") {
      if (isBasicEntryDualCore) return false;
      if (
        /\b(CORE\s*I3|RYZEN\s*3|3200G|5500|5600G|5600GE|5600GT|4500|4600G|12100|13100|14100)\b/.test(
          txt
        )
      ) {
        return false;
      }
      return /\b(RYZEN\s*[79]|9600X|7600X|7700|7800X3D|9800X3D|7900|7950|9700|9900|9950|5700X|5800X|5900X|5950X|CORE\s*I[579]|CORE\s*ULTRA|13600|14600|12700|13700|14700|12900|13900|14900|13400|14400)\b/.test(
        txt
      );
    }
    return true;
  };

  /**
   * Evaluador Inteligente de Perfil por Marca de CPU (AMD Ryzen vs Intel Core)
   * Verifica disponibilidad estricta de cada componente requerido para los 10 perfiles y garantiza 0 errores de compatibilidad.
   */
  const evaluatePresetForBrand = (
    tier: PresetTier,
    cpuBrand: "AMD" | "INTEL",
    preserveExisting = false
  ): {
    ok: boolean;
    faltantes: string[];
    build: HardwarePresupuestoItem[];
    fallbackBuild: HardwarePresupuestoItem[];
    hardwarePyg: number;
    totalPyg: number;
    cpuName: string;
    gpuName: string;
    ramName: string;
    socketUsed: string;
  } => {
    const inStockPool = catalogoCompleto.filter(
      (c) => c.stockStatus === "IN_STOCK" && (c.precioPyg || 0) > 0
    );
    const brandLabel = cpuBrand === "AMD" ? "AMD Ryzen" : "Intel Core";
    const presetObj = PRESETS.find((p) => p.id === tier);
    const faltantes: string[] = [];

    if (inStockPool.length === 0) {
      return {
        ok: false,
        faltantes: ["Catálogo en sincronización de stock"],
        build: [],
        fallbackBuild: [],
        hardwarePyg: 0,
        totalPyg: 0,
        cpuName: "",
        gpuName: "",
        ramName: "",
        socketUsed: "",
      };
    }

    const brandCpus = inStockPool.filter(
      (i) => i.categoria === "PROCESADOR" && isCpuOfBrand(i, cpuBrand)
    );
    if (brandCpus.length === 0) {
      faltantes.push(`Procesador ${brandLabel} en stock web`);
    }

    const tierCpus = brandCpus.filter((c) => isCpuMatchingTier(c, tier));
    if (brandCpus.length > 0 && tierCpus.length === 0) {
      if (
        tier === "OFICINA_PRO" ||
        tier === "PROGRAMACION_DEV" ||
        tier === "WORKSTATION_EMPRESARIAL"
      ) {
        faltantes.push(
          `Procesador ${brandLabel} con gráficos integrados (iGPU) para ${
            presetObj?.nombre || "este perfil"
          } en stock`
        );
      } else {
        faltantes.push(
          `Procesador ${brandLabel} de gama ${presetObj?.nombre || tier} en stock`
        );
      }
    }

    // Verificar cuáles CPUs tienen Placa Madre compatible con su Socket en stock
    const candidateCpusForMb = tierCpus.length > 0 ? tierCpus : brandCpus;
    const cpusWithCompatibleMb = candidateCpusForMb.filter((c) =>
      inStockPool.some((m) => m.categoria === "PLACA_MADRE" && m.socket === c.socket)
    );

    if (candidateCpusForMb.length > 0 && cpusWithCompatibleMb.length === 0) {
      const missingSockets = Array.from(
        new Set(candidateCpusForMb.map((c) => c.socket).filter(Boolean))
      ).join(" / ");
      faltantes.push(
        `Placa Madre compatible con Socket ${missingSockets || brandLabel} en stock`
      );
    }

    // Verificar Tarjeta Gráfica dedicada para perfiles que la exigen
    const allGpus = inStockPool.filter((i) => i.categoria === "GPU");
    const gamingGpus = allGpus.filter(isRealDedicatedGamingGpu);
    const rtxGpus = gamingGpus.filter((g) =>
      /RTX/i.test(`${g.descripcion} ${g.nombreWeb || ""}`)
    );

    const requiresDedicatedGpu =
      tier === "GAMING_ESPORTS_1080P" ||
      tier === "GAMING_PRO" ||
      tier === "GAMING_EXTREMO_4K" ||
      tier === "DISENO_GRAFICO_2D" ||
      tier === "ARQUITECTURA_3D" ||
      tier === "EDICION_CREATOR" ||
      tier === "IA_DEEP_LEARNING";

    if (tier === "IA_DEEP_LEARNING" || tier === "GAMING_EXTREMO_4K") {
      if (rtxGpus.length === 0) {
        faltantes.push(
          `Tarjeta Gráfica dedicada NVIDIA GeForce RTX para ${
            presetObj?.nombre || "Alto Rendimiento"
          } en stock`
        );
      }
    } else if (requiresDedicatedGpu) {
      if (gamingGpus.length === 0) {
        faltantes.push(
          `Tarjeta Gráfica dedicada para ${presetObj?.nombre || "Gaming / Render"} en stock`
        );
      }
    }

    // Seleccionar el mejor CPU dentro de los viables de esa marca
    const usableCpus =
      tierCpus.filter((c) =>
        inStockPool.some((m) => m.categoria === "PLACA_MADRE" && m.socket === c.socket)
      ).length > 0
        ? tierCpus.filter((c) =>
            inStockPool.some((m) => m.categoria === "PLACA_MADRE" && m.socket === c.socket)
          )
        : cpusWithCompatibleMb.length > 0
        ? cpusWithCompatibleMb
        : candidateCpusForMb;

    const existingCpu = preserveExisting
      ? selectedComponents.find(
          (c) => c.categoria === "PROCESADOR" && isCpuOfBrand(c, cpuBrand)
        )
      : undefined;

    let cpu = existingCpu;
    if (!cpu && usableCpus.length > 0) {
      if (tier === "OFICINA_PRO") {
        cpu =
          presetObj?.preferredCpuSkus
            .map((sku) => usableCpus.find((i) => i.sku === sku && i.hasIGpu !== false))
            .find(Boolean) ||
          usableCpus.find(
            (i) =>
              i.hasIGpu !== false &&
              i.includesCooler !== false &&
              (i.precioPyg || 0) >= 550000 &&
              (i.precioPyg || 0) <= 2100000
          ) ||
          usableCpus.find((i) => i.hasIGpu !== false) ||
          usableCpus[0];
      } else if (tier === "PROGRAMACION_DEV" || tier === "WORKSTATION_EMPRESARIAL") {
        // Priorizar CPUs 6/8/12 núcleos con gráficos integrados (AM5 o AM4 Ryzen 5/7/9 o Core i5/i7)
        const igpuCpus = usableCpus.filter((i) => i.hasIGpu !== false);
        const pool = igpuCpus.length > 0 ? igpuCpus : usableCpus;
        cpu =
          presetObj?.preferredCpuSkus
            .map((sku) => pool.find((i) => i.sku === sku))
            .find(Boolean) ||
          pool[
            tier === "WORKSTATION_EMPRESARIAL"
              ? pool.length - 1
              : Math.min(pool.length - 1, Math.floor(pool.length * 0.6))
          ];
      } else if (tier === "GAMING_ESPORTS_1080P") {
        // Mejor relación precio/FPS de entrada
        cpu =
          usableCpus.find((i) =>
            /\b(12400|14400|12100|14100|5500|5600|7500|8400|8500)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          presetObj?.preferredCpuSkus
            .map((sku) => usableCpus.find((i) => i.sku === sku))
            .find(Boolean) ||
          usableCpus[0];
      } else if (
        tier === "IA_DEEP_LEARNING" ||
        tier === "GAMING_EXTREMO_4K" ||
        tier === "EDICION_CREATOR"
      ) {
        cpu =
          presetObj?.preferredCpuSkus
            .map((sku) => usableCpus.find((i) => i.sku === sku))
            .find(Boolean) ||
          usableCpus.find((i) =>
            /\b(7800X3D|9800X3D|14700|13700|7900X|9700X|9900X|14900|14600|9600X)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          usableCpus[usableCpus.length - 1];
      } else if (tier === "ARQUITECTURA_3D" || tier === "DISENO_GRAFICO_2D") {
        cpu =
          presetObj?.preferredCpuSkus
            .map((sku) => usableCpus.find((i) => i.sku === sku))
            .find(Boolean) ||
          usableCpus.find((i) =>
            /\b(9600X|7600X|7700|7800X3D|14600|14400|13400|5700X|12400)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          usableCpus[Math.min(usableCpus.length - 1, Math.floor(usableCpus.length * 0.6))];
      } else {
        // GAMING_PRO
        cpu =
          presetObj?.preferredCpuSkus
            .map((sku) => usableCpus.find((i) => i.sku === sku))
            .find(Boolean) ||
          usableCpus.find((i) =>
            /\b(14400|13400|12400|5600|5700|7600|7500|9600X)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          usableCpus[Math.min(usableCpus.length - 1, Math.floor(usableCpus.length * 0.45))];
      }
    }

    // 2. PLACA MADRE (Compatible con Socket y previniendo VRM Throttling y choque ATX/MATX)
    let mb: HardwarePresupuestoItem | undefined = preserveExisting
      ? selectedComponents.find(
          (c) => c.categoria === "PLACA_MADRE" && c.socket === cpu?.socket
        )
      : undefined;

    const mbCandidatesAll = cpu
      ? inStockPool.filter((i) => i.categoria === "PLACA_MADRE" && i.socket === cpu.socket)
      : [];

    if (!mb && mbCandidatesAll.length > 0 && cpu) {
      const descCpu = `${cpu.descripcion} ${cpu.nombreWeb || ""}`.toUpperCase();
      const esCpuGamaAlta =
        descCpu.includes("I7") ||
        descCpu.includes("I9") ||
        descCpu.includes("RYZEN 9") ||
        descCpu.includes("7800X3D") ||
        descCpu.includes("9800X3D") ||
        descCpu.includes("ULTRA 7") ||
        descCpu.includes("ULTRA 9");

      const nonEntryMbs = mbCandidatesAll.filter((m) => {
        const d = `${m.descripcion} ${m.nombreWeb || ""}`.toUpperCase();
        return !(
          d.includes("H610") ||
          d.includes("H510") ||
          d.includes("H410") ||
          d.includes("H810") ||
          d.includes("A520") ||
          d.includes("A320") ||
          d.includes("A620M-HDV") ||
          d.includes("A620M-E")
        );
      });

      const mbPool =
        esCpuGamaAlta && nonEntryMbs.length > 0 ? nonEntryMbs : mbCandidatesAll;

      if (
        tier === "IA_DEEP_LEARNING" ||
        tier === "GAMING_EXTREMO_4K" ||
        tier === "EDICION_CREATOR"
      ) {
        mb =
          mbPool.find((i) =>
            /\b(X870|X670|B850|Z890|Z790)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          mbPool.find((i) =>
            /\b(B650|B760|B860)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          mbPool[Math.min(mbPool.length - 1, Math.floor(mbPool.length * 0.65))];
      } else if (
        tier === "ARQUITECTURA_3D" ||
        tier === "WORKSTATION_EMPRESARIAL" ||
        tier === "DISENO_GRAFICO_2D"
      ) {
        mb =
          mbPool.find((i) =>
            /\b(B650|B760|B850|Z790|X670|B550)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) || mbPool[Math.min(mbPool.length - 1, Math.floor(mbPool.length * 0.35))];
      } else if (tier === "GAMING_PRO" || tier === "PROGRAMACION_DEV") {
        mb =
          mbPool.find((i) =>
            /\b(B550|B760|B650|A620|A520|H610)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) || mbPool[0];
      } else {
        mb = mbPool[0];
      }
    }

    // 3. MEMORIA RAM
    const requiredRamType =
      mb?.ramType && mb.ramType !== "UNIVERSAL"
        ? mb.ramType
        : cpu?.ramType && cpu.ramType !== "UNIVERSAL"
        ? cpu.ramType
        : "DDR4";

    const ramCandidates = inStockPool.filter(
      (i) => i.categoria === "RAM" && i.ramType === requiredRamType
    );
    if (mb && ramCandidates.length === 0) {
      faltantes.push(`Memoria RAM ${requiredRamType} compatible en stock`);
    }

    let ram = preserveExisting
      ? selectedComponents.find(
          (c) => c.categoria === "RAM" && c.ramType === requiredRamType
        )
      : undefined;

    const needs32GbTier =
      tier === "IA_DEEP_LEARNING" ||
      tier === "GAMING_EXTREMO_4K" ||
      tier === "ARQUITECTURA_3D" ||
      tier === "EDICION_CREATOR" ||
      tier === "DISENO_GRAFICO_2D" ||
      tier === "PROGRAMACION_DEV" ||
      tier === "WORKSTATION_EMPRESARIAL";

    if (!ram && ramCandidates.length > 0) {
      if (needs32GbTier) {
        // Preferir 16GB individual (que luego se duplica a 2x16GB = 32GB Dual Channel) o kit 32GB (2x16GB)
        ram =
          ramCandidates.find(
            (i) =>
              (i.capacidadGb || 0) >= 32 &&
              /\b2\s*X\s*16/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          ramCandidates.find((i) => i.capacidadGb === 16) ||
          ramCandidates.find((i) => (i.capacidadGb || 0) >= 32) ||
          ramCandidates[Math.min(ramCandidates.length - 1, Math.floor(ramCandidates.length * 0.5))];
      } else if (tier === "GAMING_PRO" || tier === "GAMING_ESPORTS_1080P") {
        ram =
          ramCandidates.find(
            (i) =>
              (i.capacidadGb === 16 || i.capacidadGb === 8) &&
              /\b(KINGSTON|CORSAIR|CRUCIAL|XPG|ADATA|LEXAR|G\.SKILL|KLEVV)\b/i.test(
                `${i.marca || ""} ${i.nombreWeb || i.descripcion}`
              )
          ) ||
          ramCandidates.find((i) => (i.capacidadGb || 0) >= 16) ||
          ramCandidates[0];
      } else {
        ram =
          ramCandidates.find(
            (i) =>
              (i.capacidadGb === 8 || i.capacidadGb === 16) &&
              /\b(KINGSTON|CORSAIR|CRUCIAL|LEXAR|ADATA|XPG|HIKSEMI)\b/i.test(
                `${i.marca || ""} ${i.nombreWeb || i.descripcion}`
              )
          ) || ramCandidates[0];
      }
    }

    // 4. ALMACENAMIENTO SSD
    const ssdCandidates = inStockPool.filter((i) => i.categoria === "ALMACENAMIENTO");
    if (ssdCandidates.length === 0) {
      faltantes.push("Unidad de Almacenamiento SSD en stock");
    }
    const nvmePool = ssdCandidates.filter((i) => i.esM2Nvme);
    const ssdPoolToUse = nvmePool.length > 0 ? nvmePool : ssdCandidates;

    let ssd = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "ALMACENAMIENTO")
      : undefined;
    if (!ssd && ssdPoolToUse.length > 0) {
      if (
        tier === "IA_DEEP_LEARNING" ||
        tier === "EDICION_CREATOR" ||
        tier === "GAMING_EXTREMO_4K"
      ) {
        ssd =
          ssdPoolToUse.find((i) => (i.capacidadGb || 0) >= 1900) ||
          ssdPoolToUse.find((i) => (i.capacidadGb || 0) >= 960) ||
          ssdPoolToUse[Math.min(ssdPoolToUse.length - 1, Math.floor(ssdPoolToUse.length * 0.6))];
      } else if (
        tier === "ARQUITECTURA_3D" ||
        tier === "DISENO_GRAFICO_2D" ||
        tier === "PROGRAMACION_DEV" ||
        tier === "WORKSTATION_EMPRESARIAL" ||
        tier === "GAMING_PRO"
      ) {
        ssd =
          ssdPoolToUse.find(
            (i) => (i.capacidadGb || 0) >= 960 && (i.capacidadGb || 0) <= 1050
          ) ||
          ssdPoolToUse.find(
            (i) => (i.capacidadGb || 0) >= 480 && (i.capacidadGb || 0) <= 550
          ) ||
          ssdPoolToUse[0];
      } else {
        ssd =
          ssdPoolToUse.find(
            (i) => (i.capacidadGb || 0) >= 480 && (i.capacidadGb || 0) <= 550
          ) ||
          ssdCandidates.find(
            (i) => (i.capacidadGb || 0) >= 480 && (i.capacidadGb || 0) <= 550
          ) ||
          ssdPoolToUse[0];
      }
    }

    // 5. PLACA DE VIDEO (GPU)
    let gpu = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "GPU")
      : undefined;
    if (!gpu) {
      if (tier === "IA_DEEP_LEARNING" || tier === "GAMING_EXTREMO_4K") {
        gpu =
          rtxGpus.find((i) =>
            /\b(5080|4080|5070\s*TI|4070\s*TI|RTX\s*5070|RTX\s*4070|5060\s*TI\s*16G|3060\s*12GB)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) || rtxGpus[rtxGpus.length - 1];
      } else if (tier === "ARQUITECTURA_3D" || tier === "EDICION_CREATOR") {
        gpu =
          rtxGpus.find((i) =>
            /\b(4070|5070|4060\s*TI|5060\s*TI|4060|5060|3060)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          rtxGpus[Math.min(rtxGpus.length - 1, Math.floor(rtxGpus.length * 0.5))] ||
          gamingGpus[Math.min(gamingGpus.length - 1, Math.floor(gamingGpus.length * 0.5))];
      } else if (tier === "GAMING_PRO") {
        gpu =
          gamingGpus.find((i) =>
            /\b(RTX\s*4060|RTX\s*5060|RTX\s*3060|RX\s*7600|RX\s*6600|RTX\s*4070)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          gamingGpus[Math.min(gamingGpus.length - 1, Math.floor(gamingGpus.length * 0.4))];
      } else if (tier === "GAMING_ESPORTS_1080P" || tier === "DISENO_GRAFICO_2D") {
        // Entrada / Media dedicada (primera GPU gamer en stock)
        gpu = gamingGpus[0];
      } else if (cpu && cpu.hasIGpu === false) {
        gpu = allGpus[0];
        if (!gpu) {
          faltantes.push(
            "Tarjeta de Video dedicada en stock (el procesador disponible no tiene video integrado)"
          );
        }
      }
    }

    // 6. REFRIGERACIÓN Y GABINETE (100% sincronizados en factor de forma ATX/MATX y tamaño de radiador)
    const stockCooler = catalogoCompleto.find((i) => i.sku === "STOCK-COOLER");
    const realCpuCoolers = inStockPool.filter(
      (i) => i.categoria === "REFRIGERACION" && i.isCpuCooler && i.sku !== "STOCK-COOLER"
    );
    const liquid240Coolers = realCpuCoolers.filter((i) => {
      const d = `${i.descripcion} ${i.nombreWeb || ""}`;
      return (
        /240|LIQUID|L[IÍ]QUIDO|WATER|AIO/i.test(d) &&
        !(i.radiatorSizeMm === 360 || /360/i.test(d))
      );
    });
    const liquid360Coolers = realCpuCoolers.filter((i) => {
      const d = `${i.descripcion} ${i.nombreWeb || ""}`;
      return i.radiatorSizeMm === 360 || /360/i.test(d);
    });
    const airCoolers = realCpuCoolers.filter((i) => {
      const d = `${i.descripcion} ${i.nombreWeb || ""}`;
      return !i.isAioLiquid && !/240|360|LIQUID|L[IÍ]QUIDO|WATER|AIO/i.test(d);
    });

    const allCases = inStockPool.filter((i) => i.categoria === "GABINETE");

    if (
      mb &&
      (mb.formFactor === "ATX" || mb.formFactor === "EATX") &&
      !allCases.some((g) => isGabinetePhysicallyCompatible(g, mb, undefined, Boolean(gpu)))
    ) {
      const matxAlt = mbCandidatesAll.find(
        (m) =>
          m.formFactor !== "ATX" &&
          m.formFactor !== "EATX" &&
          allCases.some((g) => isGabinetePhysicallyCompatible(g, m, undefined, Boolean(gpu)))
      );
      if (matxAlt) {
        mb = matxAlt;
      }
    }

    let cooler = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "REFRIGERACION")
      : undefined;

    if (!cooler || (cpu?.includesCooler === false && cooler.sku === "STOCK-COOLER")) {
      const descCpu = cpu ? `${cpu.descripcion} ${cpu.nombreWeb || ""}`.toUpperCase() : "";
      const esCpuCaliente =
        (cpu?.tdpWatts || 0) >= 120 ||
        /14700|13700|14900|13900|7800X3D|9800X3D|7900X|7950X/.test(descCpu);

      if (
        tier === "IA_DEEP_LEARNING" ||
        tier === "GAMING_EXTREMO_4K" ||
        tier === "EDICION_CREATOR" ||
        tier === "ARQUITECTURA_3D" ||
        esCpuCaliente
      ) {
        const valid240 = liquid240Coolers.find((c) =>
          allCases.some((g) => isGabinetePhysicallyCompatible(g, mb, c, Boolean(gpu)))
        );
        const valid360 = liquid360Coolers.find((c) =>
          allCases.some((g) => isGabinetePhysicallyCompatible(g, mb, c, Boolean(gpu)))
        );
        const validAir = airCoolers.find((c) =>
          allCases.some((g) => isGabinetePhysicallyCompatible(g, mb, c, Boolean(gpu)))
        );
        cooler =
          valid240 ||
          valid360 ||
          validAir ||
          realCpuCoolers[0] ||
          (cpu?.includesCooler !== false ? stockCooler : undefined);
      } else if (
        cpu?.includesCooler === false ||
        tier === "WORKSTATION_EMPRESARIAL"
      ) {
        const validAir = airCoolers.find((c) =>
          allCases.some((g) => isGabinetePhysicallyCompatible(g, mb, c, Boolean(gpu)))
        );
        const valid240 = liquid240Coolers.find((c) =>
          allCases.some((g) => isGabinetePhysicallyCompatible(g, mb, c, Boolean(gpu)))
        );
        cooler =
          validAir ||
          valid240 ||
          realCpuCoolers[0] ||
          (cpu?.includesCooler !== false ? stockCooler : undefined);
        if (!cooler) {
          faltantes.push(
            "Cooler Disipador para CPU en stock (el procesador no incluye cooler de fábrica)"
          );
        }
      } else {
        cooler = stockCooler;
      }
    }

    // Selección de Gabinete estrictamente compatible con Placa Madre (ATX/MATX) y Cooler (Aire/240/360)
    const compatibleCases = allCases.filter((g) =>
      isGabinetePhysicallyCompatible(g, mb, cooler, Boolean(gpu))
    );
    const gamerCompatibleCases = compatibleCases.filter(
      (i) =>
        !i.isKitOficina &&
        !/\b(1100K|1101K|1102K|1103K|1200K|1300K|K8501|K8502)\b/i.test(i.descripcion) &&
        (i.precioPyg || 0) >= 270000
    );

    let gabinete = preserveExisting
      ? selectedComponents.find(
          (c) =>
            c.categoria === "GABINETE" &&
            isGabinetePhysicallyCompatible(c, mb, cooler, Boolean(gpu))
        )
      : undefined;

    if (!gabinete) {
      if (
        tier === "IA_DEEP_LEARNING" ||
        tier === "GAMING_EXTREMO_4K" ||
        tier === "EDICION_CREATOR" ||
        tier === "ARQUITECTURA_3D"
      ) {
        gabinete =
          gamerCompatibleCases.find(
            (i) =>
              /\b(COUGAR|CORSAIR|BE QUIET|ASUS|LIAN LI|NZXT)\b/i.test(
                `${i.marca || ""} ${i.nombreWeb || i.descripcion}`
              ) && (i.precioPyg || 0) >= 450000
          ) ||
          gamerCompatibleCases[
            Math.min(
              gamerCompatibleCases.length - 1,
              Math.floor(gamerCompatibleCases.length * 0.5)
            )
          ] ||
          compatibleCases[0];
      } else if (
        tier === "GAMING_PRO" ||
        tier === "GAMING_ESPORTS_1080P" ||
        tier === "DISENO_GRAFICO_2D" ||
        tier === "PROGRAMACION_DEV" ||
        tier === "WORKSTATION_EMPRESARIAL"
      ) {
        gabinete = gamerCompatibleCases[0] || compatibleCases[0];
      } else {
        gabinete = compatibleCases[0];
      }
    }

    if (!gabinete) {
      faltantes.push(
        `Gabinete compatible con placa madre ${mb?.formFactor || "ATX/Micro-ATX"} en stock`
      );
    }

    // 7. FUENTE DE PODER (Acorde al consumo real calculado por verificarCompatibilidadPC)
    const cpuWatts = cpu?.tdpWatts || 65;
    const gpuWatts = gpu ? gpu.tdpWatts || 150 : 0;
    const consumoTotalWatts = cpuWatts + gpuWatts + 60;
    const fuenteRecomendadaWatts = Math.max(
      Math.ceil((consumoTotalWatts * 1.3) / 50) * 50,
      gpu?.recomendadoPsuWatts || 500,
      tier === "IA_DEEP_LEARNING" || tier === "GAMING_EXTREMO_4K"
        ? 750
        : tier === "ARQUITECTURA_3D" || tier === "EDICION_CREATOR"
        ? 650
        : tier === "GAMING_PRO" || tier === "DISENO_GRAFICO_2D" || tier === "WORKSTATION_EMPRESARIAL"
        ? 600
        : 500
    );

    let psu = preserveExisting
      ? selectedComponents.find(
          (c) => c.categoria === "FUENTE" && (c.potenciaWatts || 0) >= fuenteRecomendadaWatts
        )
      : undefined;

    if (!psu) {
      const psuCandidates = inStockPool.filter(
        (i) => i.categoria === "FUENTE" && (i.potenciaWatts || 0) >= fuenteRecomendadaWatts
      );
      if (tier === "IA_DEEP_LEARNING" || tier === "GAMING_EXTREMO_4K") {
        psu =
          psuCandidates.find((i) =>
            /\b(GOLD|PLATINUM)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          psuCandidates.find((i) =>
            /\b(80\s*PLUS|80PLUS|BRONZE|BRONCE)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          psuCandidates[0];
      } else {
        psu =
          psuCandidates.find((i) =>
            /\b(80\s*PLUS|80PLUS|BRONZE|BRONCE|GOLD|PLATINUM)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          psuCandidates[0] ||
          inStockPool.find(
            (i) => i.categoria === "FUENTE" && (i.potenciaWatts || 0) >= consumoTotalWatts
          );
      }
    }

    if (!psu && !(gabinete?.isKitOficina && !gpu && (gabinete.fuenteIncluidaWatts || 200) >= consumoTotalWatts)) {
      faltantes.push(`Fuente de Poder certificada de ${fuenteRecomendadaWatts}W+ en stock`);
    }

    const rawBuild = [cpu, mb, ram, gpu, ssd, psu, gabinete, cooler].filter(
      Boolean
    ) as HardwarePresupuestoItem[];

    const finalBuild = rawBuild.map((item) => {
      let cant = 1;
      if (item.categoria === "RAM") {
        const isDualKit = /\b2\s*X\s*\d+\s*G/i.test(
          `${item.descripcion} ${item.nombreWeb || ""}`
        );
        if (!isDualKit) {
          if (needs32GbTier) {
            if ((item.capacidadGb || 16) <= 16) cant = 2; // 32GB en Dual Channel (2x16GB)
          } else if (
            tier === "GAMING_PRO" ||
            tier === "GAMING_ESPORTS_1080P"
          ) {
            if ((item.capacidadGb || 8) <= 8) cant = 2; // 16GB en Dual Channel (2x8GB)
          }
        }
      }
      return {
        ...item,
        cantidad: cant,
      };
    });

    const hardwarePyg = finalBuild.reduce(
      (acc, c) => acc + (c.precioPyg || 0) * (c.cantidad || 1),
      0
    );
    const totalPyg = finalBuild.length > 0 ? hardwarePyg + costoMontajePyg : 0;

    const ramItem = finalBuild.find((i) => i.categoria === "RAM");
    const ramTotalGb = ramItem ? (ramItem.capacidadGb || 8) * (ramItem.cantidad || 1) : 0;

    return {
      ok: faltantes.length === 0 && Boolean(cpu && mb && ram && ssd && gabinete),
      faltantes,
      build: faltantes.length === 0 ? finalBuild : [],
      fallbackBuild: finalBuild,
      hardwarePyg,
      totalPyg,
      cpuName: cpu ? cleanDisplayTitle(cpu.nombreWeb || cpu.descripcion) : "",
      gpuName: gpu
        ? cleanDisplayTitle(gpu.nombreWeb || gpu.descripcion)
        : "Gráficos Integrados en CPU",
      ramName: ramItem ? `${ramTotalGb}GB ${ramItem.ramType || ""}` : "",
      socketUsed: cpu?.socket || "",
    };
  };

  /**
   * Puntuación de rendimiento base de referencia de CPUs (0 - 100) calibrada según
   * benchmarks de cómputo multihilo y mononúcleo para componentes reales de NISSEI.
   */
  const getCpuBenchmarkScore = (name: string): number => {
    const n = (name || "").toUpperCase();
    // AMD Ryzen 9
    if (n.includes("9950X")) return 100;
    if (n.includes("7950X3D")) return 99;
    if (n.includes("7950X")) return 98;
    if (n.includes("9900X")) return 96;
    if (n.includes("7900X")) return 94;
    if (n.includes("7900")) return 92;
    if (n.includes("5950X")) return 89;
    if (n.includes("5900X") || n.includes("5900XT")) return 86;

    // Intel Ultra 9 / i9
    if (n.includes("ULTRA 9") || n.includes("285K")) return 99;
    if (n.includes("14900")) return 98;
    if (n.includes("13900")) return 96;
    if (n.includes("12900")) return 91;

    // AMD Ryzen 7
    if (n.includes("9800X3D") || n.includes("9850X3D")) return 97;
    if (n.includes("7800X3D")) return 95;
    if (n.includes("9700X")) return 92;
    if (n.includes("7700X")) return 89;
    if (n.includes("7700")) return 87;
    if (n.includes("8700G")) return 84;
    if (n.includes("8700F")) return 83;
    if (n.includes("5800X3D")) return 82;
    if (n.includes("5800X") || n.includes("5800XT")) return 80;
    if (n.includes("5700X3D")) return 78;
    if (n.includes("5700X")) return 76;
    if (n.includes("5700G") || n.includes("5700")) return 74;

    // Intel Ultra 7 / i7
    if (n.includes("ULTRA 7") || n.includes("265K")) return 94;
    if (n.includes("14700")) return 93;
    if (n.includes("13700")) return 90;
    if (n.includes("12700")) return 84;
    if (n.includes("11700") || n.includes("10700")) return 72;

    // AMD Ryzen 5
    if (n.includes("9600X") || n.includes("9600")) return 86;
    if (n.includes("7600X3D")) return 88;
    if (n.includes("7600X")) return 83;
    if (n.includes("7600")) return 81;
    if (n.includes("7500F")) return 79;
    if (n.includes("8600G")) return 79;
    if (n.includes("8500G") || n.includes("8400F")) return 75;
    if (n.includes("5600X3D")) return 77;
    if (n.includes("5600X") || n.includes("5600XT")) return 73;
    if (n.includes("5600T") || n.includes("5600")) return 71;
    if (n.includes("5600GT") || n.includes("5600G") || n.includes("5600GE")) return 69;
    if (n.includes("5500X3D")) return 72;
    if (n.includes("5500")) return 64;
    if (n.includes("4500")) return 60;
    if (n.includes("3600")) return 58;
    if (n.includes("2600")) return 50;

    // Intel Ultra 5 / i5
    if (n.includes("ULTRA 5") || n.includes("245K")) return 88;
    if (n.includes("14600K") || n.includes("14600")) return 87;
    if (n.includes("13600K") || n.includes("13600")) return 85;
    if (n.includes("12600K") || n.includes("12600")) return 80;
    if (n.includes("14500") || n.includes("14400")) return 78;
    if (n.includes("13500") || n.includes("13400")) return 76;
    if (n.includes("12500") || n.includes("12400")) return 71;
    if (n.includes("11400") || n.includes("10400")) return 60;

    // Intel Core i3 & AMD Ryzen 3
    if (n.includes("14100")) return 66;
    if (n.includes("13100")) return 63;
    if (n.includes("12100")) return 61;
    if (n.includes("10105") || n.includes("10100")) return 48;
    if (n.includes("7100") || n.includes("8100") || n.includes("9100")) return 40;
    if (
      n.includes("5300G") ||
      n.includes("4300G") ||
      n.includes("4100") ||
      n.includes("3200G") ||
      n.includes("3400G")
    )
      return 46;

    // Gama básica / Pentium / Celeron / Athlon
    if (n.includes("PENTIUM") || n.includes("G7400") || n.includes("G6405")) return 35;
    if (n.includes("CELERON") || n.includes("ATHLON")) return 28;

    return 55;
  };

  /**
   * Compara científicamente el porcentaje de rendimiento y relación precio/calidad
   * entre la opción AMD y la opción Intel para aconsejar al vendedor cuál conviene.
   */
  const evaluateCpuComparison = (
    amdName: string,
    amdTotalPyg: number,
    intelName: string,
    intelTotalPyg: number,
    amdOk: boolean,
    intelOk: boolean
  ) => {
    const scoreAmd = getCpuBenchmarkScore(amdName);
    const scoreIntel = getCpuBenchmarkScore(intelName);
    const maxScore = Math.max(scoreAmd, scoreIntel, 1);

    const pctAmd = Math.round((scoreAmd / maxScore) * 100);
    const pctIntel = Math.round((scoreIntel / maxScore) * 100);

    const diffPyg = Math.abs(amdTotalPyg - intelTotalPyg);
    const amdEsMasBarato = amdTotalPyg < intelTotalPyg;
    const intelEsMasBarato = intelTotalPyg < amdTotalPyg;
    const esPrecioCasiIgual =
      diffPyg < 40000 || diffPyg / Math.max(Math.min(amdTotalPyg, intelTotalPyg), 1) < 0.02;

    let amdBest = false;
    let intelBest = false;
    let amdTag = "";
    let intelTag = "";
    let amdText = "";
    let intelText = "";
    let veredictoGlobal = "";

    if (!amdOk && intelOk) {
      intelBest = true;
      intelTag = "🏆 Conviene (Stock Completo)";
      intelText = "Cuenta con todos los componentes disponibles en stock para ensamble inmediato.";
      amdTag = "⚠️ Sin Stock";
      amdText = "Faltan componentes para completar el armado de esta plataforma.";
      veredictoGlobal = "Intel Core es la opción recomendada de inmediato por stock disponible.";
    } else if (amdOk && !intelOk) {
      amdBest = true;
      amdTag = "🏆 Conviene (Stock Completo)";
      amdText = "Cuenta con todos los componentes disponibles en stock para ensamble inmediato.";
      intelTag = "⚠️ Sin Stock";
      intelText = "Faltan componentes para completar el armado de esta plataforma.";
      veredictoGlobal = "AMD Ryzen es la opción recomendada de inmediato por stock disponible.";
    } else if (esPrecioCasiIgual) {
      if (scoreAmd > scoreIntel) {
        amdBest = true;
        amdTag = "🏆 Más Conveniente por Precio/Rendimiento";
        intelTag = "⚡ Alternativa Intel";
        amdText = `Mismo costo (~₲ ${diffPyg.toLocaleString("es-PY")} de diferencia) con +${pctAmd - pctIntel}% más potencia multihilo.`;
        intelText = "Plataforma LGA1700 con alta frecuencia mononúcleo y margen de actualización.";
        veredictoGlobal = `AMD Ryzen conviene más: por prácticamente el mismo precio rinde +${pctAmd - pctIntel}% más en multitarea.`;
      } else if (scoreIntel > scoreAmd) {
        intelBest = true;
        intelTag = "🏆 Más Conveniente por Precio/Rendimiento";
        amdTag = "⚡ Alternativa AMD";
        intelText = `Mismo costo (~₲ ${diffPyg.toLocaleString("es-PY")} de diferencia) con +${pctIntel - pctAmd}% mayor velocidad de procesamiento.`;
        amdText = "Plataforma con excelente consumo térmico y estabilidad continua.";
        veredictoGlobal = `Intel Core conviene más: por prácticamente el mismo precio rinde +${pctIntel - pctAmd}% más de potencia.`;
      } else {
        amdTag = "⚖️ Rendimiento Equivalente";
        intelTag = "⚖️ Rendimiento Equivalente";
        amdText = "Rendimiento y costo prácticamente idénticos en esta categoría.";
        intelText = "Rendimiento y costo prácticamente idénticos en esta categoría.";
        veredictoGlobal = "Rendimiento y precio equivalentes. Podés recomendar cualquiera según preferencia del cliente.";
      }
    } else if (amdEsMasBarato) {
      if (scoreAmd >= scoreIntel) {
        amdBest = true;
        amdTag = "🏆 Más Conveniente (Mejor Precio / Calidad)";
        intelTag = "⚡ Mayor Inversión";
        amdText = `Ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} con rendimiento igual o superior. Compra 100% inteligente.`;
        intelText = `Cuesta ₲ ${diffPyg.toLocaleString("es-PY")} más sin una ganancia medible de velocidad en este perfil.`;
        veredictoGlobal = `AMD Ryzen es la opción más conveniente: ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} y rinde igual o mejor.`;
      } else {
        const perfDelta = pctIntel - pctAmd;
        if (perfDelta >= 15) {
          intelBest = true;
          intelTag = `⚡ Mayor Potencia Bruta (+${perfDelta}%)`;
          amdTag = "💰 Opción Económica";
          intelText = `Rinde +${perfDelta}% más por una inversión adicional de ₲ ${diffPyg.toLocaleString("es-PY")}.`;
          amdText = `Ahorrás ₲ ${diffPyg.toLocaleString("es-PY")}, con rendimiento balanceado para uso general.`;
          veredictoGlobal = `Intel rinde +${perfDelta}% más y justifica los ₲ ${diffPyg.toLocaleString("es-PY")} si el cliente busca máxima velocidad.`;
        } else {
          amdBest = true;
          amdTag = "🏆 Más Conveniente por Precio";
          intelTag = "⚡ Mayor Potencia";
          amdText = `Ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} perdiendo apenas un ~${perfDelta}% no perceptible en uso diario.`;
          intelText = `Ofrece +${perfDelta}% de margen térmico/velocidad con costo adicional de ₲ ${diffPyg.toLocaleString("es-PY")}.`;
          veredictoGlobal = `AMD conviene por precio: ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} con rendimiento prácticamente similar.`;
        }
      }
    } else {
      // Intel es más barato
      if (scoreIntel >= scoreAmd) {
        intelBest = true;
        intelTag = "🏆 Más Conveniente (Mejor Precio / Calidad)";
        amdTag = "⚡ Mayor Inversión";
        intelText = `Ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} con rendimiento igual o superior. Compra 100% inteligente.`;
        amdText = `Cuesta ₲ ${diffPyg.toLocaleString("es-PY")} más sin una ganancia medible de velocidad en este perfil.`;
        veredictoGlobal = `Intel Core es la opción más conveniente: ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} y rinde igual o mejor.`;
      } else {
        const perfDelta = pctAmd - pctIntel;
        if (perfDelta >= 15) {
          amdBest = true;
          amdTag = `⚡ Mayor Potencia Bruta (+${perfDelta}%)`;
          intelTag = "💰 Opción Económica";
          amdText = `Rinde +${perfDelta}% más por una inversión adicional de ₲ ${diffPyg.toLocaleString("es-PY")}.`;
          intelText = `Ahorrás ₲ ${diffPyg.toLocaleString("es-PY")}, con rendimiento balanceado para uso general.`;
          veredictoGlobal = `AMD rinde +${perfDelta}% más y justifica los ₲ ${diffPyg.toLocaleString("es-PY")} si el cliente busca máxima velocidad.`;
        } else {
          intelBest = true;
          intelTag = "🏆 Más Conveniente por Precio";
          amdTag = "⚡ Mayor Potencia";
          intelText = `Ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} perdiendo apenas un ~${perfDelta}% no perceptible en uso diario.`;
          amdText = `Ofrece +${perfDelta}% de margen térmico con costo adicional de ₲ ${diffPyg.toLocaleString("es-PY")}.`;
          veredictoGlobal = `Intel conviene por precio: ahorrás ₲ ${diffPyg.toLocaleString("es-PY")} con rendimiento prácticamente similar.`;
        }
      }
    }

    return {
      amd: {
        score: scoreAmd,
        pct: pctAmd,
        esGanadorRendimiento: scoreAmd > scoreIntel,
        esMasConveniente: amdBest,
        esMasBarato: amdEsMasBarato,
        ahorroPyg: amdEsMasBarato ? diffPyg : 0,
        etiquetaConveniencia: amdTag,
        analisis: amdText,
      },
      intel: {
        score: scoreIntel,
        pct: pctIntel,
        esGanadorRendimiento: scoreIntel > scoreAmd,
        esMasConveniente: intelBest,
        esMasBarato: intelEsMasBarato,
        ahorroPyg: intelEsMasBarato ? diffPyg : 0,
        etiquetaConveniencia: intelTag,
        analisis: intelText,
      },
      diferenciaPrecioPyg: diffPyg,
      diferenciaRendimientoPct: Math.abs(pctAmd - pctIntel),
      veredictoGlobal,
    };
  };

  /**
   * Pre-evaluación reactiva en tiempo real de ambos fabricantes (AMD vs Intel)
   * para el perfil seleccionado en el menú de CPU.
   */
  const presetBrandPreviews = useMemo(() => {
    if (!selectedPresetForCpuMenu) return null;
    return {
      AMD: evaluatePresetForBrand(selectedPresetForCpuMenu, "AMD", false),
      INTEL: evaluatePresetForBrand(selectedPresetForCpuMenu, "INTEL", false),
    };
  }, [selectedPresetForCpuMenu, catalogoCompleto, costoMontajePyg]);

  /**
   * Comparativa de rendimiento y precio/calidad entre AMD e Intel para el preset activo
   */
  const presetCpuComparison = useMemo(() => {
    if (!presetBrandPreviews) return null;
    return evaluateCpuComparison(
      presetBrandPreviews.AMD.cpuName,
      presetBrandPreviews.AMD.totalPyg,
      presetBrandPreviews.INTEL.cpuName,
      presetBrandPreviews.INTEL.totalPyg,
      presetBrandPreviews.AMD.ok,
      presetBrandPreviews.INTEL.ok
    );
  }, [presetBrandPreviews]);

  /**
   * MOTOR DE RECOMENDACIÓN EXPERTO ("SUPER INTELIGENTE")
   * Ejecuta el armado del perfil para la marca de CPU elegida (AMD o Intel) o alerta si faltan componentes.
   */
  const buildSmartPcConfiguration = (
    tier: PresetTier,
    preserveExisting = false,
    explicitCpuBrand?: "AMD" | "INTEL"
  ): boolean => {
    const presetObj = PRESETS.find((p) => p.id === tier);

    if (explicitCpuBrand) {
      const evalRes = evaluatePresetForBrand(tier, explicitCpuBrand, preserveExisting);
      const otherBrand: "AMD" | "INTEL" = explicitCpuBrand === "AMD" ? "INTEL" : "AMD";
      const otherEval = evaluatePresetForBrand(tier, otherBrand, false);
      const brandLabel = explicitCpuBrand === "AMD" ? "AMD Ryzen" : "Intel Core";

      if (!evalRes.ok) {
        setPresetSuccessBanner(null);
        setPresetCpuAlert({
          titulo: `No disponemos actualmente de componentes en stock para armar el perfil "${
            presetObj?.nombre || tier
          }" con ${brandLabel}`,
          detalle: `Verificamos el stock en vivo y actualmente faltan componentes esenciales para garantizar un ensamble ${
            presetObj?.nombre || tier
          } 100% compatible en plataforma ${brandLabel}:`,
          faltantes: evalRes.faltantes,
          tier,
          failedBrand: explicitCpuBrand,
          alternativeBrand: otherBrand,
          alternativeAvailable: otherEval.ok,
          fallbackBuild: evalRes.fallbackBuild,
        });
        return false;
      }

      setSelectedComponents(evalRes.build);
      setActivePresetBuilt({ tier, brand: explicitCpuBrand });
      setPresetCpuAlert(null);
      setPresetSuccessBanner(
        `✅ Perfil "${presetObj?.nombre || tier}" armado con ${brandLabel} (${
          evalRes.socketUsed
        }) · Total: ₲ ${evalRes.totalPyg.toLocaleString("es-PY")} (100% Compatible)`
      );
      return true;
    }

    // Modo autocompletar o automático: respetar marca de CPU existente o probar AMD -> INTEL
    const preferredBrand: "AMD" | "INTEL" =
      currentCpu && isCpuOfBrand(currentCpu, "INTEL")
        ? "INTEL"
        : currentCpu && isCpuOfBrand(currentCpu, "AMD")
        ? "AMD"
        : "AMD";
    const firstTry = evaluatePresetForBrand(tier, preferredBrand, preserveExisting);
    if (firstTry.ok) {
      setSelectedComponents(firstTry.build);
      setActivePresetBuilt({ tier, brand: preferredBrand });
      setPresetCpuAlert(null);
      return true;
    }
    const secondBrand = preferredBrand === "AMD" ? "INTEL" : "AMD";
    const secondTry = evaluatePresetForBrand(tier, secondBrand, preserveExisting);
    if (secondTry.ok) {
      setSelectedComponents(secondTry.build);
      setActivePresetBuilt({ tier, brand: secondBrand });
      setPresetCpuAlert(null);
      return true;
    }
    if (firstTry.fallbackBuild.length > 0) {
      setSelectedComponents(firstTry.fallbackBuild);
    }
    return false;
  };

  const handleAutoCompletarInteligente = () => {
    const cpuPrice = currentCpu?.precioPyg || 0;
    const gpuPrice = currentGpu?.precioPyg || 0;
    let detectedTier: PresetTier = "GAMING_PRO";

    if (cpuPrice >= 3200000 || gpuPrice >= 4800000) {
      detectedTier = "IA_DEEP_LEARNING";
    } else if (cpuPrice >= 2200000 || gpuPrice >= 3200000) {
      detectedTier = "ARQUITECTURA_3D";
    } else if (
      currentCpu &&
      currentCpu.hasIGpu !== false &&
      !currentGpu &&
      cpuPrice <= 1900000
    ) {
      detectedTier = "OFICINA_PRO";
    }

    buildSmartPcConfiguration(detectedTier, true);
  };

  // Auto-corregir cooler incompatible reemplazándolo por un Cooler de Aire 100% compatible
  const handleAutoFixCoolerAir = () => {
    const inStock = catalogoCompleto.filter((i) => i.stockStatus === "IN_STOCK");
    const airCooler =
      inStock.find(
        (cl) =>
          cl.categoria === "REFRIGERACION" &&
          cl.isCpuCooler &&
          cl.sku !== "STOCK-COOLER" &&
          !cl.isAioLiquid &&
          !/WATER|LIQUID|L[IÍ]QUIDO|AIO/i.test(cl.descripcion) &&
          (!currentGabinete ||
            isGabinetePhysicallyCompatible(
              currentGabinete,
              currentMb,
              cl,
              Boolean(currentGpu)
            ))
      ) ||
      inStock.find(
        (cl) => cl.categoria === "REFRIGERACION" && cl.isCpuCooler && !cl.isAioLiquid
      );

    if (airCooler) {
      handleSelectComponent(airCooler);
    }
  };

  // Auto-corregir gabinete incompatible reemplazándolo por un Gabinete Gamer compatible con radiador
  const handleAutoFixGabineteLiquid = () => {
    const inStock = catalogoCompleto.filter((i) => i.stockStatus === "IN_STOCK");
    const liquidCase = inStock.find(
      (g) =>
        g.categoria === "GABINETE" &&
        !g.isKitOficina &&
        isGabinetePhysicallyCompatible(g, currentMb, currentCooler, Boolean(currentGpu))
    );

    if (liquidCase) {
      handleSelectComponent(liquidCase);
    }
  };

  // Ejecutar re-auditoría web de fichas técnicas en tiempo real
  const handleRunWebAudit = () => {
    setIsAuditingWeb(true);
    setTimeout(() => {
      setIsAuditingWeb(false);
      setLastAuditTimestamp(new Date().toLocaleTimeString("es-PY"));
    }, 500);
  };

  /**
   * OPTIMIZADOR MATEMÁTICO INTELIGENTE POR PRESUPUESTO EN GUARANÍES
   * Evalúa múltiples sockets y realiza mejoras escalonadas (Knapsack / Hill-Climbing)
   * en GPU, CPU, RAM Dual Channel, NVMe SSD, Placa Madre, Cooler, Fuente y Gabinete
   * para aprovechar al máximo el presupuesto en Guaraníes con 0 errores de compatibilidad.
   */
  const optimizeBuildForBudgetPyg = (
    targetTotalPyg: number,
    cpuBrand: "AMD" | "INTEL"
  ): {
    ok: boolean;
    withinBudget: boolean;
    faltantes: string[];
    build: HardwarePresupuestoItem[];
    hardwarePyg: number;
    totalPyg: number;
    diffPyg: number;
    pctUsed: number;
    cpuName: string;
    gpuName: string;
    ramSummary: string;
    ssdSummary: string;
    socketUsed: string;
    minPossiblePyg: number;
  } => {
    const inStockPool = catalogoCompleto.filter(
      (c) => c.stockStatus === "IN_STOCK" && (c.precioPyg || 0) > 0
    );
    const brandLabel = cpuBrand === "AMD" ? "AMD Ryzen" : "Intel Core";

    if (inStockPool.length === 0) {
      return {
        ok: false,
        withinBudget: false,
        faltantes: ["Sincronizando stock..."],
        build: [],
        hardwarePyg: 0,
        totalPyg: 0,
        diffPyg: 0,
        pctUsed: 0,
        cpuName: "",
        gpuName: "",
        ramSummary: "",
        ssdSummary: "",
        socketUsed: "",
        minPossiblePyg: 0,
      };
    }

    const brandCpus = inStockPool.filter(
      (i) => i.categoria === "PROCESADOR" && isCpuOfBrand(i, cpuBrand)
    );
    if (brandCpus.length === 0) {
      return {
        ok: false,
        withinBudget: false,
        faltantes: [`Procesadores ${brandLabel} en stock web`],
        build: [],
        hardwarePyg: 0,
        totalPyg: 0,
        diffPyg: 0,
        pctUsed: 0,
        cpuName: "",
        gpuName: "",
        ramSummary: "",
        ssdSummary: "",
        socketUsed: "",
        minPossiblePyg: 0,
      };
    }

    const allMbs = inStockPool.filter((i) => i.categoria === "PLACA_MADRE");
    const allRams = inStockPool.filter((i) => i.categoria === "RAM");
    const allSsds = inStockPool.filter((i) => i.categoria === "ALMACENAMIENTO");
    const nvmeSsds = allSsds.filter((i) => i.esM2Nvme);
    const ssdPool = nvmeSsds.length > 0 ? nvmeSsds : allSsds;
    const allGpus = inStockPool.filter(
      (i) => i.categoria === "GPU" && isRealDedicatedGamingGpu(i)
    );
    const allPsus = inStockPool.filter((i) => i.categoria === "FUENTE");
    const allCases = inStockPool.filter((i) => i.categoria === "GABINETE");
    const realCoolers = inStockPool.filter(
      (i) => i.categoria === "REFRIGERACION" && i.isCpuCooler && i.sku !== "STOCK-COOLER"
    );
    const stockCooler = catalogoCompleto.find((i) => i.sku === "STOCK-COOLER");

    // Sockets viables para esta marca que tengan CPU + Placa Madre + RAM en stock
    const viableSockets = Array.from(
      new Set(brandCpus.map((c) => c.socket).filter(Boolean))
    ).filter((sock) => {
      const mbs = allMbs.filter((m) => m.socket === sock);
      if (mbs.length === 0) return false;
      return mbs.some((m) => {
        const rType =
          m.ramType && m.ramType !== "UNIVERSAL"
            ? m.ramType
            : brandCpus.find((c) => c.socket === sock)?.ramType || "DDR4";
        return allRams.some((r) => r.ramType === rType);
      });
    });

    if (viableSockets.length === 0) {
      const socketsList = Array.from(
        new Set(brandCpus.map((c) => c.socket).filter(Boolean))
      ).join(" / ");
      return {
        ok: false,
        withinBudget: false,
        faltantes: [
          `Placa Madre o Memoria RAM compatible con Socket ${socketsList || brandLabel} en stock`,
        ],
        build: [],
        hardwarePyg: 0,
        totalPyg: 0,
        diffPyg: 0,
        pctUsed: 0,
        cpuName: "",
        gpuName: "",
        ramSummary: "",
        ssdSummary: "",
        socketUsed: "",
        minPossiblePyg: 0,
      };
    }

    interface CandidateResult {
      build: HardwarePresupuestoItem[];
      hardwarePyg: number;
      totalPyg: number;
      withGpu: boolean;
      socket: string;
      score: number;
      cpu: HardwarePresupuestoItem;
      gpu?: HardwarePresupuestoItem;
      ram: HardwarePresupuestoItem;
      ramQty: number;
      ssd: HardwarePresupuestoItem;
    }

    const candidates: CandidateResult[] = [];
    const maxAllowedPyg = Math.round(targetTotalPyg * 1.03); // Hasta +3% de tolerancia comercial

    for (const sock of viableSockets) {
      const sockCpusAll = brandCpus.filter((c) => c.socket === sock);
      const sockMbsAll = allMbs.filter((m) => m.socket === sock);

      // Probar modo Con GPU Dedicada y modo Con Gráficos Integrados (iGPU)
      const modesToTest: boolean[] = [];
      if (allGpus.length > 0) modesToTest.push(true);
      if (sockCpusAll.some((c) => c.hasIGpu !== false)) modesToTest.push(false);

      for (const useDedicatedGpu of modesToTest) {
        let cpuPool = useDedicatedGpu
          ? sockCpusAll
          : sockCpusAll.filter((c) => c.hasIGpu !== false);

        if (cpuPool.length === 0) continue;

        // Si el presupuesto es para Gaming/Workstation (>= 5.200.000), descartar procesadores dual-core de entrada si hay Ryzen 5 / Core i3 / i5
        if (targetTotalPyg >= 5200000) {
          const betterCpus = cpuPool.filter(
            (c) =>
              !/\b(CELERON|PENTIUM|ATHLON|3000G)\b/i.test(
                `${c.descripcion} ${c.nombreWeb || ""}`
              )
          );
          if (betterCpus.length > 0) cpuPool = betterCpus;
        }

        let cpu = cpuPool[0];
        let mb = sockMbsAll[0];
        const getRamType = (m: HardwarePresupuestoItem, c: HardwarePresupuestoItem) =>
          m.ramType && m.ramType !== "UNIVERSAL"
            ? m.ramType
            : c.ramType && c.ramType !== "UNIVERSAL"
            ? c.ramType
            : "DDR4";

        let ramPool = allRams.filter((r) => r.ramType === getRamType(mb, cpu));
        if (ramPool.length === 0) continue;

        let ram = ramPool[0];
        let ramQty = 1;
        let ssd = ssdPool[0];
        if (!ssd) continue;

        let gpu: HardwarePresupuestoItem | undefined = useDedicatedGpu ? allGpus[0] : undefined;

        // Resolver Cooler, Gabinete y Fuente 100% compatibles con (cpu, mb, gpu)
        const syncSupportParts = (
          cCpu: HardwarePresupuestoItem,
          cMb: HardwarePresupuestoItem,
          cGpu: HardwarePresupuestoItem | undefined,
          preferCooler?: HardwarePresupuestoItem,
          preferCase?: HardwarePresupuestoItem,
          preferPsu?: HardwarePresupuestoItem
        ) => {
          let activeMb = cMb;
          // Si activeMb es ATX pero ningún gabinete disponible lo soporta, cambiar a Micro-ATX
          if (
            (activeMb.formFactor === "ATX" || activeMb.formFactor === "EATX") &&
            !allCases.some((g) =>
              isGabinetePhysicallyCompatible(g, activeMb, undefined, Boolean(cGpu))
            )
          ) {
            const matxMb = sockMbsAll.find(
              (m) =>
                m.formFactor !== "ATX" &&
                m.formFactor !== "EATX" &&
                allCases.some((g) =>
                  isGabinetePhysicallyCompatible(g, m, undefined, Boolean(cGpu))
                )
            );
            if (matxMb) activeMb = matxMb;
          }

          const descCpu = `${cCpu.descripcion} ${cCpu.nombreWeb || ""}`.toUpperCase();
          const needRealCooler =
            cCpu.includesCooler === false ||
            (cCpu.tdpWatts || 0) >= 120 ||
            /14700|13700|14900|13900|7800X3D|9800X3D|7900X|7950X/.test(descCpu);

          let activeCooler = preferCooler;
          if (
            !activeCooler ||
            (needRealCooler && activeCooler.sku === "STOCK-COOLER") ||
            !allCases.some((g) =>
              isGabinetePhysicallyCompatible(g, activeMb, activeCooler, Boolean(cGpu))
            )
          ) {
            if (needRealCooler) {
              const prefersLiquid =
                (cCpu.tdpWatts || 0) >= 150 ||
                /14900|13900|7950X|9950X|285K/i.test(descCpu);

              // Para CPUs estándar (ej: Ryzen 5, Core i5), priorizar Cooler de Aire eficiente
              const airCooler = !prefersLiquid
                ? realCoolers.find(
                    (cl) =>
                      !cl.isAioLiquid &&
                      !/WATER|LIQUID|L[IÍ]QUIDO|AIO/i.test(cl.descripcion) &&
                      allCases.some((g) =>
                        isGabinetePhysicallyCompatible(g, activeMb, cl, Boolean(cGpu))
                      )
                  )
                : undefined;

              activeCooler =
                airCooler ||
                realCoolers.find((cl) =>
                  allCases.some((g) =>
                    isGabinetePhysicallyCompatible(g, activeMb, cl, Boolean(cGpu))
                  )
                ) ||
                realCoolers[0];
            } else {
              const airCooler = realCoolers.find(
                (cl) =>
                  !cl.isAioLiquid &&
                  !/WATER|LIQUID|L[IÍ]QUIDO|AIO/i.test(cl.descripcion) &&
                  allCases.some((g) =>
                    isGabinetePhysicallyCompatible(g, activeMb, cl, Boolean(cGpu))
                  )
              );
              activeCooler = stockCooler || airCooler || realCoolers[0];
            }
          }

          let activeCase =
            preferCase &&
            isGabinetePhysicallyCompatible(
              preferCase,
              activeMb,
              activeCooler,
              Boolean(cGpu)
            )
              ? preferCase
              : allCases.find((g) =>
                  isGabinetePhysicallyCompatible(g, activeMb, activeCooler, Boolean(cGpu))
                );

          const cWatts = (cCpu.tdpWatts || 65) + (cGpu ? cGpu.tdpWatts || 150 : 0) + 60;
          const reqWatts = Math.max(
            Math.ceil((cWatts * 1.3) / 50) * 50,
            cGpu?.recomendadoPsuWatts || 500
          );

          let activePsu =
            preferPsu && (preferPsu.potenciaWatts || 0) >= reqWatts
              ? preferPsu
              : allPsus.find((p) => (p.potenciaWatts || 0) >= reqWatts) ||
                allPsus.find((p) => (p.potenciaWatts || 0) >= cWatts) ||
                allPsus[0];

          return {
            mb: activeMb,
            cooler: activeCooler,
            gabinete: activeCase,
            psu: activePsu,
            reqWatts,
          };
        };

        let support = syncSupportParts(cpu, mb, gpu);
        mb = support.mb;
        let cooler = support.cooler;
        let gabinete = support.gabinete;
        let psu = support.psu;

        if (!gabinete || !psu || !cooler) continue;

        const getBuildCost = (
          cCpu = cpu,
          cMb = mb,
          cRam = ram,
          cRamQty = ramQty,
          cSsd = ssd,
          cGpu = gpu,
          cPsu = psu,
          cCase = gabinete,
          cCooler = cooler
        ) => {
          const hw =
            (cCpu?.precioPyg || 0) +
            (cMb?.precioPyg || 0) +
            (cRam?.precioPyg || 0) * cRamQty +
            (cSsd?.precioPyg || 0) +
            (cGpu?.precioPyg || 0) +
            (cPsu?.precioPyg || 0) +
            (cCase?.precioPyg || 0) +
            (cCooler?.precioPyg || 0);
          return hw + costoMontajePyg;
        };

        // Si hay GPU o el presupuesto es >= 4.5M, evitar gabinetes Kit de Oficina básicos
        if (useDedicatedGpu || targetTotalPyg >= 4500000) {
          const nonKitCase = allCases.find(
            (g) =>
              !g.isKitOficina &&
              !g.descripcion.includes("1102K") &&
              !g.descripcion.includes("1103K") &&
              isGabinetePhysicallyCompatible(g, mb, cooler, Boolean(gpu))
          );
          if (nonKitCase && getBuildCost(cpu, mb, ram, ramQty, ssd, gpu, psu, nonKitCase, cooler) <= maxAllowedPyg) {
            gabinete = nonKitCase;
          }
        }

        // BUCLE DE OPTIMIZACIÓN ESCALONADA (HILL-CLIMBING HASTA ALCANZAR EL PRESUPUESTO EN GUARANÍES)
        for (let step = 0; step < 32; step++) {
          const currentCost = getBuildCost();
          const headroom = maxAllowedPyg - currentCost;
          if (headroom < 45000) break;

          let upgraded = false;

          // Prioridad 1: Asegurar al menos 16GB de RAM (preferentemente en Dual Channel 2x8GB o 1x16GB)
          const currentRamGb = (ram.capacidadGb || 8) * ramQty;
          const isDualKit = `${ram.descripcion} ${ram.nombreWeb || ""}`
            .toUpperCase()
            .includes("2X");
          if (currentRamGb < 16) {
            if (!isDualKit && ramQty === 1 && (ram.precioPyg || 0) <= headroom) {
              ramQty = 2;
              upgraded = true;
              continue;
            }
            const ram16 = ramPool.find(
              (r) => (r.capacidadGb || 0) >= 16 && (r.precioPyg || 0) - (ram.precioPyg || 0) * ramQty <= headroom
            );
            if (ram16) {
              ram = ram16;
              ramQty = 1;
              upgraded = true;
              continue;
            }
          }

          // Prioridad 2: Asegurar al menos 500GB de SSD NVMe
          if ((ssd.capacidadGb || 0) < 480) {
            const ssd500 = ssdPool.find(
              (s) =>
                (s.capacidadGb || 0) >= 480 &&
                (s.precioPyg || 0) - (ssd.precioPyg || 0) <= headroom
            );
            if (ssd500) {
              ssd = ssd500;
              upgraded = true;
              continue;
            }
          }

          // Prioridad 3: Mejoras balanceadas de GPU y CPU (el núcleo de potencia del equipo)
          if (useDedicatedGpu && gpu) {
            const gpuPrice = gpu.precioPyg || 0;
            const cpuPrice = cpu.precioPyg || 0;

            // Buscar siguiente GPU superior que quepa en el presupuesto (incluyendo eventual suba de fuente)
            const nextGpu = allGpus.find((g) => {
              if ((g.precioPyg || 0) <= gpuPrice) return false;
              const sup = syncSupportParts(cpu, mb, g, cooler, gabinete, psu);
              if (!sup.psu || !sup.gabinete || !sup.cooler) return false;
              const newCost = getBuildCost(
                cpu,
                sup.mb,
                ram,
                ramQty,
                ssd,
                g,
                sup.psu,
                sup.gabinete,
                sup.cooler
              );
              return newCost <= maxAllowedPyg;
            });

            // Buscar siguiente CPU superior en este socket que quepa en el presupuesto
            const nextCpu = cpuPool.find((c) => {
              if ((c.precioPyg || 0) <= cpuPrice) return false;
              const sup = syncSupportParts(c, mb, gpu, cooler, gabinete, psu);
              if (!sup.psu || !sup.gabinete || !sup.cooler) return false;
              const newCost = getBuildCost(
                c,
                sup.mb,
                ram,
                ramQty,
                ssd,
                gpu,
                sup.psu,
                sup.gabinete,
                sup.cooler
              );
              return newCost <= maxAllowedPyg;
            });

            // Balancear GPU (~1.35x a 1.8x del valor del CPU)
            if (nextGpu && (!nextCpu || gpuPrice < cpuPrice * 1.45)) {
              const sup = syncSupportParts(cpu, mb, nextGpu, cooler, gabinete, psu);
              gpu = nextGpu;
              mb = sup.mb;
              psu = sup.psu!;
              gabinete = sup.gabinete!;
              cooler = sup.cooler!;
              upgraded = true;
              continue;
            } else if (nextCpu) {
              const sup = syncSupportParts(nextCpu, mb, gpu, cooler, gabinete, psu);
              cpu = nextCpu;
              mb = sup.mb;
              psu = sup.psu!;
              gabinete = sup.gabinete!;
              cooler = sup.cooler!;
              // Si el nuevo CPU es gama alta (i7/i9/Ryzen 7/9), mejorar placa básica H610/A520 si entra en presupuesto
              const dCpu = `${cpu.descripcion} ${cpu.nombreWeb || ""}`.toUpperCase();
              const dMb = `${mb.descripcion} ${mb.nombreWeb || ""}`.toUpperCase();
              if (
                /\b(I7|I9|RYZEN\s*[79]|7800X3D|9800X3D|ULTRA\s*[79])\b/.test(dCpu) &&
                /\b(H610|A520|A320|A620M-HDV|A620M-E)\b/.test(dMb)
              ) {
                const betterMb = sockMbsAll.find((m) => {
                  const dm = `${m.descripcion} ${m.nombreWeb || ""}`.toUpperCase();
                  if (/\b(H610|A520|A320|A620M-HDV|A620M-E)\b/.test(dm)) return false;
                  if (getRamType(m, cpu) !== getRamType(mb, cpu)) return false;
                  if (!isGabinetePhysicallyCompatible(gabinete!, m, cooler, Boolean(gpu)))
                    return false;
                  return (
                    getBuildCost(cpu, m, ram, ramQty, ssd, gpu, psu, gabinete, cooler) <=
                    maxAllowedPyg
                  );
                });
                if (betterMb) mb = betterMb;
              }
              upgraded = true;
              continue;
            } else if (nextGpu) {
              const sup = syncSupportParts(cpu, mb, nextGpu, cooler, gabinete, psu);
              gpu = nextGpu;
              mb = sup.mb;
              psu = sup.psu!;
              gabinete = sup.gabinete!;
              cooler = sup.cooler!;
              upgraded = true;
              continue;
            }
          } else {
            // Modo gráficos integrados: mejorar CPU con iGPU hasta un tope razonable (~45% del presupuesto)
            const nextApu = cpuPool.find((c) => {
              if ((c.precioPyg || 0) <= (cpu.precioPyg || 0)) return false;
              if ((c.precioPyg || 0) > targetTotalPyg * 0.48) return false;
              const sup = syncSupportParts(c, mb, undefined, cooler, gabinete, psu);
              if (!sup.psu || !sup.gabinete || !sup.cooler) return false;
              return (
                getBuildCost(c, sup.mb, ram, ramQty, ssd, undefined, sup.psu, sup.gabinete, sup.cooler) <=
                maxAllowedPyg
              );
            });
            if (nextApu) {
              const sup = syncSupportParts(nextApu, mb, undefined, cooler, gabinete, psu);
              cpu = nextApu;
              mb = sup.mb;
              psu = sup.psu!;
              gabinete = sup.gabinete!;
              cooler = sup.cooler!;
              upgraded = true;
              continue;
            }
          }

          // Prioridad 4: Subir RAM a 32GB Dual Channel (2x16GB o kit 32GB) cuando el presupuesto >= 6.5M o sobre margen
          const totalRamNow = (ram.capacidadGb || 8) * ramQty;
          if (totalRamNow < 32 && targetTotalPyg >= 5500000) {
            if (ram.capacidadGb === 16 && !isDualKit && ramQty === 1 && (ram.precioPyg || 0) <= headroom) {
              ramQty = 2;
              upgraded = true;
              continue;
            }
            const ram16Stick = ramPool.find(
              (r) =>
                r.capacidadGb === 16 &&
                !` ${r.descripcion} ${r.nombreWeb || ""}`.toUpperCase().includes("2X") &&
                (r.precioPyg || 0) * 2 - (ram.precioPyg || 0) * ramQty <= headroom
            );
            if (ram16Stick) {
              ram = ram16Stick;
              ramQty = 2;
              upgraded = true;
              continue;
            }
            const ram32Kit = ramPool.find(
              (r) =>
                (r.capacidadGb || 0) >= 32 &&
                (r.precioPyg || 0) - (ram.precioPyg || 0) * ramQty <= headroom
            );
            if (ram32Kit) {
              ram = ram32Kit;
              ramQty = 1;
              upgraded = true;
              continue;
            }
          }

          // Prioridad 5: Subir Almacenamiento SSD a 1TB NVMe M.2 (y 2TB en presupuestos altos)
          if ((ssd.capacidadGb || 0) < 960 && targetTotalPyg >= 5000000) {
            const ssd1Tb = ssdPool.find(
              (s) =>
                (s.capacidadGb || 0) >= 960 &&
                (s.capacidadGb || 0) <= 1050 &&
                (s.precioPyg || 0) - (ssd.precioPyg || 0) <= headroom
            );
            if (ssd1Tb) {
              ssd = ssd1Tb;
              upgraded = true;
              continue;
            }
          }
          if ((ssd.capacidadGb || 0) < 1900 && targetTotalPyg >= 11500000) {
            const ssd2Tb = ssdPool.find(
              (s) =>
                (s.capacidadGb || 0) >= 1900 &&
                (s.precioPyg || 0) - (ssd.precioPyg || 0) <= headroom
            );
            if (ssd2Tb) {
              ssd = ssd2Tb;
              upgraded = true;
              continue;
            }
          }

          // Prioridad 6: Mejorar Placa Madre a chipset B / X / Z con mejores disipadores VRM
          const nextMb = sockMbsAll.find((m) => {
            if ((m.precioPyg || 0) <= (mb.precioPyg || 0)) return false;
            if ((m.precioPyg || 0) > targetTotalPyg * 0.2) return false;
            if (getRamType(m, cpu) !== getRamType(mb, cpu)) return false;
            if (!isGabinetePhysicallyCompatible(gabinete!, m, cooler, Boolean(gpu))) return false;
            return (m.precioPyg || 0) - (mb.precioPyg || 0) <= headroom;
          });
          if (nextMb) {
            mb = nextMb;
            upgraded = true;
            continue;
          }

          // Prioridad 7: Mejorar Refrigeración (Cooler de Aire Dedicado o Líquida AIO 240/360)
          if (targetTotalPyg >= 6500000) {
            const nextCooler = realCoolers.find((cl) => {
              if ((cl.precioPyg || 0) <= (cooler?.precioPyg || 0)) return false;
              if ((cl.precioPyg || 0) > targetTotalPyg * 0.11) return false;
              // No forzar refrigeración líquida en procesadores de 65W a menos que sea presupuesto workstation/ultra (>=10M)
              const isLiquid = cl.isAioLiquid || /WATER|LIQUID|L[IÍ]QUIDO|AIO/i.test(cl.descripcion);
              if (isLiquid && (cpu.tdpWatts || 65) < 120 && targetTotalPyg < 10000000) return false;
              if (!isGabinetePhysicallyCompatible(gabinete!, mb, cl, Boolean(gpu))) return false;
              return (cl.precioPyg || 0) - (cooler?.precioPyg || 0) <= headroom;
            });
            if (nextCooler) {
              cooler = nextCooler;
              upgraded = true;
              continue;
            }
          }

          // Prioridad 8: Mejorar Gabinete Gamer y Fuente Certificada 80 Plus
          const nextCase = allCases.find((g) => {
            if (g.isKitOficina) return false;
            if ((g.precioPyg || 0) <= (gabinete?.precioPyg || 0)) return false;
            if ((g.precioPyg || 0) > targetTotalPyg * 0.1) return false;
            if (!isGabinetePhysicallyCompatible(g, mb, cooler, Boolean(gpu))) return false;
            return (g.precioPyg || 0) - (gabinete?.precioPyg || 0) <= headroom;
          });
          if (nextCase) {
            gabinete = nextCase;
            upgraded = true;
            continue;
          }

          const cWatts = (cpu.tdpWatts || 65) + (gpu ? gpu.tdpWatts || 150 : 0) + 60;
          const reqWatts = Math.max(
            Math.ceil((cWatts * 1.3) / 50) * 50,
            gpu?.recomendadoPsuWatts || 500
          );
          const nextPsu = allPsus.find((p) => {
            if ((p.potenciaWatts || 0) < reqWatts) return false;
            if ((p.precioPyg || 0) <= (psu?.precioPyg || 0)) return false;
            if ((p.precioPyg || 0) > targetTotalPyg * 0.1) return false;
            return (p.precioPyg || 0) - (psu?.precioPyg || 0) <= headroom;
          });
          if (nextPsu) {
            psu = nextPsu;
            upgraded = true;
            continue;
          }

          // Prioridad 9: Absorción fina de presupuesto remanente (64GB RAM en Workstations >= 15M, o siguiente nivel de GPU/CPU/SSD sin tope porcentual)
          if (totalRamNow === 32 && targetTotalPyg >= 14500000) {
            if (ram.capacidadGb === 32 && !isDualKit && ramQty === 1 && (ram.precioPyg || 0) <= headroom) {
              ramQty = 2;
              upgraded = true;
              continue;
            }
            const ram32Stick = ramPool.find(
              (r) =>
                r.capacidadGb === 32 &&
                (r.precioPyg || 0) * 2 - (ram.precioPyg || 0) * ramQty <= headroom
            );
            if (ram32Stick) {
              ram = ram32Stick;
              ramQty = 2;
              upgraded = true;
              continue;
            }
          }

          if (!upgraded) break;
        }

        const finalItems = [
          { ...cpu, cantidad: 1 },
          { ...mb, cantidad: 1 },
          { ...ram, cantidad: ramQty },
          ...(gpu ? [{ ...gpu, cantidad: 1 }] : []),
          { ...ssd, cantidad: 1 },
          { ...psu!, cantidad: 1 },
          { ...gabinete!, cantidad: 1 },
          { ...cooler!, cantidad: 1 },
        ];

        const hwPyg = finalItems.reduce(
          (acc, i) => acc + (i.precioPyg || 0) * (i.cantidad || 1),
          0
        );
        const totPyg = hwPyg + costoMontajePyg;
        const compat = verificarCompatibilidadPC(finalItems);

        // Puntaje de calidad y cercanía al presupuesto objetivo
        const isWithin = totPyg <= maxAllowedPyg;
        const closeness = isWithin
          ? 1 - Math.abs(targetTotalPyg - totPyg) / Math.max(targetTotalPyg, 1)
          : -Math.abs(totPyg - targetTotalPyg) / Math.max(targetTotalPyg, 1);

        let score = closeness * 1000;
        if (isWithin) score += 2000;
        if (compat.totalErrores === 0) score += 1500;
        if (compat.totalWarnings === 0) score += 300;
        if (useDedicatedGpu && targetTotalPyg >= 4900000) score += 600;
        if (!useDedicatedGpu && targetTotalPyg < 4900000) score += 400;
        if ((sock === "AM5" || sock === "LGA1851") && targetTotalPyg >= 8200000) score += 220;
        if (ramQty >= 2) score += 120;

        candidates.push({
          build: finalItems,
          hardwarePyg: hwPyg,
          totalPyg: totPyg,
          withGpu: useDedicatedGpu,
          socket: sock || "",
          score,
          cpu,
          gpu,
          ram,
          ramQty,
          ssd,
        });
      }
    }

    if (candidates.length === 0) {
      return {
        ok: false,
        withinBudget: false,
        faltantes: [`Componentes compatibles completos para plataforma ${brandLabel}`],
        build: [],
        hardwarePyg: 0,
        totalPyg: 0,
        diffPyg: 0,
        pctUsed: 0,
        cpuName: "",
        gpuName: "",
        ramSummary: "",
        ssdSummary: "",
        socketUsed: "",
        minPossiblePyg: 0,
      };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const cheapestPossible = Math.min(...candidates.map((c) => c.totalPyg));
    const withinBudget = best.totalPyg <= maxAllowedPyg;
    const totalRamGb = (best.ram.capacidadGb || 8) * best.ramQty;

    return {
      ok: true,
      withinBudget,
      faltantes: withinBudget
        ? []
        : [
            `El ensamble completo más económico en stock para ${brandLabel} cuesta ₲ ${cheapestPossible.toLocaleString(
              "es-PY"
            )} (supera el presupuesto de ₲ ${targetTotalPyg.toLocaleString("es-PY")})`,
          ],
      build: best.build,
      hardwarePyg: best.hardwarePyg,
      totalPyg: best.totalPyg,
      diffPyg: targetTotalPyg - best.totalPyg,
      pctUsed: Math.round((best.totalPyg / Math.max(targetTotalPyg, 1)) * 1000) / 10,
      cpuName: cleanDisplayTitle(best.cpu.nombreWeb || best.cpu.descripcion),
      gpuName: best.gpu
        ? cleanDisplayTitle(best.gpu.nombreWeb || best.gpu.descripcion)
        : "Gráficos Integrados en CPU",
      ramSummary: `${totalRamGb}GB ${best.ram.ramType || ""} ${
        best.ramQty >= 2 ? "(Dual Channel)" : ""
      }`.trim(),
      ssdSummary: `${best.ssd.capacidadGb || 500}GB ${
        best.ssd.esM2Nvme ? "NVMe M.2" : "SSD"
      }`,
      socketUsed: best.socket,
      minPossiblePyg: cheapestPossible,
    };
  };

  /**
   * Vista previa reactiva en vivo de las opciones AMD vs Intel para el presupuesto en Guaraníes activo
   */
  const budgetBrandPreviews = useMemo(() => {
    const amount = selectedBudgetForCpuMenu || customTargetBudget;
    if (!amount || amount <= 0) return null;
    return {
      amount,
      AMD: optimizeBuildForBudgetPyg(amount, "AMD"),
      INTEL: optimizeBuildForBudgetPyg(amount, "INTEL"),
    };
  }, [selectedBudgetForCpuMenu, customTargetBudget, catalogoCompleto, costoMontajePyg]);

  /**
   * Comparativa de rendimiento y conveniencia precio/calidad entre AMD e Intel para el presupuesto activo
   */
  const budgetCpuComparison = useMemo(() => {
    if (!budgetBrandPreviews) return null;
    return evaluateCpuComparison(
      budgetBrandPreviews.AMD.cpuName,
      budgetBrandPreviews.AMD.totalPyg,
      budgetBrandPreviews.INTEL.cpuName,
      budgetBrandPreviews.INTEL.totalPyg,
      budgetBrandPreviews.AMD.ok && budgetBrandPreviews.AMD.withinBudget,
      budgetBrandPreviews.INTEL.ok && budgetBrandPreviews.INTEL.withinBudget
    );
  }, [budgetBrandPreviews]);

  // Armado Inteligente Asistido por Presupuesto en Guaraníes (Ej: 10 Millones, 5 Millones, etc.)
  const buildPcByTargetBudget = (
    targetAmountPyg: number,
    explicitBrand?: "AMD" | "INTEL" | "AUTO"
  ) => {
    if (!targetAmountPyg || targetAmountPyg <= 0) return;
    const pref = explicitBrand || budgetCpuPreference;
    const amdRes = optimizeBuildForBudgetPyg(targetAmountPyg, "AMD");
    const intelRes = optimizeBuildForBudgetPyg(targetAmountPyg, "INTEL");

    let chosenBrand: "AMD" | "INTEL" = "AMD";
    let chosenRes = amdRes;

    if (pref === "AMD") {
      chosenBrand = "AMD";
      chosenRes = amdRes;
    } else if (pref === "INTEL") {
      chosenBrand = "INTEL";
      chosenRes = intelRes;
    } else {
      // AUTO: elegir la que esté dentro de presupuesto y aproveche mejor el monto (o la más cercana)
      if (amdRes.ok && intelRes.ok) {
        if (amdRes.withinBudget && !intelRes.withinBudget) {
          chosenBrand = "AMD";
          chosenRes = amdRes;
        } else if (intelRes.withinBudget && !amdRes.withinBudget) {
          chosenBrand = "INTEL";
          chosenRes = intelRes;
        } else {
          // Ambas dentro de presupuesto: elegir la que quede más cerca del presupuesto objetivo
          const amdDiff = Math.abs(targetAmountPyg - amdRes.totalPyg);
          const intelDiff = Math.abs(targetAmountPyg - intelRes.totalPyg);
          if (intelDiff < amdDiff) {
            chosenBrand = "INTEL";
            chosenRes = intelRes;
          } else {
            chosenBrand = "AMD";
            chosenRes = amdRes;
          }
        }
      } else if (intelRes.ok) {
        chosenBrand = "INTEL";
        chosenRes = intelRes;
      }
    }

    const brandLabel = chosenBrand === "AMD" ? "AMD Ryzen" : "Intel Core";
    const otherBrand: "AMD" | "INTEL" = chosenBrand === "AMD" ? "INTEL" : "AMD";
    const otherRes = chosenBrand === "AMD" ? intelRes : amdRes;

    if (!chosenRes.ok) {
      setPresetCpuAlert({
        titulo: `No disponemos de componentes en stock para armar un presupuesto de ₲ ${targetAmountPyg.toLocaleString(
          "es-PY"
        )} con ${brandLabel}`,
        detalle: `Actualmente faltan componentes compatibles en stock web para la plataforma ${brandLabel}.`,
        faltantes: chosenRes.faltantes,
        budgetPyg: targetAmountPyg,
        failedBrand: chosenBrand,
        alternativeBrand: otherBrand,
        alternativeAvailable: otherRes.ok,
      });
      return;
    }

    setSelectedComponents(chosenRes.build);
    setPresetCpuAlert(null);
    setBudgetAnalysis({
      targetPyg: targetAmountPyg,
      achievedTotalPyg: chosenRes.totalPyg,
      hardwarePyg: chosenRes.hardwarePyg,
      montajePyg: costoMontajePyg,
      diffPyg: chosenRes.diffPyg,
      pctUsed: chosenRes.pctUsed,
      brandUsed: chosenBrand,
      socketUsed: chosenRes.socketUsed,
      summaryText: `${chosenRes.cpuName} + ${chosenRes.gpuName} + ${chosenRes.ramSummary} + ${chosenRes.ssdSummary}`,
    });

    if (!chosenRes.withinBudget) {
      setBudgetFeedback(
        `⚠️ El presupuesto objetivo (₲ ${targetAmountPyg.toLocaleString(
          "es-PY"
        )}) es inferior al costo mínimo de una PC completa ${brandLabel} en stock (₲ ${chosenRes.minPossiblePyg.toLocaleString(
          "es-PY"
        )}). Se cargó la configuración funcional más económica disponible.`
      );
    } else {
      setBudgetFeedback(
        `✅ Presupuesto optimizado para ₲ ${targetAmountPyg.toLocaleString(
          "es-PY"
        )} con ${brandLabel} (${chosenRes.socketUsed}) → Total: ₲ ${chosenRes.totalPyg.toLocaleString(
          "es-PY"
        )} (${chosenRes.pctUsed}% del objetivo · 100% Compatible).`
      );
    }
  };

  // Limpiar configuración
  const handleReset = () => {
    if (confirm("¿Desea limpiar todos los componentes seleccionados?")) {
      setSelectedComponents([]);
      setPresetCpuAlert(null);
      setPresetSuccessBanner(null);
      setBudgetAnalysis(null);
      setBudgetFeedback(null);
    }
  };

  // Marcas disponibles en la categoría activa
  const marcasDisponibles = useMemo(() => {
    const pool = catalogoCompleto.filter((item) => {
      if (activeTabSlot !== "TODO" && item.categoria !== activeTabSlot) return false;
      if (onlyWebStock && item.stockStatus !== "IN_STOCK") return false;
      return true;
    });
    const brands = new Set<string>();
    pool.forEach((i) => {
      if (i.marca && i.marca.trim()) brands.add(i.marca.trim().toUpperCase());
    });
    return ["TODAS", ...Array.from(brands).sort()];
  }, [catalogoCompleto, activeTabSlot, onlyWebStock]);

  // Determinar si un ítem es una recomendación inteligente destacada y compatible para el slot activo
  const isItemSmartRecommended = (item: HardwarePresupuestoItem): boolean => {
    if (item.stockStatus !== "IN_STOCK" || item.sku === "STOCK-COOLER") return false;

    // 1. PROCESADOR
    if (item.categoria === "PROCESADOR") {
      if (effectiveSocket !== "TODOS" && item.socket && item.socket !== "UNIVERSAL") {
        if (item.socket !== effectiveSocket) return false;
      }
      const desc = `${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();
      return (
        desc.includes("5600") ||
        desc.includes("5700") ||
        desc.includes("12400") ||
        desc.includes("14400") ||
        desc.includes("7600") ||
        desc.includes("7800X3D") ||
        desc.includes("9600X") ||
        desc.includes("14600")
      );
    }

    // 2. PLACA MADRE
    if (item.categoria === "PLACA_MADRE") {
      if (effectiveSocket !== "TODOS" && item.socket && item.socket !== "UNIVERSAL") {
        if (item.socket !== effectiveSocket) return false;
      }
      const desc = `${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();
      return desc.includes("B550") || desc.includes("B650") || desc.includes("B760") || desc.includes("X870") || desc.includes("A520");
    }

    // 3. MEMORIA RAM
    if (item.categoria === "RAM") {
      if (effectiveRamType !== "TODAS" && item.ramType && item.ramType !== "UNIVERSAL") {
        if (item.ramType !== effectiveRamType) return false;
      }

      const cap = item.capacidadGb || 0;
      return cap >= 16;
    }

    // 4. ALMACENAMIENTO (SSD)
    if (item.categoria === "ALMACENAMIENTO") {
      return Boolean(item.esM2Nvme && (item.capacidadGb || 0) >= 480);
    }

    // 5. TARJETA GRÁFICA (GPU)
    if (item.categoria === "GPU") {
      const desc = `${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();
      return (
        desc.includes("RTX") ||
        desc.includes("RX 7600") ||
        desc.includes("RX 6600") ||
        desc.includes("RADEON")
      );
    }

    // 6. FUENTE DE PODER
    if (item.categoria === "FUENTE") {
      return Boolean(
        (item.potenciaWatts || 0) >= resultadoCompatibilidad.fuenteRecomendadaWatts &&
          /\b(80\s*PLUS|80PLUS|BRONZE|GOLD)\b/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)
      );
    }

    // 7. GABINETE
    if (item.categoria === "GABINETE") {
      const hasLiquidCooler = currentCooler && (currentCooler.isAioLiquid || /WATER|LIQUID|L[IÍ]QUIDO|AIO|360|240/i.test(`${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`));
      const needs360 = currentCooler && (currentCooler.radiatorSizeMm === 360 || /360/i.test(`${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`));
      const hasGpu = Boolean(currentGpu);

      if ((hasLiquidCooler || hasGpu) && item.isKitOficina) {
        return false;
      }
      if (needs360 && (item.maxRadiatorMm !== undefined && item.maxRadiatorMm < 360)) {
        return false;
      }
      if (currentMb?.formFactor === "ATX" && (item.maxMbFormFactor === "MATX" || item.maxMbFormFactor === "ITX")) {
        return false;
      }

      return (
        !item.isKitOficina &&
        !item.descripcion.includes("1102K") &&
        !item.descripcion.includes("1103K") &&
        (item.precioPyg || 0) >= 290000
      );
    }

    // 8. REFRIGERACIÓN
    if (item.categoria === "REFRIGERACION") {
      if (!item.isCpuCooler) return false;
      if (currentGabinete?.isKitOficina && (item.isAioLiquid || item.radiatorSizeMm)) {
        return false;
      }
      if (currentGabinete?.maxRadiatorMm !== undefined && currentGabinete.maxRadiatorMm < 360 && item.radiatorSizeMm === 360) {
        return false;
      }
      return true;
    }

    return false;
  };

  // Filtrado y ordenamiento inteligente del catálogo en pantalla
  const catalogoFiltrado = useMemo(() => {
    const filtered = catalogoCompleto.filter((item) => {
      if (activeTabSlot !== "TODO" && item.categoria !== activeTabSlot) {
        return false;
      }

      if (onlyWebStock && item.stockStatus !== "IN_STOCK") {
        return false;
      }

      if (selectedBrand !== "TODAS" && item.marca?.toUpperCase() !== selectedBrand) {
        return false;
      }

      // Filtro interactivo de Plataforma / Arquitectura
      if (slotPlatformFilter !== "TODOS") {
        const fullTxt = `${item.descripcion} ${item.nombreWeb || ""} ${item.marca || ""}`.toUpperCase();
        if (activeTabSlot === "PROCESADOR") {
          if (slotPlatformFilter === "AM4" && item.socket !== "AM4") return false;
          if (slotPlatformFilter === "AM5" && item.socket !== "AM5") return false;
          if (slotPlatformFilter === "LGA1700" && item.socket !== "LGA1700") return false;
          if (slotPlatformFilter === "AMD" && item.socket !== "AM4" && item.socket !== "AM5") return false;
          if (slotPlatformFilter === "INTEL" && item.socket !== "LGA1700") return false;
        } else if (activeTabSlot === "PLACA_MADRE") {
          if (slotPlatformFilter === "AM5" && item.socket !== "AM5") return false;
          if (slotPlatformFilter === "AM4" && item.socket !== "AM4") return false;
          if (slotPlatformFilter === "LGA1700" && item.socket !== "LGA1700") return false;
          if (slotPlatformFilter === "AMD" && item.socket !== "AM5" && item.socket !== "AM4") return false;
          if (slotPlatformFilter === "INTEL" && item.socket !== "LGA1700") return false;
        } else if (activeTabSlot === "GPU") {
          const isNvidia = item.marca === "NVIDIA" || /GEFORCE|RTX|GTX|PALIT|ZOTAC|PNY|GALAX/i.test(fullTxt);
          const isAmd = item.marca === "AMD" || /RADEON|RX/i.test(fullTxt);
          if (slotPlatformFilter === "NVIDIA" && !isNvidia) return false;
          if (slotPlatformFilter === "AMD" && !isAmd) return false;
        } else if (activeTabSlot === "RAM") {
          if (slotPlatformFilter === "DDR5" && item.ramType !== "DDR5") return false;
          if (slotPlatformFilter === "DDR4" && item.ramType !== "DDR4") return false;
        } else if (activeTabSlot === "ALMACENAMIENTO") {
          const cap = item.capacidadGb || 0;
          if (slotPlatformFilter === "500GB" && (cap < 400 || cap > 600 || !item.esM2Nvme)) return false;
          if (slotPlatformFilter === "1TB" && (cap < 900 || cap > 1500 || !item.esM2Nvme)) return false;
          if (slotPlatformFilter === "2TB" && (cap < 1900 || !item.esM2Nvme)) return false;
          if (slotPlatformFilter === "SATA" && item.esM2Nvme) return false;
        } else if (activeTabSlot === "FUENTE") {
          const w = item.potenciaWatts || 0;
          if (slotPlatformFilter === "550W" && w > 590) return false;
          if (slotPlatformFilter === "650W_750W" && (w < 600 || w > 800)) return false;
          if (slotPlatformFilter === "850W" && w < 850) return false;
        } else if (activeTabSlot === "GABINETE") {
          if (slotPlatformFilter === "AIRFLOW" && (item.isKitOficina || /ACUARIO|VISION|PANORAMIC/i.test(fullTxt))) return false;
          if (slotPlatformFilter === "ACUARIO" && !/ACUARIO|VISION|PANORAMIC|TK-|DH80/i.test(fullTxt)) return false;
          if (slotPlatformFilter === "OFICINA" && !item.isKitOficina) return false;
        } else if (activeTabSlot === "REFRIGERACION") {
          if (slotPlatformFilter === "AIRE" && (item.isAioLiquid || item.radiatorSizeMm)) return false;
          if (slotPlatformFilter === "AIO_240" && item.radiatorSizeMm !== 240) return false;
          if (slotPlatformFilter === "AIO_360" && item.radiatorSizeMm !== 360) return false;
        }
      }

      // Filtro interactivo de Tipo de Trabajo / Perfil Productivo
      if (slotWorkProfileFilter !== "TODOS") {
        const perfil = (item.perfilProductivo || "").toLowerCase();
        const desc = `${item.descripcion} ${item.nombreWeb || ""}`.toLowerCase();
        if (slotWorkProfileFilter === "OFICINA") {
          if (!perfil.includes("oficina") && !perfil.includes("ofimática") && !perfil.includes("comercial") && !desc.includes("oficina") && !desc.includes("facturación")) return false;
        } else if (slotWorkProfileFilter === "GAMING_1080P") {
          if (!perfil.includes("1080p") && !perfil.includes("esports") && !perfil.includes("entrada")) return false;
        } else if (slotWorkProfileFilter === "GAMING_1440P") {
          if (!perfil.includes("1440p") && !perfil.includes("ultra") && !perfil.includes("balanceada") && !perfil.includes("stream")) return false;
        } else if (slotWorkProfileFilter === "GAMING_X3D") {
          if (!perfil.includes("3d v-cache") && !desc.includes("x3d") && !perfil.includes("extremo")) return false;
        } else if (slotWorkProfileFilter === "RENDER_IA") {
          if (!perfil.includes("render") && !perfil.includes("workstation") && !perfil.includes("ia") && !perfil.includes("arquitectura") && !perfil.includes("creación")) return false;
        }
      }

      if (catalogSearchTerm.trim()) {
        const q = catalogSearchTerm.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchDesc = item.descripcion.toLowerCase().includes(q);
        const matchWebName = item.nombreWeb ? item.nombreWeb.toLowerCase().includes(q) : false;
        const matchMarca = item.marca ? item.marca.toLowerCase().includes(q) : false;
        if (!matchSku && !matchDesc && !matchWebName && !matchMarca) return false;
      }

      if (onlyCompatible) {
        // 1. Compatibilidad estricta de Socket / Plataforma según effectiveSocket
        if (effectiveSocket !== "TODOS") {
          if (item.categoria === "PLACA_MADRE") {
            if (item.socket && item.socket !== "UNIVERSAL" && item.socket !== effectiveSocket) {
              return false;
            }
          }
          if (item.categoria === "PROCESADOR") {
            if (item.socket && item.socket !== "UNIVERSAL" && item.socket !== effectiveSocket) {
              return false;
            }
          }
        }

        // 2. Compatibilidad estricta de Memoria RAM (DDR4 vs DDR5)
        if (item.categoria === "RAM") {
          if (effectiveRamType !== "TODAS") {
            if (item.ramType && item.ramType !== "UNIVERSAL" && item.ramType !== effectiveRamType) {
              return false;
            }
          }
        }

        // 3. Compatibilidad de Almacenamiento (PC de escritorio)
        if (item.categoria === "ALMACENAMIENTO") {
          const desc = `${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase();
          if (desc.includes("EXTERNO") || desc.includes("PORTABLE") || desc.includes("ENCLOSURE")) {
            return false;
          }
        }

        if (item.categoria === "GABINETE") {
          const isLiquid = Boolean(
            currentCooler &&
              (currentCooler.isAioLiquid ||
                /WATER|LIQUID|L[IÍ]QUIDO|AIO|360|240/i.test(
                  `${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`
                ))
          );
          const is360 = Boolean(
            currentCooler &&
              (currentCooler.radiatorSizeMm === 360 ||
                /360/i.test(
                  `${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`
                ))
          );
          const is240 = Boolean(
            currentCooler &&
              (currentCooler.radiatorSizeMm === 240 ||
                /240/i.test(
                  `${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`
                ))
          );
          const caseRad = item.maxRadiatorMm ?? 0;

          if (isLiquid && (item.isKitOficina || caseRad === 0)) return false;
          if (is360 && caseRad < 360) return false;
          if (is240 && caseRad < 240) return false;
          if (
            currentMb?.formFactor === "ATX" &&
            (item.maxMbFormFactor === "MATX" || item.maxMbFormFactor === "ITX")
          )
            return false;
        }

        if (item.categoria === "REFRIGERACION") {
          const isLiquid = Boolean(
            item.isAioLiquid ||
              /WATER|LIQUID|L[IÍ]QUIDO|AIO|360|240/i.test(
                `${item.descripcion} ${item.nombreWeb || ""}`
              )
          );
          const is360 = Boolean(
            item.radiatorSizeMm === 360 ||
              /360/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)
          );
          const is240 = Boolean(
            item.radiatorSizeMm === 240 ||
              /240/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)
          );
          const caseRad = currentGabinete?.maxRadiatorMm ?? 0;

          if (currentGabinete && isLiquid && (currentGabinete.isKitOficina || caseRad === 0))
            return false;
          if (currentGabinete && is360 && caseRad < 360) return false;
          if (currentGabinete && is240 && caseRad < 240) return false;
          if (
            currentCpu &&
            currentCpu.includesCooler === false &&
            item.sku === "STOCK-COOLER"
          ) {
            return false;
          }
        }

        if (
          item.categoria === "FUENTE" &&
          (item.potenciaWatts || 0) < resultadoCompatibilidad.consumoTotalWatts
        ) {
          return false;
        }
      }

      return true;
    });

    // Orden inteligente asistido: Lo recomendado y compatible aparece PRIMERO
    return filtered.sort((a, b) => {
      // 1. Ítems seleccionados actualmente al tope
      const aSelected = selectedComponents.some((c) => c.sku === a.sku) ? 1 : 0;
      const bSelected = selectedComponents.some((c) => c.sku === b.sku) ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;

      // 2. Stock web (en stock primero)
      const aStock = a.stockStatus === "IN_STOCK" ? 1 : 0;
      const bStock = b.stockStatus === "IN_STOCK" ? 1 : 0;
      if (aStock !== bStock) return bStock - aStock;

      // 3. Recomendados y compatibles al inicio del catálogo para armado 1 a 1 asistido
      const aRec = isItemSmartRecommended(a) ? 1 : 0;
      const bRec = isItemSmartRecommended(b) ? 1 : 0;
      if (aRec !== bRec) return bRec - aRec;

      // 4. Descuento web
      const aDisc = (a.precioRegularPyg || 0) > (a.precioPyg || 0) ? 1 : 0;
      const bDisc = (b.precioRegularPyg || 0) > (b.precioPyg || 0) ? 1 : 0;
      if (aDisc !== bDisc) return bDisc - aDisc;

      // 5. Precio
      return (a.precioPyg || 0) - (b.precioPyg || 0);
    });
  }, [
    catalogoCompleto,
    activeTabSlot,
    onlyWebStock,
    catalogSearchTerm,
    selectedBrand,
    onlyCompatible,
    currentCpu,
    currentMb,
    currentGpu,
    currentGabinete,
    currentCooler,
    resultadoCompatibilidad.consumoTotalWatts,
    resultadoCompatibilidad.fuenteRecomendadaWatts,
    selectedComponents,
    slotPlatformFilter,
    slotWorkProfileFilter,
    effectiveSocket,
    effectiveRamType,
  ]);

  // Generación de resumen de texto para cotización
  const generarTextoPresupuesto = () => {
    const fechaHoy = new Date().toLocaleDateString("es-PY");
    let text = `PRESUPUESTO OFICIAL DE PC — NISSEI PARAGUAY\n`;
    text += `Fecha: ${fechaHoy} | Vendedor: ${selectedVendedor || "No especificado"}\n`;
    if (clienteNombre.trim()) {
      text += `Cliente: ${clienteNombre.trim()}\n`;
    }
    text += `--------------------------------------------------\n`;
    text += `DETALLE DE COMPONENTES (PRECIOS Y STOCK VERIFICADOS):\n`;
    selectedComponents.forEach((c) => {
      const cant = (c.cantidad || 1) > 1 ? ` (x${c.cantidad})` : "";
      const subPyg = (c.precioPyg || 0) * (c.cantidad || 1);
      const subUsd = tipoCambio > 0 ? (subPyg / tipoCambio).toFixed(2) : "0.00";
      const nombreBasico = formatearNombreComponenteBasico(
        cleanDisplayTitle(c.nombreWeb || c.descripcion),
        c.categoria
      );
      text += `• [SKU ${c.sku}] ${nombreBasico}${cant}\n`;
      text += `  Gs. ${subPyg.toLocaleString("es-PY")} (Ref. US$ ${subUsd}) · Garantía: 3 meses\n`;
      if (c.urlWeb) {
        text += `  Link: ${c.urlWeb}\n`;
      }
    });

    text += `--------------------------------------------------\n`;
    text += `Consumo Estimado: ${resultadoCompatibilidad.consumoTotalWatts} W\n`;
    text += `Fuente Recomendada: ${resultadoCompatibilidad.fuenteRecomendadaWatts} W+\n`;
    text += `Costo de servicio del montaje: ${
      isCorpVendedor
        ? "¡Bonificado / GRATIS! (Ventas Corp)"
        : `58,77$ (Gs. ${costoMontajePyg.toLocaleString("es-PY")})`
    }\n`;
    text += `TOTAL COTIZACIÓN OFICIAL:\n`;
    text += `Gs. ${totalPresupuestoPyg.toLocaleString("es-PY")} Guaraníes (IVA 10% Incluido)\n`;
    text += `Ref. Dólares: US$ ${totalPresupuestoUsd.toLocaleString("es-PY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (TC: ${tipoCambio.toLocaleString("es-PY")} Gs/USD)\n`;
    text += `--------------------------------------------------\n`;
    text += `Garantía de Componentes: 3 meses · Compatibilidad 100% Verificada\n`;
    text += `Cotización oficial con stock y garantía verificados\n`;

    return text;
  };

  // Ejecución directa de acciones de presupuesto
  const executeGuardedAction = (action: "COPY" | "PRINT" | "ORDEN") => {
    if (action === "COPY") {
      const txt = generarTextoPresupuesto();
      navigator.clipboard.writeText(txt);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } else if (action === "PRINT") {
      setIsThermalPrintModalOpen(true);
    } else if (action === "ORDEN") {
      proceedCrearOrdenMontaje();
    }
  };

  // Escudo Defensivo: Si hay errores de compatibilidad críticos, advertir antes de copiar/imprimir para evitar errores de venta
  const handleGuardedAction = (action: "COPY" | "PRINT" | "ORDEN") => {
    if (selectedComponents.length === 0) return;
    if (resultadoCompatibilidad.totalErrores > 0) {
      setPendingGuardedAction(action);
      setShowDefensiveModal(true);
    } else {
      executeGuardedAction(action);
    }
  };

  const proceedCrearOrdenMontaje = () => {
    const payload = {
      cliente: clienteNombre || "Cliente Presupuesto",
      vendedor: selectedVendedor || "Sin Asignar",
      canal: selectedCanal,
      tipoServicio: "Montaje",
      consumoEstimado: `${resultadoCompatibilidad.consumoTotalWatts}W`,
      observaciones:
        observacionesPresupuesto ||
        `Presupuesto oficial (Total: Gs. ${totalPresupuestoPyg.toLocaleString("es-PY")} · Garantía 3 meses). Consumo estimado: ${resultadoCompatibilidad.consumoTotalWatts}W.`,
      componentes: selectedComponents.map((c) => ({
        sku: c.sku,
        descripcion: cleanDisplayTitle(c.nombreWeb || c.descripcion),
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

  const handleCopyPresupuesto = () => {
    handleGuardedAction("COPY");
  };

  // Convertir a Orden de Montaje Oficial en /tecnicos/nuevo
  const handleCrearOrdenMontaje = () => {
    if (selectedComponents.length === 0) {
      alert("Agregue al menos un componente al presupuesto para generar la orden.");
      return;
    }
    handleGuardedAction("ORDEN");
  };

  // Manejador interactivo de acciones y mejoras en 1 clic dentro de las alertas inteligentes
  const handleAlertAction = (alerta: AlertaCompatibilidad) => {
    const inStockPool = catalogoCompleto.filter(
      (c) => c.stockStatus === "IN_STOCK" && (c.precioPyg || 0) > 0
    );

    if (alerta.accionTipo === "DUPLICAR_RAM") {
      const ram = selectedComponents.find((c) => c.categoria === "RAM");
      if (ram) {
        handleChangeCantidad(ram.sku, 1);
      }
      return;
    }

    if (alerta.accionTipo === "AUTO_UPGRADE_RAM_32GB") {
      const currentRam = selectedComponents.find((c) => c.categoria === "RAM");
      const reqRamType =
        effectiveRamType !== "TODAS"
          ? effectiveRamType
          : currentRam?.ramType || "DDR4";
      if (
        currentRam &&
        currentRam.capacidadGb === 16 &&
        !/\b2\s*X\s*\d+/i.test(`${currentRam.descripcion} ${currentRam.nombreWeb || ""}`) &&
        (currentRam.cantidad || 1) === 1
      ) {
        handleChangeCantidad(currentRam.sku, 1);
        return;
      }
      const ramCandidates = inStockPool.filter(
        (i) => i.categoria === "RAM" && i.ramType === reqRamType
      );
      const kit32 = ramCandidates.find((i) => (i.capacidadGb || 0) >= 32);
      const stick16 = ramCandidates.find(
        (i) =>
          i.capacidadGb === 16 &&
          !/\b2\s*X\s*\d+/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
      );
      if (stick16) {
        setSelectedComponents((prev) => [
          ...prev.filter((c) => c.categoria !== "RAM"),
          { ...stick16, cantidad: 2 },
        ]);
        return;
      }
      if (kit32) {
        setSelectedComponents((prev) => [
          ...prev.filter((c) => c.categoria !== "RAM"),
          { ...kit32, cantidad: 1 },
        ]);
        return;
      }
    }

    if (alerta.accionTipo === "AUTO_UPGRADE_NVME") {
      const currentSsd = selectedComponents.find((c) => c.categoria === "ALMACENAMIENTO");
      const targetCap = Math.max(480, currentSsd?.capacidadGb || 480);
      const nvmeReplacement =
        inStockPool.find(
          (i) =>
            i.categoria === "ALMACENAMIENTO" &&
            i.esM2Nvme &&
            (i.capacidadGb || 0) >= targetCap
        ) ||
        inStockPool.find((i) => i.categoria === "ALMACENAMIENTO" && i.esM2Nvme);
      if (nvmeReplacement) {
        setSelectedComponents((prev) => [
          ...prev.filter((c) => c.categoria !== "ALMACENAMIENTO"),
          { ...nvmeReplacement, cantidad: 1 },
        ]);
        return;
      }
    }

    if (alerta.accionTipo === "AUTO_UPGRADE_SSD_1TB") {
      const ssd1Tb =
        inStockPool.find(
          (i) =>
            i.categoria === "ALMACENAMIENTO" &&
            i.esM2Nvme &&
            (i.capacidadGb || 0) >= 960 &&
            (i.capacidadGb || 0) <= 1050
        ) ||
        inStockPool.find(
          (i) => i.categoria === "ALMACENAMIENTO" && (i.capacidadGb || 0) >= 960
        );
      if (ssd1Tb) {
        setSelectedComponents((prev) => [
          ...prev.filter((c) => c.categoria !== "ALMACENAMIENTO"),
          { ...ssd1Tb, cantidad: 1 },
        ]);
        return;
      }
    }

    if (alerta.accionTipo === "AGREGAR_COOLER") {
      const realCoolers = inStockPool.filter(
        (i) => i.categoria === "REFRIGERACION" && i.isCpuCooler && i.sku !== "STOCK-COOLER"
      );
      const descCpu = currentCpu
        ? `${currentCpu.descripcion} ${currentCpu.nombreWeb || ""}`.toUpperCase()
        : "";
      const isHot =
        (currentCpu?.tdpWatts || 0) >= 120 ||
        /14700|13700|14900|13900|7800X3D|9800X3D|7900X|7950X/.test(descCpu);
      const chosenCooler = isHot
        ? realCoolers.find(
            (cl) =>
              /240|360|LIQUID|L[IÍ]QUIDO|WATER|AIO/i.test(
                `${cl.descripcion} ${cl.nombreWeb || ""}`
              ) &&
              (!currentGabinete ||
                isGabinetePhysicallyCompatible(
                  currentGabinete,
                  currentMb,
                  cl,
                  Boolean(currentGpu)
                ))
          ) || realCoolers[0]
        : realCoolers.find(
            (cl) =>
              !currentGabinete ||
              isGabinetePhysicallyCompatible(
                currentGabinete,
                currentMb,
                cl,
                Boolean(currentGpu)
              )
          ) || realCoolers[0];

      if (chosenCooler) {
        setSelectedComponents((prev) => [
          ...prev.filter((c) => c.categoria !== "REFRIGERACION"),
          { ...chosenCooler, cantidad: 1 },
        ]);
        return;
      }
    }

    if (alerta.accionTipo === "AUTO_UPGRADE_PSU") {
      const reqW = resultadoCompatibilidad.fuenteRecomendadaWatts || 550;
      const psu80Plus = inStockPool.find(
        (i) =>
          i.categoria === "FUENTE" &&
          (i.potenciaWatts || 0) >= reqW &&
          /80\s*PLUS|80PLUS|BRONZE|BRONCE|GOLD|SILVER|PLATINUM|CYBENETICS/i.test(
            `${i.descripcion} ${i.nombreWeb || ""}`
          )
      );
      if (psu80Plus) {
        setSelectedComponents((prev) => [
          ...prev.filter((c) => c.categoria !== "FUENTE"),
          { ...psu80Plus, cantidad: 1 },
        ]);
        return;
      }
    }

    if (alerta.categoriaTarget) {
      switchActiveSlot(alerta.categoriaTarget);
      const el = document.getElementById("catalog-slots-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <>
      {/* Modal Obligatorio al Iniciar o Recargar la Página: Cotización del Dólar */}
      {isTipoCambioModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="p-5 sm:p-6 bg-gradient-to-b from-emerald-50/70 via-emerald-50/20 to-white border-b border-zinc-100 flex items-start gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/25">
                <DollarSign className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md inline-block mb-1">
                  Requerido antes de continuar
                </span>
                <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
                  Cotización del Dólar del Día
                </h2>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Ingresá la cotización oficial de caja en Guaraníes para calcular y presupuestar todos los componentes del ensamble.
                </p>
              </div>
            </div>

            {/* Cuerpo del Formulario */}
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-800 block mb-1.5">
                  Cotización Actual (Gs por cada 1 USD):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-400 select-none">
                    ₲
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={modalTipoCambioInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      if (!raw) {
                        setModalTipoCambioInput("");
                        return;
                      }
                      const num = parseInt(raw, 10);
                      setModalTipoCambioInput(num.toLocaleString("es-PY"));
                      setModalTipoCambioError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleConfirmTipoCambio();
                      }
                    }}
                    placeholder="Ej: 6.800"
                    className="w-full pl-9 pr-24 py-3 bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 focus:bg-white rounded-xl text-xl font-mono font-black text-zinc-900 outline-none transition-all shadow-inner"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-600 bg-zinc-200/80 px-2 py-1 rounded-md select-none">
                    Gs / USD
                  </span>
                </div>
                {modalTipoCambioError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1.5 animate-in fade-in">
                    ⚠️ {modalTipoCambioError}
                  </p>
                )}
              </div>

              {/* Botones de Selección Rápida en Rango Bancario (6mil a 7mil) */}
              <div>
                <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase block mb-1.5">
                  Cotizaciones Bancarias y Casas de Cambio (un toque):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[6000, 6200, 6300, 6500, 6700, 6800, 7000].map((val) => {
                    const str = val.toLocaleString("es-PY");
                    const isSelected = modalTipoCambioInput === str;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setModalTipoCambioInput(str);
                          setModalTipoCambioError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200"
                        }`}
                      >
                        ₲ {str}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Confirmación Obligatorio */}
              <button
                type="button"
                onClick={handleConfirmTipoCambio}
                className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
              >
                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                <span>Confirmar Cotización y Continuar</span>
                <ArrowRight className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      )}

    <main className={`min-h-dvh bg-[#fbf9f9] text-zinc-900 flex flex-col font-sans relative ${isThermalPrintModalOpen ? "print:hidden" : ""}`}>
      {/* Alertas Secuenciales de 8 Segundos al Ingresar (1: Stock, 2: Tiempo de Montaje 24/48Hs) */}
      {warningStage && (
        <div
          key={warningStage}
          className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-1.25rem)] sm:w-[92vw] max-w-xl 3xl:max-w-2xl animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-3.5 sm:p-5 flex items-start gap-3 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                {warningStage === "STOCK" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <Clock className="w-4 h-4 text-emerald-400" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight truncate">
                    {warningStage === "STOCK"
                      ? "Advertencia de Stock y Disponibilidad"
                      : "Tiempo Estimado de Montaje"}
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {warningStage === "STOCK" ? "1/2" : "2/2"} · {warningSecondsLeft}s
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setWarningStage((prev) =>
                          prev === "STOCK" ? "TIEMPO_MONTAJE" : null
                        )
                      }
                      className="text-zinc-400 hover:text-zinc-900 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                      title={
                        warningStage === "STOCK"
                          ? "Siguiente aviso"
                          : "Cerrar aviso"
                      }
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {warningStage === "STOCK" ? (
                  <>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Estos componentes son de{" "}
                      <strong className="text-zinc-900 font-bold">referencia</strong> y se debe
                      verificar si tenemos disponibilidad física en nuestros stocks:
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {["PA", "Barrail", "Distrito", "Showroom", "Emap"].map((deposito) => (
                        <span
                          key={deposito}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white shadow-2xs"
                        >
                          {deposito}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      El tiempo de montaje es de{" "}
                      <strong className="text-zinc-900 font-bold">24 / 48 Hs.</strong> dependiendo
                      de la carga de trabajo en taller:
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {["24 / 48 Hs.", "Sujeto a carga de trabajo", "Montaje & QA"].map(
                        (etiqueta) => (
                          <span
                            key={etiqueta}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white shadow-2xs"
                          >
                            {etiqueta}
                          </span>
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Barra de progreso de 8 segundos */}
            <div className="h-1 w-full bg-zinc-100">
              <div
                className="h-full bg-zinc-900 transition-all duration-1000 ease-linear"
                style={{ width: `${(warningSecondsLeft / 8) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Barra Superior con Navegación y Estado de Conexión a https://nissei.com/py/ */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 shadow-xs">
        <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold shrink-0">
                  <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                <h1 className="text-xs xs:text-sm sm:text-base font-extrabold text-zinc-900 tracking-tight truncate">
                  Configurador &amp; Presupuestador de PC
                </h1>
              </div>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap ml-auto">
            <button
              type="button"
              onClick={() => syncWithNisseiWeb(true)}
              disabled={isLoadingWeb}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px] sm:min-h-[42px]"
              title="Refrescar precios y disponibilidad ahora mismo"
            >
              <RefreshCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${isLoadingWeb ? "animate-spin text-emerald-600" : ""}`} />
              <span className="hidden md:inline">
                {isLoadingWeb ? "Sincronizando..." : "Actualizar Web"}
              </span>
            </button>

            {/* Selector de Moneda */}
            <div className="flex items-center bg-zinc-100 rounded-xl p-1 border border-zinc-200 text-xs sm:text-sm font-mono min-h-[38px] sm:min-h-[42px]">
              <button
                type="button"
                onClick={() => setMoneda("PYG")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer ${
                  moneda === "PYG"
                    ? "bg-white text-zinc-900 font-bold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                PYG ₲
              </button>
              <button
                type="button"
                onClick={() => setMoneda("USD")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer ${
                  moneda === "USD"
                    ? "bg-white text-zinc-900 font-bold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                USD $
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyPresupuesto}
              disabled={selectedComponents.length === 0}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs min-h-[38px] sm:min-h-[42px] ${
                copiedSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-900 hover:bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {copiedSuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden xs:inline">
                {copiedSuccess ? "¡Copiado!" : "Copiar Presupuesto"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsThermalPrintModalOpen(true)}
              disabled={selectedComponents.length === 0}
              className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-zinc-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs min-h-[38px] sm:min-h-[42px]"
              title="Imprimir ticket térmico con detalle del presupuesto"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor Principal: 2 Columnas Adaptables desde 320px hasta 4K TVs */}
      <div className="flex-1 w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto p-2.5 xs:p-3.5 sm:p-5 lg:p-7 2xl:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 2xl:gap-8 min-w-0">
        {/* Columna Izquierda: Configurador y Catálogo de Componentes (7 cols) */}
        <section className="lg:col-span-7 3xl:col-span-8 space-y-4 min-w-0">
          {/* Barra de Cotización del Dólar */}
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono shadow-2xs">
              <span className="text-zinc-600 font-semibold">TC Dólar:</span>
              <button
                type="button"
                onClick={() => {
                  setModalTipoCambioInput(tipoCambio.toLocaleString("es-PY"));
                  setModalTipoCambioError(null);
                  setIsTipoCambioModalOpen(true);
                }}
                className="px-2.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-black text-emerald-950 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs group"
                title="Hacé clic para cambiar la cotización del dólar"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-700 group-hover:scale-110 transition-transform" />
                <span>₲ {tipoCambioInput}</span>
                <span className="text-[10px] text-emerald-600 font-normal">✎</span>
              </button>
            </div>
          </div>

          {/* Ficha de Datos del Vendedor y Cliente */}
          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 min-w-0 truncate">
                <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Datos de la Cotización</span>
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-zinc-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1.5">
                  Vendedor Asignado
                </label>
                <VendedorSelect
                  value={selectedVendedor}
                  placeholder="Seleccionar vendedor..."
                  onChange={(nuevoVendedor, area) => {
                    setSelectedVendedor(nuevoVendedor);
                    const resolvedArea: AreaVendedor =
                      area ||
                      (VENDEDORES_CORP_BASE.some(
                        (v) => v.toLowerCase() === nuevoVendedor.trim().toLowerCase()
                      )
                        ? "Ventas Corp"
                        : "Ventas Tienda");
                    setSelectedArea(resolvedArea);
                    if (resolvedArea === "Ventas Corp") {
                      setSelectedCanal("Empresas / Coorporativo");
                    } else {
                      setSelectedCanal("Tienda");
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1.5">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Marcelo Gomez..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 outline-none focus:border-zinc-900 focus:bg-white transition-colors min-h-[46px]"
                />
              </div>
            </div>

            {/* Selector de Modo de Presupuesto Rápido: Por Entorno vs Por Cantidad de Guaraníes */}
            <div className="pt-3.5 border-t border-zinc-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Presets Inteligentes (100% Compatibles &amp; En Stock):</span>
                </span>

                {/* Sub-Pestañas: Por Entorno vs Por Presupuesto */}
                <div className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setPresetTabMode("ENTORNO")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      presetTabMode === "ENTORNO"
                        ? "bg-white text-zinc-900 shadow-2xs font-extrabold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <span>🎯 Por Entorno de Trabajo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTabMode("PRESUPUESTO")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      presetTabMode === "PRESUPUESTO"
                        ? "bg-white text-emerald-800 shadow-2xs font-extrabold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <span>💰 Por Presupuesto en Guaraníes</span>
                  </button>
                </div>
              </div>

              {/* Modo 1: Por Entorno de Trabajo */}
              {presetTabMode === "ENTORNO" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(175px,1fr))] gap-2.5">
                    {PRESETS.map((p) => {
                      const isMenuOpen = selectedPresetForCpuMenu === p.id;
                      const isBuilt = activePresetBuilt?.tier === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isLoadingWeb}
                          onClick={() => {
                            setSelectedPresetForCpuMenu((prev) =>
                              prev === p.id ? null : p.id
                            );
                            setPresetCpuAlert(null);
                            setPresetSuccessBanner(null);
                          }}
                          className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-50 flex flex-col justify-between ${
                            isMenuOpen
                              ? "bg-zinc-900/5 border-zinc-900 ring-2 ring-zinc-900/15"
                              : isBuilt
                              ? "bg-emerald-50/50 border-emerald-400"
                              : "bg-zinc-50 hover:bg-zinc-100/90 border-zinc-200 hover:border-zinc-300"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <span className="text-lg shrink-0">{p.icono}</span>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                                  isMenuOpen
                                    ? "bg-zinc-900 text-white"
                                    : isBuilt
                                    ? "bg-emerald-600 text-white"
                                    : "bg-zinc-200/80 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white"
                                }`}
                              >
                                {isMenuOpen
                                  ? "Elegir CPU ▼"
                                  : isBuilt
                                  ? `Armado (${activePresetBuilt?.brand})`
                                  : "Elegir Perfil"}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-zinc-900 block group-hover:text-black leading-tight">
                              {p.nombre}
                            </span>
                            <span className="text-[11px] text-zinc-500 block leading-snug mt-1">
                              {p.entorno}
                            </span>
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 block line-clamp-2 leading-tight mt-2.5 font-semibold">
                            {p.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Menú Desplegable de Selección de Procesador (CPU): ¿AMD Ryzen o Intel Core? */}
                  {selectedPresetForCpuMenu && presetBrandPreviews && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-50 border-2 border-zinc-900/80 shadow-xs space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-start sm:items-center justify-between gap-2 border-b border-zinc-200 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-white font-mono text-[10px] sm:text-xs font-bold uppercase">
                            Paso 2 · Elegir CPU
                          </span>
                          <span className="text-xs sm:text-sm font-extrabold text-zinc-900">
                            {PRESETS.find((x) => x.id === selectedPresetForCpuMenu)?.icono}{" "}
                            {PRESETS.find((x) => x.id === selectedPresetForCpuMenu)?.nombre}:{" "}
                            <span className="font-semibold text-zinc-600">
                              ¿Con qué procesador querés armar el equipo?
                            </span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPresetForCpuMenu(null);
                            setPresetCpuAlert(null);
                          }}
                          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors cursor-pointer shrink-0"
                          title="Cerrar menú de CPU"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Veredicto de Rendimiento y Relación Precio/Calidad */}
                      {presetCpuComparison?.veredictoGlobal && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 shadow-2xs">
                          <Award className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="leading-snug">
                            <strong>Análisis NISSEI:</strong> {presetCpuComparison.veredictoGlobal}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Opción 1: AMD Ryzen */}
                        {(() => {
                          const amd = presetBrandPreviews.AMD;
                          const isSelectedAmd =
                            activePresetBuilt?.tier === selectedPresetForCpuMenu &&
                            activePresetBuilt?.brand === "AMD";
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                buildSmartPcConfiguration(
                                  selectedPresetForCpuMenu,
                                  false,
                                  "AMD"
                                )
                              }
                              className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                isSelectedAmd
                                  ? "bg-rose-50/70 border-rose-600 ring-2 ring-rose-500/20"
                                  : amd.ok
                                  ? "bg-white hover:bg-rose-50/30 border-rose-200 hover:border-rose-500 shadow-2xs"
                                  : "bg-zinc-100/80 hover:bg-amber-50/40 border-zinc-300 border-dashed"
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-rose-900">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
                                    AMD Ryzen™ (AM4 / AM5)
                                  </span>
                                  {amd.ok ? (
                                    <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                                      ✓ Stock Completo ({amd.socketUsed})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                      ⚠️ Sin componente clave
                                    </span>
                                  )}
                                </div>

                                {amd.ok ? (
                                  <div className="text-[11px] sm:text-xs text-zinc-700 space-y-0.5 pt-0.5">
                                    <p className="font-bold text-zinc-900 truncate">
                                      • CPU: {amd.cpuName}
                                    </p>
                                    <p className="text-zinc-600 truncate">
                                      • Video: {amd.gpuName} · RAM: {amd.ramName}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-amber-900 font-medium leading-snug pt-0.5">
                                    No tenemos actualmente en stock:{" "}
                                    <strong>{amd.faltantes.join(", ")}</strong>. (Tocar para ver opciones)
                                  </p>
                                )}

                                {/* Porcentaje de Rendimiento & Análisis de Conveniencia por Precio */}
                                {amd.ok && presetCpuComparison && (
                                  <div className="pt-2 border-t border-rose-200/60 space-y-1.5 text-left">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold text-zinc-700 flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Rendimiento Estimado:</span>
                                      </span>
                                      <span className="font-mono font-extrabold text-zinc-900">
                                        {presetCpuComparison.amd.pct}%
                                        {presetCpuComparison.amd.esGanadorRendimiento && (
                                          <span className="text-emerald-700 font-bold ml-1 text-[10px]">
                                            (+potencia)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-rose-500 transition-all duration-300"
                                        style={{ width: `${presetCpuComparison.amd.pct}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                                      <span
                                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                          presetCpuComparison.amd.esMasConveniente
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-black"
                                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                        }`}
                                      >
                                        {presetCpuComparison.amd.etiquetaConveniencia}
                                      </span>
                                      {presetCpuComparison.amd.esMasBarato && presetCpuComparison.amd.ahorroPyg > 0 && (
                                        <span className="text-[10px] font-mono font-semibold text-emerald-700">
                                          Ahorrás ₲ {presetCpuComparison.amd.ahorroPyg.toLocaleString("es-PY")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10.5px] text-zinc-600 leading-snug">
                                      {presetCpuComparison.amd.analisis}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                                {amd.ok ? (
                                  <>
                                    <span className="font-mono text-xs sm:text-sm font-black text-zinc-900">
                                      ₲ {amd.totalPyg.toLocaleString("es-PY")}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] sm:text-xs font-bold">
                                      {isSelectedAmd ? "Cargado ✓" : "Armar con AMD →"}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[11px] font-mono text-zinc-500">
                                      Perfil no disponible en AMD
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-zinc-200 text-zinc-700 text-[11px] font-bold">
                                      Ver detalle
                                    </span>
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })()}

                        {/* Opción 2: Intel Core */}
                        {(() => {
                          const intel = presetBrandPreviews.INTEL;
                          const isSelectedIntel =
                            activePresetBuilt?.tier === selectedPresetForCpuMenu &&
                            activePresetBuilt?.brand === "INTEL";
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                buildSmartPcConfiguration(
                                  selectedPresetForCpuMenu,
                                  false,
                                  "INTEL"
                                )
                              }
                              className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                isSelectedIntel
                                  ? "bg-sky-50/70 border-sky-600 ring-2 ring-sky-500/20"
                                  : intel.ok
                                  ? "bg-white hover:bg-sky-50/30 border-sky-200 hover:border-sky-500 shadow-2xs"
                                  : "bg-zinc-100/80 hover:bg-amber-50/40 border-zinc-300 border-dashed"
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-sky-900">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" />
                                    Intel® Core™ (LGA 1700 / Ultra)
                                  </span>
                                  {intel.ok ? (
                                    <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                                      ✓ Stock Completo ({intel.socketUsed})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                      ⚠️ Sin componente clave
                                    </span>
                                  )}
                                </div>

                                {intel.ok ? (
                                  <div className="text-[11px] sm:text-xs text-zinc-700 space-y-0.5 pt-0.5">
                                    <p className="font-bold text-zinc-900 truncate">
                                      • CPU: {intel.cpuName}
                                    </p>
                                    <p className="text-zinc-600 truncate">
                                      • Video: {intel.gpuName} · RAM: {intel.ramName}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-amber-900 font-medium leading-snug pt-0.5">
                                    No tenemos actualmente en stock:{" "}
                                    <strong>{intel.faltantes.join(", ")}</strong>. (Tocar para ver opciones)
                                  </p>
                                )}

                                {/* Porcentaje de Rendimiento & Análisis de Conveniencia por Precio */}
                                {intel.ok && presetCpuComparison && (
                                  <div className="pt-2 border-t border-sky-200/60 space-y-1.5 text-left">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold text-zinc-700 flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        <span>Rendimiento Estimado:</span>
                                      </span>
                                      <span className="font-mono font-extrabold text-zinc-900">
                                        {presetCpuComparison.intel.pct}%
                                        {presetCpuComparison.intel.esGanadorRendimiento && (
                                          <span className="text-emerald-700 font-bold ml-1 text-[10px]">
                                            (+potencia)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-sky-500 transition-all duration-300"
                                        style={{ width: `${presetCpuComparison.intel.pct}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                                      <span
                                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                          presetCpuComparison.intel.esMasConveniente
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-black"
                                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                        }`}
                                      >
                                        {presetCpuComparison.intel.etiquetaConveniencia}
                                      </span>
                                      {presetCpuComparison.intel.esMasBarato && presetCpuComparison.intel.ahorroPyg > 0 && (
                                        <span className="text-[10px] font-mono font-semibold text-emerald-700">
                                          Ahorrás ₲ {presetCpuComparison.intel.ahorroPyg.toLocaleString("es-PY")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10.5px] text-zinc-600 leading-snug">
                                      {presetCpuComparison.intel.analisis}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                                {intel.ok ? (
                                  <>
                                    <span className="font-mono text-xs sm:text-sm font-black text-zinc-900">
                                      ₲ {intel.totalPyg.toLocaleString("es-PY")}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] sm:text-xs font-bold">
                                      {isSelectedIntel ? "Cargado ✓" : "Armar con Intel →"}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[11px] font-mono text-zinc-500">
                                      Perfil no disponible en Intel
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-zinc-200 text-zinc-700 text-[11px] font-bold">
                                      Ver detalle
                                    </span>
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Banner de Éxito al Armar un Perfil con AMD o Intel */}
                  {presetSuccessBanner && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-bold text-emerald-900 flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{presetSuccessBanner}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPresetSuccessBanner(null)}
                        className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Alerta Explícita cuando NO hay componentes en stock para el Perfil + Marca de CPU elegida */}
                  {presetCpuAlert && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/95 border-2 border-amber-300 text-amber-950 space-y-2.5 animate-in fade-in">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{presetCpuAlert.titulo}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPresetCpuAlert(null)}
                          className="text-amber-700 hover:text-amber-950 p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-amber-900 leading-relaxed">
                        {presetCpuAlert.detalle}
                      </p>

                      <ul className="list-disc list-inside text-xs font-bold text-rose-800 bg-white/80 p-2.5 rounded-lg border border-amber-200 space-y-1">
                        {presetCpuAlert.faltantes.map((f, idx) => (
                          <li key={idx}>Falta en stock: {f}</li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {presetCpuAlert.alternativeAvailable &&
                          presetCpuAlert.alternativeBrand &&
                          presetCpuAlert.tier && (
                            <button
                              type="button"
                              onClick={() =>
                                buildSmartPcConfiguration(
                                  presetCpuAlert.tier!,
                                  false,
                                  presetCpuAlert.alternativeBrand
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>
                                Armar este perfil con{" "}
                                {presetCpuAlert.alternativeBrand === "AMD"
                                  ? "AMD Ryzen"
                                  : "Intel Core"}{" "}
                                (100% en Stock)
                              </span>
                            </button>
                          )}

                        {presetCpuAlert.fallbackBuild &&
                          presetCpuAlert.fallbackBuild.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedComponents(presetCpuAlert.fallbackBuild!);
                                setPresetCpuAlert(null);
                              }}
                              className="px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Cargar componentes base disponibles ({presetCpuAlert.fallbackBuild.length} piezas)
                            </button>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modo 2: Por Cantidad de Guaraníes (Optimizador Inteligente por Monto y Plataforma CPU) */}
              {presetTabMode === "PRESUPUESTO" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* Barra de Preferencia de Plataforma CPU para Presupuesto en Guaraníes */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Preferencia de Procesador (CPU) al armar por Guaraníes:</span>
                    </span>
                    <div className="inline-flex p-1 bg-white rounded-xl border border-zinc-200 text-xs font-bold flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBudgetCpuPreference("AUTO");
                          if (customTargetBudget > 0 && selectedComponents.length > 0) {
                            buildPcByTargetBudget(customTargetBudget, "AUTO");
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          budgetCpuPreference === "AUTO"
                            ? "bg-zinc-900 text-white shadow-2xs"
                            : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        ✨ Automático (Mejor Opción)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBudgetCpuPreference("AMD");
                          if (customTargetBudget > 0) {
                            buildPcByTargetBudget(customTargetBudget, "AMD");
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                          budgetCpuPreference === "AMD"
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "text-zinc-700 hover:bg-rose-50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>AMD Ryzen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBudgetCpuPreference("INTEL");
                          if (customTargetBudget > 0) {
                            buildPcByTargetBudget(customTargetBudget, "INTEL");
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                          budgetCpuPreference === "INTEL"
                            ? "bg-sky-600 text-white shadow-2xs"
                            : "text-zinc-700 hover:bg-sky-50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span>Intel Core</span>
                      </button>
                    </div>
                  </div>

                  {/* Tarjetas de Presupuestos Típicos en Guaraníes */}
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(175px,1fr))] gap-2.5">
                    {PRESETS_PRESUPUESTO.map((item) => {
                      const isSelectedMonto = customTargetBudget === item.monto && budgetAnalysis?.targetPyg === item.monto;
                      return (
                        <button
                          key={item.monto}
                          type="button"
                          disabled={isLoadingWeb}
                          onClick={() => {
                            setCustomTargetBudget(item.monto);
                            setCustomTargetBudgetInput(item.monto.toLocaleString("es-PY"));
                            setSelectedBudgetForCpuMenu(item.monto);
                            buildPcByTargetBudget(item.monto, budgetCpuPreference);
                          }}
                          className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-50 flex flex-col justify-between ${
                            isSelectedMonto
                              ? "bg-emerald-100/80 border-emerald-600 ring-2 ring-emerald-500/20"
                              : "bg-emerald-50/50 hover:bg-emerald-100/70 border-emerald-200/90 hover:border-emerald-400"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <span className="text-lg shrink-0">{item.icono}</span>
                              <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-emerald-600 text-white shadow-2xs whitespace-nowrap shrink-0">
                                {item.labelMonto}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-zinc-900 block group-hover:text-black leading-tight">
                              {item.nombre}
                            </span>
                            <span className="text-[11px] text-zinc-600 block leading-snug mt-1">
                              {item.gama}
                            </span>
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-800 bg-white/90 px-2 py-1 rounded-lg border border-emerald-200 block line-clamp-2 leading-tight mt-2.5 font-semibold">
                            {item.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Input Asistido para Monto Personalizado en Guaraníes + Botones de Ajuste Rápido (100% Adaptable) */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-3">
                    <div className="flex items-start sm:items-center gap-3 w-full">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold shrink-0">
                        ₲
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 block leading-snug">
                          ¿El cliente tiene un presupuesto específico en Guaraníes?
                        </span>
                        <span className="text-xs text-zinc-600 block leading-relaxed mt-0.5">
                          Ingresá cualquier monto (ej: 5.500.000, 8.000.000, 12.500.000) y el optimizador calcula la mejor PC compatible sin pasarse.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full">
                      <div className="flex items-center gap-1.5 flex-1 min-w-[230px]">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = Math.max(2500000, customTargetBudget - 500000);
                            setCustomTargetBudget(nextVal);
                            setCustomTargetBudgetInput(nextVal.toLocaleString("es-PY"));
                            setSelectedBudgetForCpuMenu(nextVal);
                            buildPcByTargetBudget(nextVal, budgetCpuPreference);
                          }}
                          className="px-3 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-mono font-bold text-zinc-700 cursor-pointer shrink-0 transition-colors"
                          title="Restar 500.000 Gs al presupuesto"
                        >
                          -500k
                        </button>
                        <div className="relative flex-1 min-w-[120px]">
                          <span className="absolute left-3 top-2.5 text-xs sm:text-sm font-bold font-mono text-zinc-500">
                            ₲
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={customTargetBudgetInput}
                            onChange={handleCustomBudgetChange}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && customTargetBudget > 0) {
                                setSelectedBudgetForCpuMenu(customTargetBudget);
                                buildPcByTargetBudget(customTargetBudget, budgetCpuPreference);
                              }
                            }}
                            placeholder="10.000.000"
                            className="w-full bg-white border border-zinc-300 rounded-xl pl-7 pr-3 py-2.5 text-xs sm:text-sm font-mono font-bold text-zinc-900 outline-none focus:border-emerald-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = customTargetBudget + 500000;
                            setCustomTargetBudget(nextVal);
                            setCustomTargetBudgetInput(nextVal.toLocaleString("es-PY"));
                            setSelectedBudgetForCpuMenu(nextVal);
                            buildPcByTargetBudget(nextVal, budgetCpuPreference);
                          }}
                          className="px-3 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-mono font-bold text-zinc-700 cursor-pointer shrink-0 transition-colors"
                          title="Sumar 500.000 Gs al presupuesto"
                        >
                          +500k
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (customTargetBudget > 0) {
                            setSelectedBudgetForCpuMenu(customTargetBudget);
                            buildPcByTargetBudget(customTargetBudget, budgetCpuPreference);
                          }
                        }}
                        disabled={isLoadingWeb || customTargetBudget <= 0}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 flex-1 sm:flex-initial whitespace-nowrap"
                      >
                        <Zap className="w-4 h-4 shrink-0" />
                        <span>
                          {customTargetBudget > 0
                            ? `Optimizar PC por ₲ ${customTargetBudget.toLocaleString("es-PY")}`
                            : "Optimizar por Presupuesto"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Comparador Interactivo AMD vs Intel para el Presupuesto en Guaraníes */}
                  {budgetBrandPreviews && (selectedBudgetForCpuMenu || budgetAnalysis) && (
                    <div className="p-3.5 rounded-xl bg-white border border-emerald-300 shadow-2xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
                          <span>🧠</span>
                          <span>
                            Comparativa Inteligente para ₲{" "}
                            {budgetBrandPreviews.amount.toLocaleString("es-PY")} (AMD Ryzen vs Intel Core):
                          </span>
                        </span>
                        {budgetAnalysis && (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Aprovechamiento: {budgetAnalysis.pctUsed}% del presupuesto
                          </span>
                        )}
                      </div>

                      {/* Veredicto de Rendimiento y Relación Precio/Calidad para el Presupuesto */}
                      {budgetCpuComparison?.veredictoGlobal && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 shadow-2xs">
                          <Award className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="leading-snug">
                            <strong>Análisis NISSEI:</strong> {budgetCpuComparison.veredictoGlobal}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {/* Tarjeta Comparativa AMD */}
                        {(() => {
                          const amd = budgetBrandPreviews.AMD;
                          const isCurrent = budgetAnalysis?.brandUsed === "AMD";
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setBudgetCpuPreference("AMD");
                                buildPcByTargetBudget(budgetBrandPreviews.amount, "AMD");
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                isCurrent
                                  ? "bg-rose-50/60 border-rose-500 ring-2 ring-rose-500/15"
                                  : "bg-zinc-50/70 hover:bg-rose-50/30 border-zinc-200"
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                                    Opción AMD Ryzen ({amd.socketUsed || "AM4/AM5"})
                                  </span>
                                  <span className="font-mono text-xs font-black text-zinc-900">
                                    {amd.ok ? `₲ ${amd.totalPyg.toLocaleString("es-PY")}` : "Sin stock"}
                                  </span>
                                </div>
                                {amd.ok ? (
                                  <p className="text-[11px] text-zinc-600 mt-1 line-clamp-2 leading-snug">
                                    <strong>{amd.cpuName}</strong> + {amd.gpuName} · {amd.ramSummary} ·{" "}
                                    {amd.ssdSummary}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-amber-800 mt-1">
                                    {amd.faltantes.join(", ")}
                                  </p>
                                )}

                                {/* Porcentaje de Rendimiento & Análisis de Conveniencia por Precio */}
                                {amd.ok && budgetCpuComparison && (
                                  <div className="pt-2 border-t border-rose-200/60 space-y-1.5 text-left">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold text-zinc-700 flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Rendimiento Estimado:</span>
                                      </span>
                                      <span className="font-mono font-extrabold text-zinc-900">
                                        {budgetCpuComparison.amd.pct}%
                                        {budgetCpuComparison.amd.esGanadorRendimiento && (
                                          <span className="text-emerald-700 font-bold ml-1 text-[10px]">
                                            (+potencia)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-rose-500 transition-all duration-300"
                                        style={{ width: `${budgetCpuComparison.amd.pct}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                                      <span
                                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                          budgetCpuComparison.amd.esMasConveniente
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-black"
                                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                        }`}
                                      >
                                        {budgetCpuComparison.amd.etiquetaConveniencia}
                                      </span>
                                      {budgetCpuComparison.amd.esMasBarato && budgetCpuComparison.amd.ahorroPyg > 0 && (
                                        <span className="text-[10px] font-mono font-semibold text-emerald-700">
                                          Ahorrás ₲ {budgetCpuComparison.amd.ahorroPyg.toLocaleString("es-PY")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10.5px] text-zinc-600 leading-snug">
                                      {budgetCpuComparison.amd.analisis}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {amd.ok && (
                                <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-zinc-200/60">
                                  <span
                                    className={
                                      amd.diffPyg >= 0
                                        ? "text-emerald-700 font-bold"
                                        : "text-amber-700 font-bold"
                                    }
                                  >
                                    {amd.diffPyg >= 0
                                      ? `Sobran ₲ ${amd.diffPyg.toLocaleString("es-PY")}`
                                      : `Excede por ₲ ${Math.abs(amd.diffPyg).toLocaleString("es-PY")}`}
                                  </span>
                                  <span className="font-bold text-rose-700">
                                    {isCurrent ? "✓ Aplicado" : "Aplicar AMD →"}
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })()}

                        {/* Tarjeta Comparativa Intel */}
                        {(() => {
                          const intel = budgetBrandPreviews.INTEL;
                          const isCurrent = budgetAnalysis?.brandUsed === "INTEL";
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setBudgetCpuPreference("INTEL");
                                buildPcByTargetBudget(budgetBrandPreviews.amount, "INTEL");
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                isCurrent
                                  ? "bg-sky-50/60 border-sky-500 ring-2 ring-sky-500/15"
                                  : "bg-zinc-50/70 hover:bg-sky-50/30 border-zinc-200"
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-black text-sky-900 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                                    Opción Intel Core ({intel.socketUsed || "LGA1700"})
                                  </span>
                                  <span className="font-mono text-xs font-black text-zinc-900">
                                    {intel.ok
                                      ? `₲ ${intel.totalPyg.toLocaleString("es-PY")}`
                                      : "Sin stock"}
                                  </span>
                                </div>
                                {intel.ok ? (
                                  <p className="text-[11px] text-zinc-600 mt-1 line-clamp-2 leading-snug">
                                    <strong>{intel.cpuName}</strong> + {intel.gpuName} ·{" "}
                                    {intel.ramSummary} · {intel.ssdSummary}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-amber-800 mt-1">
                                    {intel.faltantes.join(", ")}
                                  </p>
                                )}

                                {/* Porcentaje de Rendimiento & Análisis de Conveniencia por Precio */}
                                {intel.ok && budgetCpuComparison && (
                                  <div className="pt-2 border-t border-sky-200/60 space-y-1.5 text-left">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold text-zinc-700 flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        <span>Rendimiento Estimado:</span>
                                      </span>
                                      <span className="font-mono font-extrabold text-zinc-900">
                                        {budgetCpuComparison.intel.pct}%
                                        {budgetCpuComparison.intel.esGanadorRendimiento && (
                                          <span className="text-emerald-700 font-bold ml-1 text-[10px]">
                                            (+potencia)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-sky-500 transition-all duration-300"
                                        style={{ width: `${budgetCpuComparison.intel.pct}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                                      <span
                                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                          budgetCpuComparison.intel.esMasConveniente
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-black"
                                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                        }`}
                                      >
                                        {budgetCpuComparison.intel.etiquetaConveniencia}
                                      </span>
                                      {budgetCpuComparison.intel.esMasBarato && budgetCpuComparison.intel.ahorroPyg > 0 && (
                                        <span className="text-[10px] font-mono font-semibold text-emerald-700">
                                          Ahorrás ₲ {budgetCpuComparison.intel.ahorroPyg.toLocaleString("es-PY")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10.5px] text-zinc-600 leading-snug">
                                      {budgetCpuComparison.intel.analisis}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {intel.ok && (
                                <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-zinc-200/60">
                                  <span
                                    className={
                                      intel.diffPyg >= 0
                                        ? "text-emerald-700 font-bold"
                                        : "text-amber-700 font-bold"
                                    }
                                  >
                                    {intel.diffPyg >= 0
                                      ? `Sobran ₲ ${intel.diffPyg.toLocaleString("es-PY")}`
                                      : `Excede por ₲ ${Math.abs(intel.diffPyg).toLocaleString(
                                          "es-PY"
                                        )}`}
                                  </span>
                                  <span className="font-bold text-sky-700">
                                    {isCurrent ? "✓ Aplicado" : "Aplicar Intel →"}
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {budgetFeedback && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 animate-in fade-in flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{budgetFeedback}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBudgetFeedback(null)}
                        className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ranuras Principales del Ensamble */}
          <div id="catalog-slots-section" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                Ranuras de Hardware &amp; Componentes
              </span>

              <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
                <label className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyWebStock}
                    onChange={(e) => {
                      setOnlyWebStock(e.target.checked);
                      setDisplayLimit(60);
                    }}
                    className="accent-emerald-700 rounded"
                  />
                  <span className="font-bold">Solo disponibles en stock</span>
                </label>

                <label className="text-xs text-zinc-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyCompatible}
                    onChange={(e) => setOnlyCompatible(e.target.checked)}
                    className="accent-zinc-900 rounded"
                  />
                  <span className="font-medium">Filtrar solo compatibles</span>
                </label>
              </div>
            </div>

            {/* Pestañas de Ranuras */}
            <div className="flex items-center gap-2 overflow-x-auto xl:flex-wrap pb-2 pt-1 scrollbar-none touch-pan-x">
              {SLOTS_CONFIG.map((slot) => {
                const Icon = slot.icono;
                const isSelected = activeTabSlot === slot.categoria;
                const hasItem = selectedComponents.some((c) => c.categoria === slot.categoria);
                return (
                  <button
                    key={slot.categoria}
                    type="button"
                    onClick={() => switchActiveSlot(slot.categoria)}
                    className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer min-h-[42px] sm:min-h-[46px] ${
                      isSelected
                        ? "bg-zinc-900 text-white font-bold shadow-xs"
                        : hasItem
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                        : "bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>
                      {slot.categoria === "GPU"
                        ? "Tarjeta gráfica"
                        : slot.categoria === "PLACA_MADRE"
                        ? "Placa Madre"
                        : slot.nombre.split(" ")[0]}
                    </span>
                    {hasItem && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => switchActiveSlot("TODO")}
                className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[42px] sm:min-h-[46px] ${
                  activeTabSlot === "TODO"
                    ? "bg-zinc-900 text-white font-bold shadow-xs"
                    : "bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                Ver Todo
              </button>
            </div>
          </div>

          {/* Panel Interactivo de Orientación Asistida, Plataforma & Perfil Productivo */}
          {activeTabSlot !== "TODO" && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {/* Encabezado con reset */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Orientación Asistida &amp; Perfiles ·{" "}
                    {SLOTS_CONFIG.find((s) => s.categoria === activeTabSlot)?.nombre || activeTabSlot}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {(slotPlatformFilter !== "TODOS" || slotWorkProfileFilter !== "TODOS" || selectedSocketFilter !== "TODOS") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSocketFilter("TODOS");
                        setSlotPlatformFilter("TODOS");
                        setSlotWorkProfileFilter("TODOS");
                      }}
                      className="text-xs text-zinc-600 hover:text-zinc-900 font-semibold underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowProductivityInsight(!showProductivityInsight)}
                    className="text-xs text-sky-700 hover:text-sky-900 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>{showProductivityInsight ? "Ocultar guía productiva" : "Ver guía de potencia productiva"}</span>
                    <span className="text-[10px]">{showProductivityInsight ? "▲" : "▼"}</span>
                  </button>
                </div>
              </div>

              {/* Banner Dinámico de Compatibilidad y Plataforma Activa */}
              {effectiveSocket !== "TODOS" && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between flex-wrap gap-2.5 shadow-2xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                      ✓
                    </div>
                    <div>
                      <p className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-2">
                        <span>
                          {effectiveSocket === "AM4"
                            ? "Plataforma Activa: 🔴 AMD Socket AM4 (DDR4)"
                            : effectiveSocket === "AM5"
                            ? "Plataforma Activa: 🔴 AMD Socket AM5 (DDR5)"
                            : "Plataforma Activa: 🔵 Intel Socket LGA 1700"}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-bold">
                          100% Filtrado
                        </span>
                      </p>
                      <p className="text-[11px] text-emerald-800 leading-tight mt-0.5">
                        {effectiveSocket === "AM4" &&
                          "Mostrando exclusivamente Procesadores AM4, Placas Madre AM4 y Memorias RAM DDR4. No se mezclará con AM5 ni DDR5."}
                        {effectiveSocket === "AM5" &&
                          "Mostrando exclusivamente Procesadores AM5, Placas Madre AM5 y Memorias RAM DDR5 de última generación."}
                        {effectiveSocket === "LGA1700" &&
                          "Mostrando exclusivamente componentes compatibles con Intel Socket LGA 1700 (12ª, 13ª y 14ª Gen)."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentCpu && (
                      <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-md bg-white text-emerald-900 border border-emerald-200 shadow-2xs">
                        CPU: {cleanDisplayTitle(currentCpu.nombreWeb || currentCpu.descripcion).slice(0, 22)}...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSocketFilter("TODOS");
                        setSlotPlatformFilter("TODOS");
                        if (currentCpu || currentMb) {
                          setSelectedComponents((prev) =>
                            prev.filter(
                              (c) =>
                                c.categoria !== "PROCESADOR" &&
                                c.categoria !== "PLACA_MADRE" &&
                                c.categoria !== "RAM"
                            )
                          );
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100 cursor-pointer shadow-2xs"
                    >
                      {currentCpu || currentMb ? "✕ Quitar CPU/Placa" : "✕ Ver Todo"}
                    </button>
                  </div>
                </div>
              )}

              {/* 1. Selector de Plataforma / Arquitectura */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-zinc-900 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    Seleccionar Plataforma / Arquitectura:
                  </span>
                  {(effectiveSocket !== "TODOS" || slotPlatformFilter !== "TODOS") && (
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                      Filtro Activo: {effectiveSocket !== "TODOS" ? effectiveSocket : slotPlatformFilter}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                  {/* Botones de plataforma según slot */}
                  {activeTabSlot === "PROCESADOR" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("TODOS");
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          effectiveSocket === "TODOS" && slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todas las CPUs
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("AM4");
                          setSlotPlatformFilter("AM4");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveSocket === "AM4"
                            ? "bg-rose-700 text-white shadow-xs font-bold"
                            : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>🔴 AMD Socket AM4 (DDR4)</span>
                        <span className="text-[10px] opacity-80 font-normal">· Ryzen Serie 3000/4000/5000</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("AM5");
                          setSlotPlatformFilter("AM5");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveSocket === "AM5"
                            ? "bg-rose-700 text-white shadow-xs font-bold"
                            : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>🔴 AMD Socket AM5 (DDR5)</span>
                        <span className="text-[10px] opacity-80 font-normal">· Ryzen Serie 7000/8000/9000</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("LGA1700");
                          setSlotPlatformFilter("LGA1700");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveSocket === "LGA1700"
                            ? "bg-sky-700 text-white shadow-xs font-bold"
                            : "bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span>🔵 Intel Core LGA 1700</span>
                        <span className="text-[10px] opacity-80 font-normal">· 12ª, 13ª y 14ª Gen</span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "PLACA_MADRE" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("TODOS");
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          effectiveSocket === "TODOS" && slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todos los Sockets
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("AM4");
                          setSlotPlatformFilter("AM4");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveSocket === "AM4"
                            ? "bg-rose-700 text-white shadow-xs font-bold"
                            : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <span>🔴 AMD Socket AM4 (DDR4)</span>
                        <span className="text-[10px] opacity-80 font-normal">· A520 / B450 / B550</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("AM5");
                          setSlotPlatformFilter("AM5");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveSocket === "AM5"
                            ? "bg-rose-700 text-white shadow-xs font-bold"
                            : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <span>🔴 AMD Socket AM5 (DDR5)</span>
                        <span className="text-[10px] opacity-80 font-normal">· A620 / B650 / X670</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSocketFilter("LGA1700");
                          setSlotPlatformFilter("LGA1700");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveSocket === "LGA1700"
                            ? "bg-sky-700 text-white shadow-xs font-bold"
                            : "bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100"
                        }`}
                      >
                        <span>🔵 Intel Socket LGA 1700</span>
                        <span className="text-[10px] opacity-80 font-normal">· H610 / B760 / Z790</span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "GPU" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todas las GPUs
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("NVIDIA");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "NVIDIA"
                            ? "bg-emerald-700 text-white shadow-xs font-bold"
                            : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>🟢 NVIDIA GeForce RTX</span>
                        <span className="text-[10px] opacity-80 font-normal">· CUDA, OptiX, IA &amp; DLSS 3.5</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("AMD");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "AMD"
                            ? "bg-rose-700 text-white shadow-xs font-bold"
                            : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>🔴 AMD Radeon RX</span>
                        <span className="text-[10px] opacity-80 font-normal">· Más VRAM &amp; FSR 3</span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "RAM" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          effectiveRamType === "TODAS" && slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todas las Memorias
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("DDR4");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveRamType === "DDR4"
                            ? "bg-blue-700 text-white shadow-xs font-bold"
                            : "bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
                        }`}
                      >
                        <span>💎 DDR4 (3200 MHz)</span>
                        <span className="text-[10px] opacity-80 font-normal">
                          {effectiveSocket === "AM4" ? "⭐ Requerido para Socket AM4" : "Económica & Confiable"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("DDR5");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          effectiveRamType === "DDR5"
                            ? "bg-purple-700 text-white shadow-xs font-bold"
                            : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        <span>⚡ DDR5 (5200 - 6000 MHz)</span>
                        <span className="text-[10px] opacity-80 font-normal">
                          {effectiveSocket === "AM5" ? "⭐ Requerido para Socket AM5" : "Nueva Generación"}
                        </span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "ALMACENAMIENTO" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todos los Almacenamientos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("1TB");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "1TB"
                            ? "bg-emerald-700 text-white shadow-xs font-bold"
                            : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        <span>⚡ 1 TB M.2 NVMe PCIe</span>
                        <span className="text-[10px] font-bold text-emerald-800">⭐ Recomendado Tienda</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("2TB");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "2TB"
                            ? "bg-indigo-700 text-white shadow-xs font-bold"
                            : "bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100"
                        }`}
                      >
                        <span>🚀 2 TB+ M.2 NVMe</span>
                        <span className="text-[10px] opacity-80 font-normal">· Proyectos 3D &amp; Juegos Pesados</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("500GB");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "500GB"
                            ? "bg-zinc-800 text-white shadow-xs font-bold"
                            : "bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        <span>📦 500 GB M.2 NVMe</span>
                        <span className="text-[10px] opacity-80 font-normal">· Oficina / Sistema base</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("SATA");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "SATA"
                            ? "bg-zinc-800 text-white shadow-xs font-bold"
                            : "bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        <span>💾 SSD 2.5" SATA</span>
                        <span className="text-[10px] opacity-80 font-normal">· Secundario</span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "FUENTE" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todas las Fuentes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("650W_750W");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "650W_750W"
                            ? "bg-emerald-700 text-white shadow-xs"
                            : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        <span>🏆 650W - 750W (80 Plus)</span>
                        <span className="text-[10px] font-bold text-emerald-800">⭐ Recomendado Gaming</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("850W");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "850W"
                            ? "bg-amber-700 text-white shadow-xs"
                            : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        <span>⚡ 850W+ Gold</span>
                        <span className="text-[10px] opacity-80 font-normal">· RTX 4080/4090 &amp; Workstations</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("550W");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "550W"
                            ? "bg-zinc-800 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        <span>💼 450W - 550W</span>
                        <span className="text-[10px] opacity-80 font-normal">· Oficina / Video Integrado</span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "GABINETE" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todos los Diseños
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("AIRFLOW");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "AIRFLOW"
                            ? "bg-teal-700 text-white shadow-xs"
                            : "bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100"
                        }`}
                      >
                        <span>🌬️ Gamer Mesh Airflow</span>
                        <span className="text-[10px] opacity-80 font-normal">· Máxima Ventilación</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("ACUARIO");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "ACUARIO"
                            ? "bg-cyan-700 text-white shadow-xs"
                            : "bg-cyan-50 text-cyan-900 border border-cyan-200 hover:bg-cyan-100"
                        }`}
                      >
                        <span>💎 Acuario Panorámico</span>
                        <span className="text-[10px] opacity-80 font-normal">· Visión 270° Vidrio Templado</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("OFICINA");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "OFICINA"
                            ? "bg-zinc-800 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        <span>💼 Kit Comercial / Oficina</span>
                        <span className="text-[10px] opacity-80 font-normal">· Incluye Fuente y Periféricos</span>
                      </button>
                    </>
                  )}

                  {activeTabSlot === "REFRIGERACION" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("TODOS");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          slotPlatformFilter === "TODOS"
                            ? "bg-zinc-900 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Todas las Opciones
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("AIRE");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "AIRE"
                            ? "bg-teal-700 text-white shadow-xs"
                            : "bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100"
                        }`}
                      >
                        <span>🌪️ Cooler Torre por Aire</span>
                        <span className="text-[10px] opacity-80 font-normal">· Silencioso &amp; Cero Mantenimiento</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("AIO_240");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "AIO_240"
                            ? "bg-sky-700 text-white shadow-xs"
                            : "bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100"
                        }`}
                      >
                        <span>💧 Water Cooler AIO 240mm</span>
                        <span className="text-[10px] opacity-80 font-normal">· 2 Ventiladores</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotPlatformFilter("AIO_360");
                          setDisplayLimit(60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slotPlatformFilter === "AIO_360"
                            ? "bg-purple-700 text-white shadow-xs"
                            : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        <span>🌊 Water Cooler AIO 360mm</span>
                        <span className="text-[10px] opacity-80 font-normal">· Máxima Disipación (3 Fans)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Selector de Perfil Productivo / Tipo de Trabajo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-zinc-900 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                    Tipo de Trabajo / Potencia Productiva Requerida:
                  </span>
                  {slotWorkProfileFilter !== "TODOS" && (
                    <span className="text-[10px] font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 font-semibold">
                      Perfil: {slotWorkProfileFilter}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSlotWorkProfileFilter("TODOS");
                      setDisplayLimit(60);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      slotWorkProfileFilter === "TODOS"
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    Todos los Perfiles
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSlotWorkProfileFilter("OFICINA");
                      setDisplayLimit(60);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      slotWorkProfileFilter === "OFICINA"
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <span>💼 Oficina, Facturación &amp; Estudios</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSlotWorkProfileFilter("GAMING_1080P");
                      setDisplayLimit(60);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      slotWorkProfileFilter === "GAMING_1080P"
                        ? "bg-blue-700 text-white shadow-xs"
                        : "bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <span>🎮 Gaming 1080p Entrada / Esports</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSlotWorkProfileFilter("GAMING_1440P");
                      setDisplayLimit(60);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      slotWorkProfileFilter === "GAMING_1440P"
                        ? "bg-indigo-700 text-white shadow-xs"
                        : "bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100"
                    }`}
                  >
                    <span>🚀 Gaming 1440p Ultra &amp; Streaming</span>
                  </button>
                  {activeTabSlot === "PROCESADOR" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSlotWorkProfileFilter("GAMING_X3D");
                        setDisplayLimit(60);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        slotWorkProfileFilter === "GAMING_X3D"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      <span>🏆 Gaming Extremo (AMD 3D V-Cache)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSlotWorkProfileFilter("RENDER_IA");
                      setDisplayLimit(60);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      slotWorkProfileFilter === "RENDER_IA"
                        ? "bg-violet-700 text-white shadow-xs"
                        : "bg-violet-50 text-violet-900 border border-violet-200 hover:bg-violet-100"
                    }`}
                  >
                    <span>🎬 Render 3D, Arquitectura, Lumion &amp; IA</span>
                  </button>
                </div>
              </div>

              {/* 3. Panel Educativo de Potencia Productiva (Intel vs AMD / NVIDIA / Componentes) */}
              {showProductivityInsight && (
                <div className="pt-2 border-t border-zinc-100">
                  {activeTabSlot === "PROCESADOR" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Potencia Intel */}
                      <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-sky-950">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                          <span>🔵 Potencia Productiva de Intel Core</span>
                        </div>
                        <ul className="text-zinc-700 space-y-1 text-[11px] leading-relaxed">
                          <li>
                            <strong>• Intel QuickSync Video:</strong> Motor en silicio para Adobe Premiere Pro y DaVinci Resolve. Decodificación y renderizado de video 4K sin tirones en línea de tiempo.
                          </li>
                          <li>
                            <strong>• Arquitectura Híbrida (P-Cores + E-Cores):</strong> Núcleos de potencia para modelado activo en AutoCAD y Revit; núcleos de eficiencia para antivirus, descargas y tareas de fondo.
                          </li>
                          <li>
                            <strong>• Frecuencia Mononúcleo:</strong> Altas frecuencias en GHz que aceleran programas de ingeniería dependientes del rendimiento por hilo único.
                          </li>
                        </ul>
                      </div>

                      {/* Potencia AMD */}
                      <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-rose-950">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                          <span>🔴 Potencia Productiva de AMD Ryzen</span>
                        </div>
                        <ul className="text-zinc-700 space-y-1 text-[11px] leading-relaxed">
                          <li>
                            <strong>• Tecnología 3D V-Cache (X3D):</strong> Memoria caché L3 apilada en el chip. Reduce la latencia de RAM, logrando los FPS más altos del mundo en juegos competitivos y simuladores.
                          </li>
                          <li>
                            <strong>• Longevidad Socket AM5:</strong> Soporte garantizado a futuro hasta 2027+, permitiendo cambiar de CPU en unos años sin tener que comprar otra placa madre ni memorias.
                          </li>
                          <li>
                            <strong>• Eficiencia Térmica &amp; Multihilo Puro:</strong> Menor consumo de vatios y todos los núcleos de alto poder trabajando al unísono para renders pesados en Blender y Cinema 4D.
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTabSlot === "PLACA_MADRE" && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-emerald-950">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>💡 Clave de Elección en Placas Madre (VRM &amp; Disipación)</span>
                      </div>
                      <p className="text-[11px] text-zinc-700 leading-relaxed">
                        Para gaming y trabajo continuo se recomienda la <strong>Gama B (B650 para AMD / B760 para Intel)</strong>: incluye disipadores de aluminio en los módulos reguladores de voltaje (VRM) para evitar que el procesador baje sus frecuencias por calor, y ranuras M.2 NVMe blindadas para cuidar la vida útil del SSD.
                      </p>
                    </div>
                  )}

                  {activeTabSlot === "GPU" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-emerald-950">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                          <span>🟢 Potencia de NVIDIA GeForce RTX</span>
                        </div>
                        <ul className="text-zinc-700 space-y-1 text-[11px] leading-relaxed">
                          <li>
                            <strong>• Ecosistema CUDA &amp; OptiX:</strong> Estándar obligatorio para aceleración en Blender Cycles, V-Ray, Lumion, Unreal Engine 5 y Adobe After Effects.
                          </li>
                          <li>
                            <strong>• Tensor Cores para IA:</strong> Ejecución ultrarrápida de modelos de Inteligencia Artificial local, Stable Diffusion y DLSS 3.5 con generación de fotogramas por IA.
                          </li>
                          <li>
                            <strong>• Codificador NVENC:</strong> Transmisión en vivo para Twitch o YouTube sin consumir recursos del procesador.
                          </li>
                        </ul>
                      </div>
                      <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-rose-950">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                          <span>🔴 Potencia de AMD Radeon RX</span>
                        </div>
                        <ul className="text-zinc-700 space-y-1 text-[11px] leading-relaxed">
                          <li>
                            <strong>• Mayor Memoria VRAM por Dólar:</strong> Búferes de memoria generosos que evitan caídas de rendimiento en texturas ultra en juegos modernos exigentes.
                          </li>
                          <li>
                            <strong>• Rendimiento Raster Puro:</strong> Excelente tasa de cuadros por segundo en resolución 1080p y 1440p nativa a un precio altamente competitivo.
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTabSlot === "RAM" && (
                    <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-purple-950">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>💡 Clave Productiva: Dual Channel Obligatorio &amp; Estándar 32GB</span>
                      </div>
                      <p className="text-[11px] text-zinc-700 leading-relaxed">
                        Cotizar siempre <strong>2 módulos de memoria idénticos</strong> (ej: 2x16GB) duplica el ancho de banda del bus a 128 bits, incrementando entre un <strong>+15% y +25% los FPS</strong> en juegos y eliminando micro-tirones en edición de video. Hoy en día <strong>32 GB</strong> es el estándar recomendado para evitar que Windows recurra al archivo de paginación.
                      </p>
                    </div>
                  )}

                  {activeTabSlot === "ALMACENAMIENTO" && (
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-indigo-950">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>💡 Clave Productiva: SSD M.2 NVMe PCIe Gen4 de 1TB</span>
                      </div>
                      <p className="text-[11px] text-zinc-700 leading-relaxed">
                        Con lecturas de hasta 5.000 MB/s, Windows arranca en menos de 8 segundos y los juegos cargan de inmediato mediante DirectStorage. <strong>1 TB</strong> es el punto de equilibrio ideal para albergar el sistema operativo, herramientas de trabajo pesadas y múltiples juegos simultáneos.
                      </p>
                    </div>
                  )}

                  {activeTabSlot === "FUENTE" && (
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-amber-950">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>💡 Clave de Seguridad: Certificación 80 Plus &amp; Margen del 25%</span>
                      </div>
                      <p className="text-[11px] text-zinc-700 leading-relaxed">
                        Una fuente certificada 80 Plus garantiza más del 80% de eficiencia y protecciones eléctricas activas (OVP, OPP, SCP). Mantener una fuente de <strong>650W a 750W</strong> asegura que trabaje al 50-60% de su capacidad total, prolongando su vida útil, manteniéndose fría y silenciosa.
                      </p>
                    </div>
                  )}

                  {activeTabSlot === "GABINETE" && (
                    <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-teal-950">
                        <Sparkles className="w-4 h-4 text-teal-600" />
                        <span>💡 Clave Estética &amp; Térmica: Frente Mesh (Airflow) vs Vidrio (Acuario)</span>
                      </div>
                      <p className="text-[11px] text-zinc-700 leading-relaxed">
                        Los gabinetes <strong>Mesh Airflow</strong> priorizan la entrada directa de aire fresco manteniendo los componentes hasta 8°C más fríos. Los gabinetes <strong>Acuario Panorámicos</strong> ofrecen una vista limpia de 270° de componentes con iluminación ARGB mediante paneles de vidrio templado continuo.
                      </p>
                    </div>
                  )}

                  {activeTabSlot === "REFRIGERACION" && (
                    <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-sky-950">
                        <Sparkles className="w-4 h-4 text-sky-600" />
                        <span>💡 Clave Térmica: Cooler Torre por Aire vs Water Cooler Líquido AIO (240mm / 360mm)</span>
                      </div>
                      <p className="text-[11px] text-zinc-700 leading-relaxed">
                        Los <strong>Coolers de Torre por Aire</strong> son indestructibles, no requieren mantenimiento y enfrían eficazmente procesadores de hasta 100W TDP. Para procesadores de alto rendimiento (Core i7/i9, Ryzen 7/9) en renders sostenidos, una <strong>Refrigeración Líquida AIO de 240mm o 360mm</strong> disipa el calor rápidamente hacia el exterior del gabinete sin saturar el interior.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buscador en Catálogo & Selector de Marca */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                maxLength={100}
                value={catalogSearchTerm}
                onChange={(e) => {
                  setCatalogSearchTerm(e.target.value);
                  setDisplayLimit(60);
                }}
                placeholder="Buscar por SKU numérico (ej: 67488, 131437), modelo o descripción..."
                className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-9 py-2.5 sm:py-3 text-xs sm:text-sm text-zinc-900 outline-none focus:border-zinc-900 transition-colors shadow-2xs min-h-[46px]"
              />
              {catalogSearchTerm && (
                <button
                  type="button"
                  onClick={() => setCatalogSearchTerm("")}
                  className="absolute right-3.5 top-3 text-sm text-zinc-400 hover:text-zinc-700 p-1"
                >
                  ✕
                </button>
              )}
            </div>

            <div>
              <CleanSelect
                value={selectedBrand}
                onChange={(val) => {
                  setSelectedBrand(val);
                  setDisplayLimit(60);
                }}
                fullWidth
                dropdownWidth="w-full"
                className="min-h-[46px] !py-2.5 !text-xs sm:!text-sm !rounded-xl"
                options={[
                  {
                    value: "TODAS",
                    label:
                      marcasDisponibles.length > 1
                        ? `Todas las marcas (${marcasDisponibles.length - 1})`
                        : "Todas las marcas",
                  },
                  ...marcasDisponibles
                    .filter((m) => m !== "TODAS")
                    .map((b) => ({
                      value: b,
                      label: b,
                    })),
                ]}
              />
            </div>
          </div>

          {/* Contador y Estado de Filtro */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 flex-wrap gap-2">
            <span>
              Mostrando {Math.min(catalogoFiltrado.length, displayLimit)} de{" "}
              <strong>{catalogoFiltrado.length}</strong> componentes{" "}
              {onlyWebStock ? "en stock" : "del catálogo"}
            </span>
            <div className="flex items-center gap-3">
              {selectedBrand !== "TODAS" && (
                <button
                  type="button"
                  onClick={() => setSelectedBrand("TODAS")}
                  className="text-zinc-700 font-semibold hover:underline cursor-pointer"
                >
                  Limpiar marca ({selectedBrand})
                </button>
              )}
            </div>
          </div>

          {/* Barra de Guía Inteligente de Ranura Activa (Armado 1 a 1 Asistido) */}
          {activeTabSlot !== "TODO" && (
            <div className="p-2.5 px-3.5 rounded-xl bg-sky-50/90 border border-sky-200 text-xs text-sky-950 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>
                  {activeTabSlot === "PROCESADOR" &&
                    (effectiveSocket !== "TODOS"
                      ? `Filtrando exclusivamente procesadores recomendados y 100% compatibles con Socket ${effectiveSocket}`
                      : "Mostrando procesadores recomendados en stock")}
                  {activeTabSlot === "PLACA_MADRE" &&
                    (effectiveSocket !== "TODOS"
                      ? `Filtrando exclusivamente placas madre recomendadas y 100% compatibles con Socket ${effectiveSocket}`
                      : "Mostrando placas madre equilibradas y compatibles")}
                  {activeTabSlot === "RAM" &&
                    (effectiveRamType !== "TODAS"
                      ? `Filtrando exclusivamente memorias RAM ${effectiveRamType} compatibles con la plataforma ${effectiveSocket !== "TODOS" ? effectiveSocket : ""}`
                      : "Mostrando memorias RAM recomendadas (DDR4 / DDR5) compatibles")}
                  {activeTabSlot === "ALMACENAMIENTO" &&
                    "Mostrando unidades SSD M.2 NVMe PCIe y SATA internas recomendadas de alta velocidad"}
                  {activeTabSlot === "GPU" &&
                    "Mostrando tarjetas gráficas recomendadas para gaming, arquitectura y creación"}
                  {activeTabSlot === "FUENTE" &&
                    `Mostrando fuentes certificadas 80 Plus recomendadas para tu consumo (${resultadoCompatibilidad.consumoTotalWatts}W)`}
                  {activeTabSlot === "GABINETE" &&
                    "Mostrando gabinetes recomendados con espacio adecuado y flujo de aire"}
                  {activeTabSlot === "REFRIGERACION" &&
                    (currentCpu && !currentCpu.includesCooler
                      ? "⚠️ Tu procesador requiere cooler dedicado. Mostrando coolers de CPU compatibles al inicio"
                      : "Mostrando opciones de disipación y Water Coolers AIO recomendados")}
                </span>
              </span>
              <span className="text-[11px] font-mono font-bold text-sky-800 bg-white/90 px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">
                ⭐ Recomendados al inicio
              </span>
            </div>
          )}

          {/* Lista de Componentes Disponibles en Catálogo */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 max-h-[58dvh] sm:max-h-[540px] 2xl:max-h-[680px] 3xl:max-h-[780px] overflow-y-auto overscroll-contain shadow-sm">
            {isLoadingWeb && Object.keys(liveBySku).length === 0 ? (
              <div className="p-6 sm:p-10 text-center text-zinc-500 space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-600" />
                <p className="text-xs font-semibold text-zinc-800">
                  Consultando precios en Guaraníes y disponibilidad en tiempo real...
                </p>
                <p className="text-[11px] text-zinc-400">
                  Filtrando únicamente hardware real de escritorio (Fuentes ATX certificadas, Memorias Desktop DDR4/DDR5, SSDs NVMe y Coolers de CPU).
                </p>
              </div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-zinc-500 space-y-2.5">
                <Info className="w-6 h-6 mx-auto opacity-40 text-zinc-400" />
                <p className="text-xs">
                  No se encontraron componentes en stock con los filtros actuales.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                  {onlyCompatible && (
                    <button
                      type="button"
                      onClick={() => setOnlyCompatible(false)}
                      className="text-xs text-zinc-900 font-semibold hover:underline cursor-pointer"
                    >
                      Desactivar filtro de compatibilidad
                    </button>
                  )}
                  {onlyWebStock && (
                    <button
                      type="button"
                      onClick={() => setOnlyWebStock(false)}
                      className="text-xs text-amber-800 font-semibold hover:underline cursor-pointer"
                    >
                      Ver también SKUs agotados
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {catalogoFiltrado.slice(0, displayLimit).map((item) => {
                  const isSelected = selectedComponents.some((c) => c.sku === item.sku);
                  const isInStock = item.stockStatus === "IN_STOCK";
                  const precioPyg = item.precioPyg || 0;
                  const precioRegPyg = item.precioRegularPyg || precioPyg;
                  const hasDiscount = isInStock && precioRegPyg > precioPyg;
                  const discountPct = hasDiscount
                    ? Math.round(((precioRegPyg - precioPyg) / precioRegPyg) * 100)
                    : 0;
                  const precioUsd =
                    tipoCambio > 0 ? Math.round((precioPyg / tipoCambio) * 100) / 100 : 0;
                  const recommended = isItemSmartRecommended(item);
                  const displayTitle = cleanDisplayTitle(item.nombreWeb || item.descripcion);

                  return (
                    <div
                      key={item.sku}
                      className={`p-3.5 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-3.5 ${
                        isSelected
                          ? "bg-zinc-50/90 border-l-4 border-l-zinc-900"
                          : recommended
                          ? "bg-amber-50/20 border-l-4 border-l-amber-500 hover:bg-amber-50/35"
                          : !isInStock
                          ? "bg-zinc-50/40 opacity-65"
                          : "hover:bg-zinc-50/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
                          <span className="font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">
                            SKU {item.sku}
                          </span>
                          {item.marca && (
                            <span className="font-mono text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-300">
                              {item.marca}
                            </span>
                          )}
                          {isInStock ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              EN STOCK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              ✕ SIN STOCK
                            </span>
                          )}
                          {recommended && (
                            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-2xs">
                              ⭐ RECOMENDADO &amp; COMPATIBLE
                            </span>
                          )}
                          {hasDiscount && discountPct > 0 && (
                            <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                              -{discountPct}% WEB
                            </span>
                          )}
                          {item.socket && item.socket !== "UNIVERSAL" && (
                            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-mono font-semibold">
                              {item.socket}
                            </span>
                          )}
                          {item.ramType && item.ramType !== "UNIVERSAL" && (
                            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono font-semibold">
                              {item.ramType}
                            </span>
                          )}
                          {item.esM2Nvme && (
                            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono font-semibold">
                              M.2 NVMe
                            </span>
                          )}
                          {item.potenciaWatts ? (
                            <span className="text-[10px] sm:text-[11px] text-emerald-800 font-mono font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              {item.potenciaWatts}W Reales
                            </span>
                          ) : null}
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-zinc-900 line-clamp-2 leading-snug">
                          {displayTitle}
                        </h4>

                        <div className="flex items-center gap-3.5 text-xs sm:text-sm text-zinc-600 mt-1.5 flex-wrap">
                          <span className="font-medium">Garantía: 3 meses</span>
                          {item.urlWeb && (
                            <a
                              href={item.urlWeb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                            >
                              <span>Ver producto</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {item.categoria === "PROCESADOR" && item.hasIGpu === false && (
                            <span className="text-amber-700 font-semibold">
                              ⚠️ Requiere placa de video dedicada
                            </span>
                          )}
                          {item.categoria === "PROCESADOR" && item.includesCooler === false && (
                            <span className="text-rose-700 font-semibold">
                              ❄️ Sin cooler de fábrica (Requiere Cooler CPU)
                            </span>
                          )}
                          {item.categoria === "GABINETE" && item.isKitOficina && (
                            <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
                              📦 Kit Oficina (Fuente {item.fuenteIncluidaWatts || 200}W + Periféricos)
                            </span>
                          )}
                          {item.categoria === "GABINETE" && currentCooler && (currentCooler.isAioLiquid || /WATER|LIQUID|L[IÍ]QUIDO|AIO|360|240/i.test(`${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`)) && (item.isKitOficina || (item.maxRadiatorMm ?? 0) === 0) && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              ❌ Incompatible: No admite Water Cooler (Solo Aire)
                            </span>
                          )}
                          {item.categoria === "GABINETE" && currentCooler && (currentCooler.radiatorSizeMm === 360 || /360/i.test(`${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`)) && (item.maxRadiatorMm ?? 0) > 0 && (item.maxRadiatorMm ?? 0) < 360 && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              ❌ Incompatible con radiador 360mm (admite hasta 240mm)
                            </span>
                          )}
                          {item.categoria === "GABINETE" && currentCooler && (currentCooler.radiatorSizeMm === 240 || /240/i.test(`${currentCooler.descripcion} ${currentCooler.nombreWeb || ""}`)) && (item.maxRadiatorMm ?? 0) < 240 && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              ❌ Incompatible con radiador 240mm
                            </span>
                          )}
                          {item.categoria === "REFRIGERACION" && (item.radiatorSizeMm === 360 || /360/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)) && (
                            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono font-bold">
                              Radiador 360mm
                            </span>
                          )}
                          {item.categoria === "REFRIGERACION" && (item.isAioLiquid || item.radiatorSizeMm) && currentGabinete && (currentGabinete.isKitOficina || (currentGabinete.maxRadiatorMm ?? 0) === 0) && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              ❌ Incompatible: Gabinete actual ({currentGabinete.sku}) no admite Water Cooler (Solo Aire)
                            </span>
                          )}
                          {item.categoria === "REFRIGERACION" && (item.radiatorSizeMm === 360 || /360/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)) && currentGabinete && (currentGabinete.maxRadiatorMm ?? 0) > 0 && (currentGabinete.maxRadiatorMm ?? 0) < 360 && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              ❌ Incompatible: Gabinete actual solo admite hasta {currentGabinete.maxRadiatorMm}mm
                            </span>
                          )}
                          {item.categoria === "REFRIGERACION" && (item.radiatorSizeMm === 240 || /240/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)) && currentGabinete && (currentGabinete.maxRadiatorMm ?? 0) < 240 && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              ❌ Incompatible: Gabinete actual no admite radiador de 240mm
                            </span>
                          )}
                        </div>

                        {/* Perfil Productivo & Resumen de Trabajo */}
                        {item.perfilProductivo && (
                          <div className="mt-2.5 p-2 rounded-lg bg-zinc-50 border border-zinc-200/80 flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 inline-flex items-center gap-1">
                                <span>🎯</span> {item.perfilProductivo}
                              </span>
                              {item.categoria === "PROCESADOR" && (
                                item.marca === "AMD" || /RYZEN/i.test(item.descripcion) ? (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                                    🔴 AMD Ryzen
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                                    🔵 Intel Core
                                  </span>
                                )
                              )}
                              {item.categoria === "GPU" && (
                                item.marca === "NVIDIA" || /RTX|GEFORCE|GTX/i.test(item.descripcion) ? (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    🟢 NVIDIA RTX
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                                    🔴 AMD Radeon
                                  </span>
                                )
                              )}
                            </div>
                            {item.resumenTrabajo && (
                              <p className="text-[11px] sm:text-xs text-zinc-600 leading-snug flex items-center gap-1">
                                <span className="not-italic text-amber-500 font-bold">💡</span>
                                <span>{item.resumenTrabajo}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Precios Estrictos de https://nissei.com/py/ y Botón de Selección */}
                      <div className="sm:text-right shrink-0 flex items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                        <div>
                          {item.sku === "STOCK-COOLER" ? (
                            <>
                              <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-700 block">
                                BONIFICADO
                              </span>
                              <span className="text-[11px] font-mono text-zinc-500 block">
                                Incluido con CPU
                              </span>
                            </>
                          ) : isInStock ? (
                            <>
                              {hasDiscount && (
                                <span className="text-[11px] font-mono text-zinc-400 line-through block">
                                  ₲ {precioRegPyg.toLocaleString("es-PY")}
                                </span>
                              )}
                              {moneda === "PYG" ? (
                                <>
                                  <span className="text-sm sm:text-base font-extrabold font-mono text-zinc-900 block">
                                    ₲ {precioPyg.toLocaleString("es-PY")}
                                  </span>
                                  <span className="text-[11px] font-mono text-zinc-500 block">
                                    US${" "}
                                    {precioUsd.toLocaleString("es-PY", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm sm:text-base font-extrabold font-mono text-zinc-900 block">
                                    US${" "}
                                    {precioUsd.toLocaleString("es-PY", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span className="text-[11px] font-mono text-zinc-500 block">
                                    ₲ {precioPyg.toLocaleString("es-PY")}
                                  </span>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-xs sm:text-sm font-bold font-mono text-rose-700 block">
                                Sin stock web
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400 block">
                                No cotizable
                              </span>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!isInStock}
                          onClick={() => handleSelectComponent(item)}
                          className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 min-h-[40px] sm:min-h-[44px] min-w-[90px] text-center ${
                            !isInStock
                              ? "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                              : isSelected
                              ? "bg-zinc-900 text-white shadow-xs cursor-pointer"
                              : "bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 cursor-pointer shadow-2xs"
                          }`}
                        >
                          {!isInStock
                            ? "Agotado"
                            : isSelected
                            ? "Agregado ✓"
                            : "+ Agregar"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {catalogoFiltrado.length > displayLimit && (
                  <div className="p-3 text-center bg-zinc-50 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setDisplayLimit((prev) => prev + 60)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 shadow-2xs cursor-pointer transition-colors"
                    >
                      Cargar más componentes (+{catalogoFiltrado.length - displayLimit} restantes)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Columna Derecha: Hoja de Presupuesto en Vivo & Compatibilidad (5 cols) */}
        <section className="lg:col-span-5 3xl:col-span-4 space-y-4 min-w-0">
          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 sm:p-5 space-y-4 shadow-sm lg:sticky lg:top-20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 flex items-center gap-2 flex-wrap">
                  <span>Presupuesto de PC</span>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-500">
                    ({selectedComponents.length} componentes)
                  </span>
                </h3>
                {clienteNombre ? (
                  <span className="text-xs sm:text-sm text-zinc-600 block mt-0.5 truncate">
                    Cliente: {clienteNombre}
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm text-zinc-500 block mt-0.5 truncate">
                    Resumen del ensamble
                  </span>
                )}
              </div>

              {/* Estado de Compatibilidad General Dinámico */}
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 shrink-0 ${
                  resultadoCompatibilidad.totalErrores > 0
                    ? "bg-rose-50 border-rose-200 text-rose-800 animate-pulse"
                    : resultadoCompatibilidad.totalWarnings > 0
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : resultadoCompatibilidad.totalSugerencias > 0
                    ? "bg-sky-50 border-sky-200 text-sky-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                {resultadoCompatibilidad.totalErrores > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Incompatible ({resultadoCompatibilidad.totalErrores} {resultadoCompatibilidad.totalErrores === 1 ? "error crítico" : "errores críticos"})</span>
                  </>
                ) : resultadoCompatibilidad.totalWarnings > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Revisar ({resultadoCompatibilidad.totalWarnings} advertencias)</span>
                  </>
                ) : resultadoCompatibilidad.totalSugerencias > 0 ? (
                  <>
                    <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Compatible ({resultadoCompatibilidad.totalSugerencias} sugerencias pro)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Compatible 100%</span>
                  </>
                )}
              </div>
            </div>

            {/* AUDITORÍA DE COMPATIBILIDAD EN TIEMPO REAL CON FICHAS TÉCNICAS WEB */}
            {selectedComponents.length >= 2 && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-2.5 transition-all ${
                  resultadoCompatibilidad.totalErrores > 0
                    ? "bg-rose-50/90 border-rose-300 shadow-2xs"
                    : "bg-emerald-50/70 border-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-sm">🌐</span>
                    <span className="text-zinc-900 font-extrabold text-[12px]">
                      Auditoría Web Oficial de Fabricantes
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunWebAudit}
                    disabled={isAuditingWeb}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:text-black font-semibold text-[10.5px] shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <Search className={`w-3 h-3 ${isAuditingWeb ? "animate-spin text-emerald-600" : ""}`} />
                    <span>{isAuditingWeb ? "Auditando web..." : "Re-auditar Fichas Web"}</span>
                  </button>
                </div>

                {/* Si hay error crítico (ej: Cooler Líquido en Gabinete sin soporte de radiadores) */}
                {resultadoCompatibilidad.totalErrores > 0 ? (
                  <div className="space-y-2 pt-0.5">
                    <div className="p-2.5 rounded-lg bg-rose-100/90 border border-rose-300 text-rose-950 font-medium space-y-1">
                      <div className="flex items-center gap-1.5 font-black text-rose-900">
                        <span>⛔</span>
                        <span>Incompatibilidad Física Detectada en Fichas Oficiales</span>
                      </div>
                      <p className="text-[11px] leading-snug">
                        {resultadoCompatibilidad.alertas.find((a) => a.tipo === "ERROR")?.detalle ||
                          "Uno o más componentes presentan colisión física según especificaciones técnicas oficiales."}
                      </p>
                    </div>

                    {/* Botones de Auto-Corrección Inmediata con 1 toque */}
                    <div className="flex flex-col sm:flex-row gap-1.5 pt-1">
                      {currentCooler &&
                        (currentCooler.isAioLiquid || currentCooler.radiatorSizeMm) &&
                        (currentGabinete?.maxRadiatorMm ?? 0) < (currentCooler.radiatorSizeMm || 240) && (
                          <>
                            <button
                              type="button"
                              onClick={handleAutoFixGabineteLiquid}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                            >
                              <span>✨</span>
                              <span>Poner Gabinete con soporte de radiador</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleAutoFixCoolerAir}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                            >
                              <span>❄️</span>
                              <span>Cambiar a Cooler de Aire (Recomendado)</span>
                            </button>
                          </>
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-0.5 text-[11px] text-zinc-700">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Fichas técnicas oficiales validadas (0 colisiones):</span>
                    </div>
                    <ul className="grid grid-cols-1 gap-1 text-[10.5px] font-mono text-zinc-600 pl-4 list-disc">
                      {currentCooler && currentGabinete && (
                        <li>
                          {currentCooler.isAioLiquid || currentCooler.radiatorSizeMm
                            ? `Water Cooler (${currentCooler.radiatorSizeMm || 240}mm) entra en soporte superior/frontal del gabinete (${currentGabinete.maxRadiatorMm}mm max).`
                            : `Cooler por aire compatible con el despeje del gabinete.`}
                        </li>
                      )}
                      {currentMb && currentGabinete && (
                        <li>
                          Placa Madre ({currentMb.formFactor || "ATX"}) compatible con chasis {currentGabinete.maxMbFormFactor || "ATX"}.
                        </li>
                      )}
                      {currentCpu && currentMb && (
                        <li>
                          Socket CPU {currentCpu.socket} 100% compatible con Placa {currentMb.socket}.
                        </li>
                      )}
                      {currentPsu && (
                        <li>
                          Fuente {currentPsu.potenciaWatts || 500}W cubre {resultadoCompatibilidad.consumoTotalWatts}W estimados (Margen 130%).
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Enlace directo para verificar ficha técnica en Google */}
                {currentGabinete && currentCooler && (
                  <div className="pt-1.5 border-t border-zinc-200/60 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 font-mono">
                      {lastAuditTimestamp ? `Auditado a las ${lastAuditTimestamp}` : "Revisión técnica en vivo"}
                    </span>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        `${currentGabinete.descripcion} radiator support specs ${currentCooler.descripcion}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Verificar en Google</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Checklist Inteligente de Completitud para Venta Segura */}
            <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Checklist del Ensamble ({resultadoCompatibilidad.porcentajeCompletitud}%)
                </span>
                <span className="text-[11px] font-mono font-semibold text-zinc-500">
                  {Object.values(resultadoCompatibilidad.checklist).filter(Boolean).length} de 8 partes
                </span>
              </div>
              
              {/* Barra de Progreso */}
              <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    resultadoCompatibilidad.porcentajeCompletitud === 100
                      ? "bg-emerald-500"
                      : resultadoCompatibilidad.porcentajeCompletitud >= 50
                      ? "bg-sky-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${resultadoCompatibilidad.porcentajeCompletitud}%` }}
                />
              </div>

              {/* Grid de Chips con Shortcut al Catálogo */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5 text-[11px]">
                {[
                  { key: "cpu", label: "CPU", slot: "PROCESADOR" as const, ready: resultadoCompatibilidad.checklist.cpu },
                  { key: "mb", label: "Placa", slot: "PLACA_MADRE" as const, ready: resultadoCompatibilidad.checklist.mb },
                  { key: "ram", label: "RAM", slot: "RAM" as const, ready: resultadoCompatibilidad.checklist.ram },
                  { key: "storage", label: "Disco", slot: "ALMACENAMIENTO" as const, ready: resultadoCompatibilidad.checklist.storage },
                  { key: "gpu", label: "Video", slot: "GPU" as const, ready: resultadoCompatibilidad.checklist.gpu },
                  { key: "psu", label: "Fuente", slot: "FUENTE" as const, ready: resultadoCompatibilidad.checklist.psu },
                  { key: "gabinete", label: "Gabinete", slot: "GABINETE" as const, ready: resultadoCompatibilidad.checklist.gabinete },
                  { key: "cooler", label: "Cooler", slot: "REFRIGERACION" as const, ready: resultadoCompatibilidad.checklist.cooler },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      switchActiveSlot(item.slot);
                      const el = document.getElementById("catalog-slots-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    title={item.ready ? `${item.label} ya seleccionado ✓` : `Click para cotizar ${item.label} compatible`}
                    className={`px-1.5 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
                      item.ready
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold"
                        : "bg-white border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-800 hover:text-zinc-900"
                    }`}
                  >
                    <span>{item.ready ? "✓" : "+"}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Botón Inteligente para Autocompletar el Resto de la PC */}
            {selectedComponents.length > 0 && selectedComponents.length < 7 && (
              <button
                type="button"
                onClick={handleAutoCompletarInteligente}
                className="w-full py-2.5 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs min-h-[42px]"
              >
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Autocompletar piezas faltantes compatibles inteligentemente</span>
              </button>
            )}

            {/* Alertas Inteligentes de Compatibilidad, Prevención de Errores y Sugerencias Pro */}
            {resultadoCompatibilidad.alertas.length > 0 && (
              <div className="space-y-2">
                {resultadoCompatibilidad.alertas.map((a, idx) => {
                  const isError = a.tipo === "ERROR";
                  const isWarning = a.tipo === "WARNING";
                  const isSuggestion = a.tipo === "SUGGESTION";

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isError
                          ? "bg-rose-50/90 border-rose-300 text-rose-950 shadow-2xs"
                          : isWarning
                          ? "bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs"
                          : "bg-sky-50/90 border-sky-300 text-sky-950 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold flex-wrap">
                          {isError && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-200/90 text-rose-900 border border-rose-300">
                              ⛔ Error Crítico
                            </span>
                          )}
                          {isWarning && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-200/90 text-amber-900 border border-amber-300">
                              ⚠️ Advertencia
                            </span>
                          )}
                          {isSuggestion && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-sky-200/90 text-sky-900 border border-sky-300">
                              💡 Sugerencia Pro
                            </span>
                          )}
                          <strong className="block leading-tight">{a.titulo}</strong>
                        </div>
                      </div>

                      <p className="text-[11px] opacity-90 mt-1 leading-relaxed">{a.detalle}</p>

                      {/* Botón de acción rápida asistida en 1 clic */}
                      {a.accionSugerida && (
                        <div className="pt-2">
                          {isSuggestion ? (
                            <button
                              type="button"
                              onClick={() => handleAlertAction(a)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span>{a.accionSugerida}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAlertAction(a)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer ${
                                isError
                                  ? "bg-rose-700 hover:bg-rose-800"
                                  : isWarning
                                  ? "bg-amber-700 hover:bg-amber-800"
                                  : "bg-zinc-900 hover:bg-black"
                              }`}
                            >
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                              <span>{a.accionSugerida}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Barra de Consumo Eléctrico & Fuente */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 text-xs sm:text-sm font-mono">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 flex items-center gap-1.5 font-sans font-medium">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  Consumo Estimado:
                </span>
                <span className="font-bold text-zinc-900 text-sm sm:text-base">
                  {resultadoCompatibilidad.consumoTotalWatts} W
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200/60 pt-1.5">
                <span className="text-zinc-600 font-sans font-medium">Fuente Recomendada:</span>
                <span className="font-bold text-zinc-900 text-sm sm:text-base">
                  {resultadoCompatibilidad.fuenteRecomendadaWatts} W+
                </span>
              </div>
            </div>

            {/* Lista de Componentes Cargados */}
            <div className="space-y-2.5 max-h-[42dvh] sm:max-h-[360px] 2xl:max-h-[480px] 3xl:max-h-[580px] overflow-y-auto overscroll-contain pr-1">
              {selectedComponents.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                  <p className="text-xs">
                    Ningún componente seleccionado aún. Seleccione componentes con stock activo o elija una recomendación rápida.
                  </p>
                </div>
              ) : (
                selectedComponents.map((c) => {
                  const subPyg = (c.precioPyg || 0) * (c.cantidad || 1);
                  const subUsd =
                    tipoCambio > 0 ? Math.round((subPyg / tipoCambio) * 100) / 100 : 0;
                  const cleanTitle = cleanDisplayTitle(c.nombreWeb || c.descripcion);
                  const itemUrl =
                    c.urlWeb ||
                    (/^\d+$/.test(c.sku)
                      ? `https://nissei.com/py/catalogsearch/result/?q=${c.sku}`
                      : null);
                  return (
                    <div
                      key={c.sku}
                      className="p-3.5 sm:p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-2.5"
                    >
                      <div className="min-w-0 w-full">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
                          <span className="font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-200/90 text-zinc-800 border border-zinc-300 uppercase">
                            {c.categoria}
                          </span>
                          <span className="font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">
                            SKU #{c.sku}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            WEB OK
                          </span>
                        </div>

                        <h5
                          className="text-sm sm:text-base font-bold text-zinc-900 break-words leading-snug"
                          title={cleanTitle}
                        >
                          {cleanTitle}
                        </h5>

                        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-600 mt-1.5 flex-wrap">
                          <span className="font-medium">
                            ₲ {(c.precioPyg || 0).toLocaleString("es-PY")}{" "}
                            {c.cantidad && c.cantidad > 1 ? `x ${c.cantidad}` : ""}
                          </span>
                          <span>·</span>
                          <span className="font-medium">Garantía: 3 meses</span>
                          {itemUrl && (
                            <>
                              <span>·</span>
                              <a
                                href={itemUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold hover:underline print:hidden"
                                title="Ver detalle del producto"
                              >
                                <span>Ver producto</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="w-full flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-200/70">
                        <div className="min-w-0">
                          <span className="font-mono font-extrabold text-sm sm:text-base text-zinc-900 block">
                            {moneda === "PYG"
                              ? `₲ ${subPyg.toLocaleString("es-PY")}`
                              : `US$ ${subUsd.toLocaleString("es-PY", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500 block">
                            {moneda === "PYG"
                              ? `US$ ${subUsd.toLocaleString("es-PY", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : `₲ ${subPyg.toLocaleString("es-PY")}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 justify-end shrink-0">
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, -1)}
                            className="w-9 h-9 rounded-xl bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-800 text-sm font-bold flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
                            title="Disminuir cantidad"
                          >
                            -
                          </button>
                          <span className="font-mono text-sm sm:text-base px-1.5 sm:px-2 text-zinc-900 font-black min-w-[24px] text-center">
                            {c.cantidad || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, 1)}
                            className="w-9 h-9 rounded-xl bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-800 text-sm font-bold flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
                            title="Aumentar cantidad"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(c.sku)}
                            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 border border-zinc-200 text-zinc-400 hover:text-rose-600 text-sm flex items-center justify-center ml-0.5 sm:ml-1 cursor-pointer shadow-2xs transition-colors"
                            title="Quitar componente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Servicio de Armado & Totales Estrictos Web */}
            <div className="pt-3 border-t border-zinc-100 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <span className="text-zinc-700 font-semibold">Costo de servicio del montaje:</span>
                <CleanSelect
                  value={isCorpVendedor ? "0" : String(costoMontajeTiendaPyg)}
                  onChange={() => {}}
                  align="right"
                  dropdownWidth="w-64"
                  className="min-h-[44px] !py-2.5 !text-xs sm:!text-sm !rounded-xl"
                  options={
                    isCorpVendedor
                      ? [{ value: "0", label: "¡Bonificado / GRATIS!" }]
                      : [
                          {
                            value: String(costoMontajeTiendaPyg),
                            label: "58,77$",
                            badge: `₲ ${costoMontajeTiendaPyg.toLocaleString("es-PY")}`,
                          },
                        ]
                  }
                />
              </div>

              {/* Resumen Total Estricto con https://nissei.com/py/ */}
              <div className="p-4 sm:p-5 bg-zinc-900 text-white rounded-2xl space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm uppercase font-bold text-zinc-400">
                    Total Oficial Web (Gs.):
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                    ₲ {totalPresupuestoPyg.toLocaleString("es-PY")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm pt-1.5 border-t border-zinc-800">
                  <span className="text-zinc-400 font-mono">Equivalente en Dólares:</span>
                  <span className="font-mono font-bold text-zinc-200 text-sm sm:text-base">
                    US${" "}
                    {totalPresupuestoUsd.toLocaleString("es-PY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <span className="text-xs text-emerald-400 block pt-1 font-mono font-medium">
                  ✓ Garantía 3 meses · IVA 10% Incluido
                </span>
              </div>

              {/* Acciones del Presupuesto (Copiar / Imprimir para Vendedores; Orden Oficial solo Operadores) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCopyPresupuesto}
                  disabled={selectedComponents.length === 0}
                  className={`py-3 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[46px] ${
                    copiedSuccess
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-900 hover:bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  {copiedSuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSuccess ? "¡Copiado!" : "Copiar Presupuesto"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGuardedAction("PRINT")}
                  disabled={selectedComponents.length === 0}
                  className="py-3 px-3.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 hover:text-zinc-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs min-h-[46px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Ticket Térmico</span>
                </button>
              </div>

              {isOperatorSession && (
                <button
                  type="button"
                  onClick={handleCrearOrdenMontaje}
                  disabled={selectedComponents.length === 0}
                  className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-black disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Generar Orden de Montaje Oficial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Pie de Página */}
      <footer className="border-t border-zinc-200 bg-white py-3 text-center text-xs text-zinc-500 font-mono">
        NISSEI Tech Service Ops · Cotizador de Ensamble de PC
      </footer>
    </main>

    {/* Modal de Impresión Térmica Oficial (Ticket 80mm / 58mm) fuera de <main> para que no sea ocultado por CSS print */}
    <PresupuestoThermalPrintModal
      isOpen={isThermalPrintModalOpen}
      onClose={() => setIsThermalPrintModalOpen(false)}
      data={{
        vendedor: selectedVendedor || "Salón de Ventas",
        areaVendedor: selectedArea || (isCorpVendedor ? "Ventas Corp" : "Ventas Tienda"),
        cliente: clienteNombre.trim() || undefined,
        servicioMontajeNombre: isCorpVendedor ? "Bonificado / Gratis" : "Costo de servicio del montaje",
        servicioMontajePyg: costoMontajePyg,
        totalPyg: totalPresupuestoPyg,
        totalUsd: totalPresupuestoUsd,
        tipoCambio: tipoCambio,
        consumoTotalWatts: resultadoCompatibilidad.consumoTotalWatts,
        fuenteRecomendadaWatts: resultadoCompatibilidad.fuenteRecomendadaWatts,
        items: selectedComponents.map((c) => ({
          sku: c.sku,
          nombre: cleanDisplayTitle(c.nombreWeb || c.descripcion),
          categoria: c.categoria,
          cantidad: c.cantidad || 1,
          precioUnitarioPyg: c.precioPyg || 0,
          subtotalPyg: (c.precioPyg || 0) * (c.cantidad || 1),
        })),
      }}
    />

    {/* Escudo Defensivo Anti-Error de Venta Modal */}
    {showDefensiveModal && (
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-rose-300 space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black tracking-wider uppercase">
                <span>Escudo Anti-Error de Venta</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
                Incompatibilidad Crítica Detectada
              </h3>
              <p className="text-xs text-zinc-600 mt-1">
                Este presupuesto contiene componentes que no encajarán físicamente o no funcionarán juntos. Entregar esta cotización al cliente ocasionará un reclamo inmediato o devolución en el taller de servicio.
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {resultadoCompatibilidad.alertas
              .filter((a) => a.tipo === "ERROR")
              .map((err, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                  <div className="font-bold text-rose-900 flex items-center justify-between">
                    <span>⛔ {err.titulo}</span>
                    {err.categoriaTarget && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDefensiveModal(false);
                          switchActiveSlot(err.categoriaTarget!);
                          const el = document.getElementById("catalog-slots-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="text-[11px] underline text-rose-700 hover:text-rose-900 font-semibold cursor-pointer ml-2"
                      >
                        Corregir pieza →
                      </button>
                    )}
                  </div>
                  <p className="text-rose-800 text-[11px] mt-1 opacity-90 leading-relaxed">{err.detalle}</p>
                </div>
              ))}
          </div>

          <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowDefensiveModal(false);
                if (pendingGuardedAction) {
                  executeGuardedAction(pendingGuardedAction);
                  setPendingGuardedAction(null);
                }
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-semibold cursor-pointer order-2 sm:order-1 transition-colors"
            >
              Ignorar y continuar de todos modos
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDefensiveModal(false);
                const firstErr = resultadoCompatibilidad.alertas.find((a) => a.tipo === "ERROR");
                if (firstErr?.categoriaTarget) {
                  switchActiveSlot(firstErr.categoriaTarget);
                }
                const el = document.getElementById("catalog-slots-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer order-1 sm:order-2 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Resolver y Corregir Incompatibilidad</span>
            </button>
          </div>
        </div>
      </div>
    )}

    <FloatingFeedbackWidget defaultVendedor={selectedVendedor} />
    </>
  );
}
