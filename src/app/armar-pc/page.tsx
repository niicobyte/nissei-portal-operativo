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
} from "lucide-react";
import {
  CATALOGO_PRESUPUESTO_OFICIAL,
  HardwarePresupuestoItem,
  enriquecerComponente,
  verificarCompatibilidadPC,
  TIPO_CAMBIO_PYG_DEFECTO,
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
} from "@/components/common/PresupuestoThermalPrintModal";

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

// Plantillas de ensamble inteligente
const PRESETS = [
  {
    id: "OFICINA_PRO",
    nombre: "Oficina & Negocios",
    tag: "CPU con Video + SSD 500GB + 16GB",
    preferredCpuSkus: ["167102", "77081", "119289", "74198", "67488", "120081", "53841"],
  },
  {
    id: "GAMING_1080P",
    nombre: "Gaming 1080p Ultra",
    tag: "Core i5 / Ryzen 5 + RTX / RX + NVMe",
    preferredCpuSkus: ["119664", "74198", "124223", "133732", "77529", "120081"],
  },
  {
    id: "GAMING_1440P",
    nombre: "Gaming 1440p / Streaming",
    tag: "AM5 Ryzen 5 9600X / 7600X3D + DDR5",
    preferredCpuSkus: ["127768", "161582", "102643", "130805", "161584"],
  },
  {
    id: "CREATOR_X3D",
    nombre: "Workstation High-End",
    tag: "Ryzen 7 9800X3D / Ultra 9 + AIO",
    preferredCpuSkus: ["131437", "154353", "136690", "131884", "110641", "128067"],
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
  const [moneda, setMoneda] = useState<"PYG" | "USD">("PYG");

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

  // Temporizador secuencial de 8 segundos por cada advertencia al ingresar
  useEffect(() => {
    if (!warningStage) return;
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
  }, [warningStage]);

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
        setWebSyncError(data?.error || "No se pudo sincronizar con https://nissei.com/py/.");
      }
    } catch {
      setWebSyncError("Error de red conectando con https://nissei.com/py/.");
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
              precioUsd: Math.round((live.precioPyg / tipoCambio) * 100) / 100,
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
        precioUsd: Math.round((live.precioPyg / tipoCambio) * 100) / 100,
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

  /**
   * MOTOR DE RECOMENDACIÓN EXPERTO ("SUPER INTELIGENTE")
   * Selecciona componentes equilibrados, reales y 100% compatibles en stock de https://nissei.com/py/
   */
  const buildSmartPcConfiguration = (
    tier: "OFICINA_PRO" | "GAMING_1080P" | "GAMING_1440P" | "CREATOR_X3D",
    preserveExisting = false
  ) => {
    const inStockPool = catalogoCompleto.filter(
      (c) => c.stockStatus === "IN_STOCK" && (c.precioPyg || 0) > 0
    );
    if (inStockPool.length === 0) return;

    const existingCpu = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "PROCESADOR")
      : undefined;
    const existingMb = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "PLACA_MADRE")
      : undefined;
    const existingGpu = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "GPU")
      : undefined;

    // 1. PROCESADOR (CPU)
    let cpu = existingCpu;
    if (!cpu) {
      const preset = PRESETS.find((p) => p.id === tier);
      if (existingMb?.socket && existingMb.socket !== "UNIVERSAL") {
        // Si ya eligió Placa Madre, buscar CPU compatible con ese socket
        const compatibleCpus = inStockPool.filter(
          (i) => i.categoria === "PROCESADOR" && i.socket === existingMb.socket
        );
        cpu =
          compatibleCpus[Math.min(compatibleCpus.length - 1, Math.floor(compatibleCpus.length * 0.4))] ||
          compatibleCpus[0];
      } else if (tier === "OFICINA_PRO") {
        // Oficina: Obligatorio CPU con gráficos integrados (hasIGpu === true) y cooler incluido
        cpu =
          preset?.preferredCpuSkus
            .map((sku) => inStockPool.find((i) => i.sku === sku && i.hasIGpu !== false))
            .find(Boolean) ||
          inStockPool.find(
            (i) =>
              i.categoria === "PROCESADOR" &&
              i.hasIGpu !== false &&
              i.includesCooler !== false &&
              (i.precioPyg || 0) >= 600000 &&
              (i.precioPyg || 0) <= 2000000
          ) ||
          inStockPool.find((i) => i.categoria === "PROCESADOR" && i.hasIGpu !== false);
      } else {
        cpu =
          preset?.preferredCpuSkus
            .map((sku) => inStockPool.find((i) => i.sku === sku))
            .find(Boolean) ||
          inStockPool.find((i) => i.categoria === "PROCESADOR");
      }
    }
    if (!cpu) return;

    // 2. PLACA MADRE (Armonizada por Socket y Chipset según la gama del CPU)
    let mb = existingMb;
    if (!mb || (cpu.socket && mb.socket && mb.socket !== cpu.socket)) {
      const mbCandidates = inStockPool.filter(
        (i) => i.categoria === "PLACA_MADRE" && i.socket === cpu?.socket
      );
      if (tier === "CREATOR_X3D") {
        // Priorizar chipsets X870 / X670 / B850 / B650 / Z790 / Z890
        mb =
          mbCandidates.find((i) =>
            /\b(X870|X670|B850|Z890|Z790)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          mbCandidates.find((i) =>
            /\b(B650|B760|B860)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          mbCandidates[Math.min(mbCandidates.length - 1, Math.floor(mbCandidates.length * 0.65))];
      } else if (tier === "GAMING_1440P") {
        // Priorizar chipsets B650 / B840 / B850 / B760 / B860
        mb =
          mbCandidates.find((i) =>
            /\b(B650|B840|B850|B760|B860)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) ||
          mbCandidates[Math.min(mbCandidates.length - 1, Math.floor(mbCandidates.length * 0.4))];
      } else if (tier === "GAMING_1080P") {
        mb =
          mbCandidates.find((i) =>
            /\b(B550|B760|B650|H610|A520)\b/i.test(`${i.descripcion} ${i.nombreWeb || ""}`)
          ) || mbCandidates[0];
      } else {
        mb = mbCandidates[0];
      }
    }

    const requiredRamType =
      mb?.ramType && mb.ramType !== "UNIVERSAL"
        ? mb.ramType
        : cpu.ramType && cpu.ramType !== "UNIVERSAL"
        ? cpu.ramType
        : "DDR4";

    // 3. MEMORIA RAM DESKTOP (Estrictamente DDR4 o DDR5 según la placa, descartando SODIMM/DDR3)
    const existingRams = preserveExisting
      ? selectedComponents.filter(
          (c) => c.categoria === "RAM" && c.ramType === requiredRamType
        )
      : [];
    let ram = existingRams[0];
    if (!ram) {
      const ramCandidates = inStockPool.filter(
        (i) => i.categoria === "RAM" && i.ramType === requiredRamType
      );
      if (tier === "CREATOR_X3D") {
        // Buscar 32GB (o kit 2x16GB) DDR5
        ram =
          ramCandidates.find((i) => (i.capacidadGb || 0) >= 32) ||
          ramCandidates.find((i) => (i.capacidadGb || 0) >= 16) ||
          ramCandidates[Math.min(ramCandidates.length - 1, Math.floor(ramCandidates.length * 0.5))];
      } else if (tier === "GAMING_1440P" || tier === "GAMING_1080P") {
        // Buscar 16GB o 32GB de marca reconocida (Kingston, Corsair, Crucial, XPG, Lexar, G.Skill)
        ram =
          ramCandidates.find(
            (i) =>
              (i.capacidadGb === 16 || i.capacidadGb === 32) &&
              /\b(KINGSTON|CORSAIR|CRUCIAL|XPG|ADATA|LEXAR|G\.SKILL)\b/i.test(
                `${i.marca || ""} ${i.nombreWeb || i.descripcion}`
              )
          ) ||
          ramCandidates.find((i) => (i.capacidadGb || 0) >= 16) ||
          ramCandidates[0];
      } else {
        // Oficina: 8GB o 16GB de marca confiable
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

    // 4. ALMACENAMIENTO SSD (Priorizar siempre M.2 NVMe PCIe de 500GB / 1TB / 2TB sobre SATA 240GB)
    const existingSsds = preserveExisting
      ? selectedComponents.filter((c) => c.categoria === "ALMACENAMIENTO")
      : [];
    let ssd = existingSsds[0];
    if (!ssd) {
      const ssdCandidates = inStockPool.filter((i) => i.categoria === "ALMACENAMIENTO");
      const nvmePool = ssdCandidates.filter((i) => i.esM2Nvme);
      const poolToUse = nvmePool.length > 0 ? nvmePool : ssdCandidates;

      if (tier === "CREATOR_X3D") {
        // 2TB o 1TB NVMe Gen4/Gen5
        ssd =
          poolToUse.find((i) => (i.capacidadGb || 0) >= 1900) ||
          poolToUse.find((i) => (i.capacidadGb || 0) >= 960) ||
          poolToUse[Math.min(poolToUse.length - 1, Math.floor(poolToUse.length * 0.6))];
      } else if (tier === "GAMING_1440P" || tier === "GAMING_1080P") {
        // 1TB NVMe M.2 (o 500GB/512GB NVMe M.2)
        ssd =
          poolToUse.find((i) => (i.capacidadGb || 0) >= 960 && (i.capacidadGb || 0) <= 1050) ||
          poolToUse.find((i) => (i.capacidadGb || 0) >= 480 && (i.capacidadGb || 0) <= 550) ||
          poolToUse[0];
      } else {
        // Oficina: 500GB / 512GB / 480GB NVMe M.2 (evitando discos de 120GB/240GB SATA lentos)
        ssd =
          poolToUse.find((i) => (i.capacidadGb || 0) >= 480 && (i.capacidadGb || 0) <= 550) ||
          ssdCandidates.find((i) => (i.capacidadGb || 0) >= 480 && (i.capacidadGb || 0) <= 550) ||
          poolToUse[0];
      }
    }

    // 5. PLACA DE VIDEO (GPU)
    let gpu = existingGpu;
    if (!gpu) {
      const gpuCandidates = inStockPool.filter((i) => i.categoria === "GPU");
      if (tier === "GAMING_1080P") {
        gpu =
          gpuCandidates.find((i) =>
            /\b(RTX\s*3060|RTX\s*4060|RTX\s*5060|RTX\s*5050|RX\s*7600|RX\s*6600|B580|RTX\s*3050)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          gpuCandidates[Math.min(gpuCandidates.length - 1, Math.floor(gpuCandidates.length * 0.25))];
      } else if (tier === "GAMING_1440P") {
        gpu =
          gpuCandidates.find((i) =>
            /\b(5060\s*TI|4060\s*TI|9060\s*XT|7700\s*XT|7800\s*XT|RTX\s*5070|RTX\s*4070)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          gpuCandidates[Math.min(gpuCandidates.length - 1, Math.floor(gpuCandidates.length * 0.55))];
      } else if (tier === "CREATOR_X3D") {
        gpu =
          gpuCandidates.find((i) =>
            /\b(5070\s*TI|5080|4080|9070\s*XT|RTX\s*5070|4070\s*TI)\b/i.test(
              `${i.descripcion} ${i.nombreWeb || ""}`
            )
          ) ||
          gpuCandidates[Math.min(gpuCandidates.length - 1, Math.floor(gpuCandidates.length * 0.8))];
      } else if (cpu.hasIGpu === false) {
        // Si el usuario eligió un CPU sin gráficos integrados y pidió autocompletar
        gpu = gpuCandidates[0];
      }
    }

    // 6. FUENTE DE PODER (Estrictamente Fuente ATX Real de PC acorde al consumo, NUNCA adaptadores externos)
    const minPsuWatts =
      tier === "CREATOR_X3D"
        ? Math.max(750, gpu?.recomendadoPsuWatts || 750)
        : tier === "GAMING_1440P"
        ? Math.max(650, gpu?.recomendadoPsuWatts || 650)
        : tier === "GAMING_1080P"
        ? Math.max(600, gpu?.recomendadoPsuWatts || 550)
        : 500;

    const existingPsu = preserveExisting
      ? selectedComponents.find(
          (c) => c.categoria === "FUENTE" && (c.potenciaWatts || 0) >= minPsuWatts
        )
      : undefined;
    let psu = existingPsu;
    if (!psu) {
      const psuCandidates = inStockPool.filter(
        (i) => i.categoria === "FUENTE" && (i.potenciaWatts || 0) >= minPsuWatts
      );
      // Priorizar fuentes con certificación 80 Plus
      psu =
        psuCandidates.find((i) =>
          /\b(80\s*PLUS|80PLUS|BRONZE|GOLD|PLATINUM)\b/i.test(
            `${i.descripcion} ${i.nombreWeb || ""}`
          )
        ) ||
        psuCandidates[0] ||
        inStockPool.find((i) => i.categoria === "FUENTE" && (i.potenciaWatts || 0) >= 500);
    }

    // 7. GABINETE (Acorde a la gama del equipo)
    const existingCase = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "GABINETE")
      : undefined;
    let gabinete = existingCase;
    if (!gabinete) {
      const caseCandidates = inStockPool.filter((i) => i.categoria === "GABINETE");
      const gamerCases = caseCandidates.filter(
        (i) =>
          !i.descripcion.includes("1102K") &&
          !i.descripcion.includes("1103K") &&
          (i.precioPyg || 0) >= 290000
      );
      if (tier === "CREATOR_X3D") {
        gabinete =
          gamerCases.find((i) =>
            /\b(COUGAR|CORSAIR|BE QUIET|ASUS|LIAN LI|NZXT)\b/i.test(
              `${i.marca || ""} ${i.nombreWeb || i.descripcion}`
            ) && (i.precioPyg || 0) >= 550000
          ) ||
          gamerCases[Math.min(gamerCases.length - 1, Math.floor(gamerCases.length * 0.6))] ||
          caseCandidates[0];
      } else if (tier === "GAMING_1440P" || tier === "GAMING_1080P") {
        gabinete = gamerCases[0] || caseCandidates[0];
      } else {
        gabinete = caseCandidates[0];
      }
    }

    // 8. REFRIGERACIÓN (Si el CPU viene SIN cooler o es gama alta, elegir un verdadero Cooler de CPU / Water Cooler AIO)
    const existingCooler = preserveExisting
      ? selectedComponents.find((c) => c.categoria === "REFRIGERACION")
      : undefined;
    let cooler = existingCooler;
    if (
      !cooler ||
      (cpu.includesCooler === false && cooler.sku === "STOCK-COOLER")
    ) {
      const stockCooler = catalogoCompleto.find((i) => i.sku === "STOCK-COOLER");
      const realCpuCoolers = inStockPool.filter(
        (i) => i.categoria === "REFRIGERACION" && i.isCpuCooler
      );
      const liquidAioCoolers = realCpuCoolers.filter((i) =>
        /\b(240|360|LIQUID|LÍQUIDO|LIQUIDO|WATER|AIO|AURA GL|PURE LOOP|LIGHT LOOP)\b/i.test(
          `${i.descripcion} ${i.nombreWeb || ""}`
        )
      );

      if (tier === "CREATOR_X3D" || tier === "GAMING_1440P") {
        cooler = liquidAioCoolers[0] || realCpuCoolers[0] || stockCooler;
      } else if (cpu.includesCooler === false) {
        // Si el procesador no trae cooler de fábrica, elegir obligatoriamente un Cooler de CPU real
        cooler = realCpuCoolers[0] || liquidAioCoolers[0];
      } else {
        cooler = stockCooler;
      }
    }

    const build = [cpu, mb, ram, gpu, ssd, psu, gabinete, cooler].filter(
      Boolean
    ) as HardwarePresupuestoItem[];

    setSelectedComponents(
      build.map((item) => ({
        ...item,
        cantidad:
          tier === "CREATOR_X3D" &&
          item.categoria === "RAM" &&
          (item.capacidadGb || 16) === 16 &&
          !`${item.descripcion} ${item.nombreWeb || ""}`.toUpperCase().includes("2X")
            ? 2
            : 1,
      }))
    );
  };

  const handleAutoCompletarInteligente = () => {
    // Determinar gama automáticamente según el CPU o GPU ya elegido
    const cpuPrice = currentCpu?.precioPyg || 0;
    const gpuPrice = currentGpu?.precioPyg || 0;
    let detectedTier: "OFICINA_PRO" | "GAMING_1080P" | "GAMING_1440P" | "CREATOR_X3D" =
      "GAMING_1080P";

    if (cpuPrice >= 3000000 || gpuPrice >= 4500000) {
      detectedTier = "CREATOR_X3D";
    } else if (
      cpuPrice >= 1750000 ||
      gpuPrice >= 2800000 ||
      currentCpu?.socket === "AM5" ||
      currentCpu?.socket === "LGA1851"
    ) {
      detectedTier = "GAMING_1440P";
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

  // Limpiar configuración
  const handleReset = () => {
    if (confirm("¿Desea limpiar todos los componentes seleccionados?")) {
      setSelectedComponents([]);
    }
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

  const costoMontajeTiendaPyg = Math.round(COSTO_MONTAJE_TIENDA_USD * tipoCambio);
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

  // Filtrado del catálogo en pantalla
  const catalogoFiltrado = useMemo(() => {
    return catalogoCompleto.filter((item) => {
      if (activeTabSlot !== "TODO" && item.categoria !== activeTabSlot) {
        return false;
      }

      if (onlyWebStock && item.stockStatus !== "IN_STOCK") {
        return false;
      }

      if (selectedBrand !== "TODAS" && item.marca?.toUpperCase() !== selectedBrand) {
        return false;
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
        if (
          item.categoria === "PLACA_MADRE" &&
          currentCpu &&
          currentCpu.socket &&
          currentCpu.socket !== "UNIVERSAL"
        ) {
          if (item.socket && item.socket !== "UNIVERSAL" && item.socket !== currentCpu.socket) {
            return false;
          }
        }
        if (
          item.categoria === "PROCESADOR" &&
          currentMb &&
          currentMb.socket &&
          currentMb.socket !== "UNIVERSAL"
        ) {
          if (item.socket && item.socket !== "UNIVERSAL" && item.socket !== currentMb.socket) {
            return false;
          }
        }
        if (item.categoria === "RAM") {
          const reqRam =
            currentMb?.ramType && currentMb.ramType !== "UNIVERSAL"
              ? currentMb.ramType
              : currentCpu?.ramType && currentCpu.ramType !== "UNIVERSAL"
              ? currentCpu.ramType
              : undefined;
          if (reqRam && item.ramType && item.ramType !== "UNIVERSAL" && item.ramType !== reqRam) {
            return false;
          }
        }
        if (
          item.categoria === "REFRIGERACION" &&
          currentCpu &&
          currentCpu.includesCooler === false &&
          item.sku === "STOCK-COOLER"
        ) {
          return false;
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
  }, [
    catalogoCompleto,
    activeTabSlot,
    onlyWebStock,
    catalogSearchTerm,
    selectedBrand,
    onlyCompatible,
    currentCpu,
    currentMb,
    resultadoCompatibilidad.consumoTotalWatts,
  ]);

  // Determinar si un ítem es una recomendación inteligente destacada para el slot activo
  const isItemSmartRecommended = (item: HardwarePresupuestoItem): boolean => {
    if (item.stockStatus !== "IN_STOCK" || item.sku === "STOCK-COOLER") return false;
    if (item.categoria === "ALMACENAMIENTO") {
      return Boolean(item.esM2Nvme && (item.capacidadGb || 0) >= 480);
    }
    if (item.categoria === "FUENTE") {
      return Boolean(
        (item.potenciaWatts || 0) >= resultadoCompatibilidad.fuenteRecomendadaWatts &&
          /\b(80\s*PLUS|80PLUS|BRONZE|GOLD)\b/i.test(`${item.descripcion} ${item.nombreWeb || ""}`)
      );
    }
    if (item.categoria === "REFRIGERACION") {
      return Boolean(item.isCpuCooler);
    }
    if (item.categoria === "RAM") {
      return Boolean((item.capacidadGb || 0) >= 16);
    }
    return false;
  };

  // Generación de resumen de texto para cotización estricta de https://nissei.com/py/
  const generarTextoPresupuesto = () => {
    const fechaHoy = new Date().toLocaleDateString("es-PY");
    let text = `PRESUPUESTO OFICIAL DE PC — NISSEI PARAGUAY (nissei.com/py)\n`;
    text += `Fecha: ${fechaHoy} | Vendedor: ${selectedVendedor || "No especificado"}\n`;
    if (clienteNombre.trim()) {
      text += `Cliente: ${clienteNombre.trim()}\n`;
    }
    text += `--------------------------------------------------\n`;
    text += `DETALLE DE COMPONENTES (PRECIOS Y STOCK VERIFICADOS EN NISSEI.COM/PY):\n`;
    selectedComponents.forEach((c) => {
      const cant = (c.cantidad || 1) > 1 ? ` (x${c.cantidad})` : "";
      const subPyg = (c.precioPyg || 0) * (c.cantidad || 1);
      const subUsd = tipoCambio > 0 ? (subPyg / tipoCambio).toFixed(2) : "0.00";
      text += `• [SKU ${c.sku}] ${cleanDisplayTitle(c.nombreWeb || c.descripcion)}${cant}\n`;
      text += `  Gs. ${subPyg.toLocaleString("es-PY")} (Ref. US$ ${subUsd}) · Garantía: 3 meses\n`;
      if (c.urlWeb) {
        text += `  Link: ${c.urlWeb}\n`;
      }
    });

    text += `--------------------------------------------------\n`;
    text += `Consumo Estimado: ${resultadoCompatibilidad.consumoTotalWatts} W\n`;
    text += `Fuente Recomendada: ${resultadoCompatibilidad.fuenteRecomendadaWatts} W+\n`;
    text += `Servicio de Montaje & QA: ${
      isCorpVendedor
        ? "¡Bonificado / GRATIS! (Ventas Corp)"
        : `58,77$ (Gs. ${costoMontajePyg.toLocaleString("es-PY")})`
    }\n`;
    text += `TOTAL COTIZACIÓN OFICIAL (NISSEI.COM/PY):\n`;
    text += `Gs. ${totalPresupuestoPyg.toLocaleString("es-PY")} Guaraníes (IVA 10% Incluido)\n`;
    text += `Ref. Dólares: US$ ${totalPresupuestoUsd.toLocaleString("es-PY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (TC: ${tipoCambio.toLocaleString("es-PY")} Gs/USD)\n`;
    text += `--------------------------------------------------\n`;
    text += `Garantía de Componentes: 3 meses · Compatibilidad 100% Verificada\n`;
    text += `Cotización estricta sincronizada en vivo con https://nissei.com/py/\n`;

    return text;
  };

  const handleCopyPresupuesto = () => {
    const txt = generarTextoPresupuesto();
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
      vendedor: selectedVendedor || "Sin Asignar",
      canal: selectedCanal,
      tipoServicio: "Montaje",
      consumoEstimado: `${resultadoCompatibilidad.consumoTotalWatts}W`,
      observaciones:
        observacionesPresupuesto ||
        `Presupuesto oficial nissei.com/py (Total: Gs. ${totalPresupuestoPyg.toLocaleString("es-PY")} · Garantía 3 meses). Consumo estimado: ${resultadoCompatibilidad.consumoTotalWatts}W.`,
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

  return (
    <>
    <main className="min-h-dvh bg-[#fbf9f9] text-zinc-900 flex flex-col font-sans relative">
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
                <a
                  href="https://nissei.com/py/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  title="Cotización y stock conectados estrictamente a https://nissei.com/py/"
                >
                  <Globe className="w-3 h-3 text-emerald-600" />
                  <span>Cotización Oficial nissei.com/py</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block truncate">
                Precios en Guaraníes, SKUs verificados y disponibilidad en tiempo real desde{" "}
                <strong className="text-zinc-700">https://nissei.com/py/</strong> · Garantía 3 meses
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap ml-auto">
            <button
              type="button"
              onClick={() => syncWithNisseiWeb(true)}
              disabled={isLoadingWeb}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px] sm:min-h-[42px]"
              title="Refrescar precios y disponibilidad ahora mismo desde https://nissei.com/py/"
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
          {/* Banner de Estado de Conexión Estricta con https://nissei.com/py/ */}
          <div
            className={`px-3 sm:px-4 py-2.5 rounded-xl border text-xs flex flex-col xs:flex-row xs:items-center justify-between gap-2 ${
              isLoadingWeb
                ? "bg-amber-50/80 border-amber-200 text-amber-900"
                : webSyncError
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isLoadingWeb
                    ? "bg-amber-500 animate-ping"
                    : webSyncError
                    ? "bg-rose-500"
                    : "bg-emerald-500 animate-pulse"
                }`}
              />
              {isLoadingWeb ? (
                <span className="font-semibold">
                  Conectando en tiempo real con https://nissei.com/py/ para obtener precios y disponibilidad...
                </span>
              ) : webSyncError ? (
                <span className="font-semibold">{webSyncError}</span>
              ) : (
                <span className="leading-snug">
                  <strong>Conectado en vivo a https://nissei.com/py/</strong> ·{" "}
                  <span className="font-mono font-bold">{totalInStockCount}</span> componentes de
                  escritorio con stock y cotización web activa
                  {lastUpdatedWeb ? ` (Sincronizado ${lastUpdatedWeb})` : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
              <span className="text-zinc-600">TC Ref Gs/USD:</span>
              <input
                type="number"
                min={100}
                max={50000}
                value={tipoCambio}
                onChange={(e) =>
                  setTipoCambio(
                    Math.min(50000, Math.max(100, Number(e.target.value) || TIPO_CAMBIO_PYG_DEFECTO))
                  )
                }
                className="w-20 px-2 py-0.5 bg-white border border-zinc-300 rounded text-xs font-bold text-zinc-900 text-right outline-none focus:border-zinc-900"
                title="Tipo de cambio referencial para conversión a USD (Los precios en Gs. se leen exactamente de nissei.com/py)"
              />
            </div>
          </div>

          {/* Ficha de Datos del Vendedor y Cliente */}
          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 min-w-0 truncate">
                <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Datos de la Cotización (Estricta Web nissei.com/py)</span>
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

            {/* Plantillas Inteligentes de Ensambles Recomendados */}
            <div className="pt-3.5 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Recomendaciones Inteligentes (100% Compatibles &amp; En Stock Web):</span>
                </span>
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isLoadingWeb}
                    onClick={() =>
                      buildSmartPcConfiguration(
                        p.id as "OFICINA_PRO" | "GAMING_1080P" | "GAMING_1440P" | "CREATOR_X3D",
                        false
                      )
                    }
                    className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 text-left transition-all group cursor-pointer shadow-2xs disabled:opacity-50 min-h-[58px]"
                  >
                    <span className="text-xs sm:text-sm font-bold text-zinc-900 block truncate group-hover:text-black">
                      {p.nombre}
                    </span>
                    <span className="text-[11px] sm:text-xs text-zinc-500 block truncate mt-1">
                      {p.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ranuras Principales del Ensamble */}
          <div className="space-y-2">
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
                  <span className="font-bold">Solo disponibles en nissei.com/py</span>
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
                    onClick={() => {
                      setActiveTabSlot(slot.categoria);
                      setSelectedBrand("TODAS");
                      setDisplayLimit(60);
                    }}
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
                onClick={() => {
                  setActiveTabSlot("TODO");
                  setSelectedBrand("TODAS");
                  setDisplayLimit(60);
                }}
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
                placeholder="Buscar por SKU numérico (ej: 67488, 131437), modelo o descripción en nissei.com/py..."
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
              {onlyWebStock ? "en stock en https://nissei.com/py/" : "del catálogo"}
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

          {/* Lista de Componentes Disponibles en Catálogo */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 max-h-[58dvh] sm:max-h-[540px] 2xl:max-h-[680px] 3xl:max-h-[780px] overflow-y-auto overscroll-contain shadow-sm">
            {isLoadingWeb && Object.keys(liveBySku).length === 0 ? (
              <div className="p-6 sm:p-10 text-center text-zinc-500 space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-600" />
                <p className="text-xs font-semibold text-zinc-800">
                  Consultando precios en Guaraníes y disponibilidad en tiempo real en https://nissei.com/py/...
                </p>
                <p className="text-[11px] text-zinc-400">
                  Filtrando únicamente hardware real de escritorio (Fuentes ATX certificadas, Memorias Desktop DDR4/DDR5, SSDs NVMe y Coolers de CPU).
                </p>
              </div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-zinc-500 space-y-2.5">
                <Info className="w-6 h-6 mx-auto opacity-40 text-zinc-400" />
                <p className="text-xs">
                  No se encontraron componentes en stock en <strong>nissei.com/py</strong> con los filtros actuales.
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
                      Ver también SKUs agotados en nissei.com/py
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
                              EN STOCK · NISSEI.COM/PY
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              ✕ SIN STOCK EN WEB
                            </span>
                          )}
                          {recommended && (
                            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                              ★ RECOMENDADO
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
                              <span>Ver en nissei.com/py</span>
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
                        </div>
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
                <span className="text-xs sm:text-sm text-zinc-600 block mt-0.5 truncate">
                  {clienteNombre
                    ? `Cliente: ${clienteNombre}`
                    : "Cotización estricta de https://nissei.com/py/"}
                </span>
              </div>

              {/* Estado de Compatibilidad General */}
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 shrink-0 ${
                  resultadoCompatibilidad.compatible
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800 animate-pulse"
                }`}
              >
                {resultadoCompatibilidad.compatible ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Compatible 100%</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Incompatibilidad</span>
                  </>
                )}
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

            {/* Alertas de Compatibilidad */}
            {resultadoCompatibilidad.alertas.length > 0 && (
              <div className="space-y-1.5">
                {resultadoCompatibilidad.alertas.map((a, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs ${
                      a.tipo === "ERROR"
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : a.tipo === "WARNING"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-sky-50 border-sky-200 text-sky-800"
                    }`}
                  >
                    <strong className="block font-bold">{a.titulo}</strong>
                    <p className="text-[11px] opacity-90 mt-0.5">{a.detalle}</p>
                  </div>
                ))}
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
                    Ningún componente seleccionado aún. Seleccione componentes con stock activo en{" "}
                    <strong>nissei.com/py</strong> o elija una recomendación rápida.
                  </p>
                </div>
              ) : (
                selectedComponents.map((c) => {
                  const subPyg = (c.precioPyg || 0) * (c.cantidad || 1);
                  const subUsd =
                    tipoCambio > 0 ? Math.round((subPyg / tipoCambio) * 100) / 100 : 0;
                  const cleanTitle = cleanDisplayTitle(c.nombreWeb || c.descripcion);
                  return (
                    <div
                      key={c.sku}
                      className="p-3.5 sm:p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-start sm:items-center justify-between gap-3 sm:gap-3.5"
                    >
                      <div className="min-w-0 flex-1">
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
                          className="text-sm sm:text-base font-bold text-zinc-900 line-clamp-2 leading-snug"
                          title={cleanTitle}
                        >
                          {cleanTitle}
                        </h5>

                        <div className="flex items-center gap-3.5 text-xs sm:text-sm text-zinc-600 mt-1.5 flex-wrap">
                          <span className="font-medium">
                            ₲ {(c.precioPyg || 0).toLocaleString("es-PY")}{" "}
                            {c.cantidad && c.cantidad > 1 ? `x ${c.cantidad}` : ""}
                          </span>
                          <span>·</span>
                          <span className="font-medium">Garantía: 3 meses</span>
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0 flex items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60">
                        <div>
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

                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, -1)}
                            className="w-9 h-9 rounded-xl bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-800 text-sm font-bold flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
                            title="Disminuir cantidad"
                          >
                            -
                          </button>
                          <span className="font-mono text-sm sm:text-base px-2 text-zinc-900 font-black min-w-[24px] text-center">
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
                            className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 border border-zinc-200 text-zinc-400 hover:text-rose-600 text-sm flex items-center justify-center ml-1 cursor-pointer shadow-2xs transition-colors"
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
                  ✓ Precios exactos de https://nissei.com/py/ · Garantía 3 meses · IVA 10% Incluido
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
                  onClick={() => setIsThermalPrintModalOpen(true)}
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
        NISSEI Tech Service Ops · Cotizador conectado en tiempo real a https://nissei.com/py/
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
    </>
  );
}
