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
  getStoredVendedores,
} from "@/data/montajesData";

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
    descripcion: "Módulos DDR4 o DDR5",
    icono: Sliders,
    obligatorio: true,
  },
  {
    categoria: "GPU",
    nombre: "Placa de Video",
    descripcion: "Gráficos dedicados para gaming y trabajo",
    icono: Zap,
    obligatorio: false,
  },
  {
    categoria: "ALMACENAMIENTO",
    nombre: "Almacenamiento (SSD)",
    descripcion: "Unidad PCIe M.2 NVMe o SATA",
    icono: Layers,
    obligatorio: true,
  },
  {
    categoria: "FUENTE",
    nombre: "Fuente de Poder",
    descripcion: "Alimentación con certificación 80 Plus",
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
    descripcion: "Cooler de stock, aire o líquido AIO",
    icono: Wrench,
    obligatorio: true,
  },
];

// Plantillas de ensamble rápido (seleccionan automáticamente componentes EN STOCK de https://nissei.com/py/)
const PRESETS = [
  {
    id: "OFICINA_PRO",
    nombre: "Oficina & Negocios",
    tag: "AM4 / LGA1700 con Gráficos",
    preferredSkus: ["53841", "67488", "77081", "119289"],
  },
  {
    id: "GAMING_1080P",
    nombre: "Gaming 1080p Ultra",
    tag: "Ryzen 5 / Core i5 + GPU",
    preferredSkus: ["77529", "119664", "120081", "74198"],
  },
  {
    id: "GAMING_1440P",
    nombre: "Gaming 1440p / Streaming",
    tag: "AM5 Ryzen 5 9600X / 7600X3D",
    preferredSkus: ["127768", "161582", "102643", "130805"],
  },
  {
    id: "CREATOR_X3D",
    nombre: "Workstation High-End",
    tag: "Ryzen 7 9800X3D / Core Ultra 9",
    preferredSkus: ["131437", "154353", "136690", "131884"],
  },
];

function cleanSkuKey(raw: string): string {
  return String(raw || "").trim().replace(/^PC-/i, "");
}

export default function ArmarPcPresupuestadorPage() {
  const router = useRouter();

  // Estados del Presupuesto
  const [vendedores, setVendedores] = useState<string[]>(LISTA_VENDEDORES_REALES);
  const [selectedVendedor, setSelectedVendedor] = useState<string>("Salón de Ventas");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [clienteTelefono, setClienteTelefono] = useState<string>("");
  const [observacionesPresupuesto, setObservacionesPresupuesto] = useState<string>("");
  const [tipoCambio, setTipoCambio] = useState<number>(TIPO_CAMBIO_PYG_DEFECTO);
  // Por defecto mostramos PYG (Guaraníes) ya que https://nissei.com/py/ cotiza oficialmente en Gs.
  const [moneda, setMoneda] = useState<"PYG" | "USD">("PYG");
  const [costoMontajePyg, setCostoMontajePyg] = useState<number>(0); // 0 = Bonificado / Gratis

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
  const [activeTabSlot, setActiveTabSlot] = useState<HardwarePresupuestoItem["categoria"] | "TODO">("PROCESADOR");
  const [catalogSearchTerm, setCatalogSearchTerm] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("TODAS");
  const [displayLimit, setDisplayLimit] = useState<number>(60);
  const [onlyCompatible, setOnlyCompatible] = useState<boolean>(true);
  const [onlyWebStock, setOnlyWebStock] = useState<boolean>(true);

  useEffect(() => {
    setVendedores(getStoredVendedores());
  }, []);

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

  // Si el usuario busca un SKU específico por número y no está aún en liveBySku, consultarlo en directo a nissei.com/py
  useEffect(() => {
    const q = catalogSearchTerm.trim();
    if (!q || q.length < 4) return;
    const candidates = CATALOGO_PRESUPUESTO_OFICIAL.filter(
      (i) => i.sku.toLowerCase().includes(q.toLowerCase()) && !liveBySku[cleanSkuKey(i.sku)]
    )
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

  // Catálogo unificado y estrictamente vinculado a https://nissei.com/py/
  const catalogoCompleto = useMemo<HardwarePresupuestoItem[]>(() => {
    const mergedMap = new Map<string, HardwarePresupuestoItem>();

    // 1. Cruzar todos los SKUs de nuestra base de datos Excel con los datos en vivo de https://nissei.com/py/
    for (const baseItem of CATALOGO_PRESUPUESTO_OFICIAL) {
      if (baseItem.sku === "STOCK-COOLER") {
        mergedMap.set(baseItem.sku, {
          ...baseItem,
          precioPyg: 0,
          precioUsd: 0,
          stockStatus: "IN_STOCK",
          verificadoWeb: true,
        });
        continue;
      }

      const key = cleanSkuKey(baseItem.sku);
      const live = liveBySku[key] || liveBySku[baseItem.sku] || liveBySku[`PC-${key}`];
      const specs = enriquecerComponente({
        sku: baseItem.sku,
        marca: baseItem.marca,
        descripcion: live?.nombre ? `${baseItem.descripcion} ${live.nombre}` : baseItem.descripcion,
        categoria: baseItem.categoria,
        seriales: "",
      });

      if (live && live.stockStatus === "IN_STOCK" && live.precioPyg > 0) {
        const usdCalc = Math.round((live.precioPyg / tipoCambio) * 100) / 100;
        mergedMap.set(key, {
          ...baseItem,
          ...specs,
          sku: key,
          marca: baseItem.marca || specs.marca,
          descripcion: baseItem.descripcion,
          nombreWeb: live.nombre,
          precioPyg: live.precioPyg,
          precioRegularPyg: live.precioRegularPyg,
          precioUsd: usdCalc,
          stockStatus: "IN_STOCK",
          urlWeb: live.urlWeb,
          verificadoWeb: true,
        });
      } else {
        mergedMap.set(key, {
          ...baseItem,
          ...specs,
          sku: key,
          marca: baseItem.marca || specs.marca,
          precioPyg: 0,
          precioRegularPyg: 0,
          precioUsd: 0,
          stockStatus: "OUT_OF_STOCK",
          urlWeb: live?.urlWeb,
          verificadoWeb: false,
        });
      }
    }

    // 2. Incorporar productos nuevos en stock en https://nissei.com/py/ que aún no estaban en el Excel local
    for (const live of liveCatalogItems) {
      const key = cleanSkuKey(live.sku);
      if (!key || mergedMap.has(key)) continue;
      if (live.stockStatus !== "IN_STOCK" || live.precioPyg <= 0) continue;

      const specs = enriquecerComponente({
        sku: key,
        descripcion: live.nombre,
        categoria: live.categoria,
        seriales: "",
      });
      const usdCalc = Math.round((live.precioPyg / tipoCambio) * 100) / 100;

      mergedMap.set(key, {
        ...specs,
        sku: key,
        descripcion: live.nombre.toUpperCase(),
        nombreWeb: live.nombre,
        categoria: live.categoria,
        precioPyg: live.precioPyg,
        precioRegularPyg: live.precioRegularPyg,
        precioUsd: usdCalc,
        stockStatus: "IN_STOCK",
        urlWeb: live.urlWeb,
        verificadoWeb: true,
      });
    }

    // Ordenar: Primero EN STOCK en nissei.com/py, y dentro de ellos por precio ascendente
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

  // Sincronizar precios en vivo de los componentes ya agregados al presupuesto cuando cambia liveBySku o tipoCambio
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
    () => catalogoCompleto.filter((i) => i.stockStatus === "IN_STOCK" && i.sku !== "STOCK-COOLER").length,
    [catalogoCompleto]
  );

  // Componente seleccionado por categoría para referencia de socket/RAM
  const currentCpu = useMemo(
    () => selectedComponents.find((c) => c.categoria === "PROCESADOR"),
    [selectedComponents]
  );
  const currentMb = useMemo(
    () => selectedComponents.find((c) => c.categoria === "PLACA_MADRE"),
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

  // Cargar plantilla rápida usando estrictamente componentes EN STOCK en https://nissei.com/py/
  const handleLoadPreset = (presetId: string) => {
    const inStockPool = catalogoCompleto.filter(
      (c) => c.stockStatus === "IN_STOCK" && (c.precioPyg || 0) > 0
    );
    if (inStockPool.length === 0) return;

    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // 1. Elegir CPU en stock según el perfil
    let cpu =
      preset.preferredSkus
        .map((sku) => inStockPool.find((i) => i.sku === sku))
        .find(Boolean) ||
      inStockPool.find((i) => i.categoria === "PROCESADOR");

    if (!cpu) return;

    // 2. Elegir Placa Madre compatible en stock
    const mbCandidates = inStockPool.filter(
      (i) =>
        i.categoria === "PLACA_MADRE" &&
        (!cpu?.socket || i.socket === cpu.socket)
    );
    const mb =
      presetId === "CREATOR_X3D"
        ? mbCandidates[Math.min(mbCandidates.length - 1, Math.floor(mbCandidates.length * 0.7))]
        : mbCandidates[0];

    const targetRamType =
      mb?.ramType && mb.ramType !== "UNIVERSAL"
        ? mb.ramType
        : cpu.ramType && cpu.ramType !== "UNIVERSAL"
        ? cpu.ramType
        : "DDR4";

    // 3. Elegir Memoria RAM compatible en stock
    const ramCandidates = inStockPool.filter(
      (i) => i.categoria === "RAM" && (!i.ramType || i.ramType === targetRamType)
    );
    const ram =
      presetId === "CREATOR_X3D" || presetId === "GAMING_1440P"
        ? ramCandidates[Math.min(ramCandidates.length - 1, Math.floor(ramCandidates.length * 0.5))]
        : ramCandidates[0];

    // 4. Elegir SSD en stock
    const ssdCandidates = inStockPool.filter(
      (i) => i.categoria === "ALMACENAMIENTO" && i.descripcion.includes("SSD")
    );
    const ssd =
      presetId === "CREATOR_X3D"
        ? ssdCandidates[Math.min(ssdCandidates.length - 1, Math.floor(ssdCandidates.length * 0.6))]
        : ssdCandidates[0] || inStockPool.find((i) => i.categoria === "ALMACENAMIENTO");

    // 5. Elegir GPU en stock (si es perfil Gaming o Workstation, o si el CPU no tiene video integrado)
    const gpuCandidates = inStockPool.filter((i) => i.categoria === "GPU");
    let gpu: HardwarePresupuestoItem | undefined;
    if (presetId === "GAMING_1080P") {
      gpu = gpuCandidates[Math.min(gpuCandidates.length - 1, Math.floor(gpuCandidates.length * 0.25))];
    } else if (presetId === "GAMING_1440P") {
      gpu = gpuCandidates[Math.min(gpuCandidates.length - 1, Math.floor(gpuCandidates.length * 0.55))];
    } else if (presetId === "CREATOR_X3D") {
      gpu = gpuCandidates[Math.min(gpuCandidates.length - 1, Math.floor(gpuCandidates.length * 0.8))];
    } else if (cpu.hasIGpu === false) {
      gpu = gpuCandidates[0];
    }

    // 6. Elegir Fuente en stock acorde a la potencia
    const minPsu = gpu?.recomendadoPsuWatts || 500;
    const psuCandidates = inStockPool.filter(
      (i) => i.categoria === "FUENTE" && (i.potenciaWatts || 500) >= minPsu
    );
    const psu = psuCandidates[0] || inStockPool.find((i) => i.categoria === "FUENTE");

    // 7. Elegir Gabinete en stock
    const caseCandidates = inStockPool.filter((i) => i.categoria === "GABINETE");
    const gabinete =
      presetId === "CREATOR_X3D" || presetId === "GAMING_1440P"
        ? caseCandidates[Math.min(caseCandidates.length - 1, Math.floor(caseCandidates.length * 0.5))]
        : caseCandidates[0];

    // 8. Elegir Refrigeración en stock
    const coolerStock = catalogoCompleto.find((i) => i.sku === "STOCK-COOLER");
    const liquidCoolers = inStockPool.filter(
      (i) => i.categoria === "REFRIGERACION" && (i.descripcion.includes("240") || i.descripcion.includes("360") || i.descripcion.includes("LIQUID"))
    );
    const cooler =
      presetId === "CREATOR_X3D" || presetId === "GAMING_1440P"
        ? liquidCoolers[0] || coolerStock
        : coolerStock;

    const build = [cpu, mb, ram, gpu, ssd, psu, gabinete, cooler].filter(
      Boolean
    ) as HardwarePresupuestoItem[];

    setSelectedComponents(build.map((item) => ({ ...item, cantidad: 1 })));
  };

  // Limpiar configuración
  const handleReset = () => {
    if (confirm("¿Desea limpiar todos los componentes seleccionados?")) {
      setSelectedComponents([]);
    }
  };

  // Cálculo estricto de totales usando el precio oficial en Guaraníes de https://nissei.com/py/
  const totalHardwarePyg = useMemo(() => {
    return selectedComponents.reduce(
      (acc, c) => acc + (c.precioPyg || 0) * (c.cantidad || 1),
      0
    );
  }, [selectedComponents]);

  const totalPresupuestoPyg = totalHardwarePyg + costoMontajePyg;
  const totalPresupuestoUsd =
    tipoCambio > 0 ? Math.round((totalPresupuestoPyg / tipoCambio) * 100) / 100 : 0;

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
        if (
          item.categoria === "RAM" &&
          currentMb &&
          currentMb.ramType &&
          currentMb.ramType !== "UNIVERSAL"
        ) {
          if (item.ramType && item.ramType !== "UNIVERSAL" && item.ramType !== currentMb.ramType) {
            return false;
          }
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
  ]);

  // Generación de resumen de texto para cotización estricta de https://nissei.com/py/
  const generarTextoPresupuesto = () => {
    const fechaHoy = new Date().toLocaleDateString("es-PY");
    let text = `PRESUPUESTO OFICIAL DE PC — NISSEI PARAGUAY (nissei.com/py)\n`;
    text += `Fecha: ${fechaHoy} | Vendedor: ${selectedVendedor}\n`;
    if (clienteNombre.trim()) {
      text += `Cliente: ${clienteNombre.trim()}\n`;
    }
    if (clienteTelefono.trim()) {
      text += `Contacto: ${clienteTelefono.trim()}\n`;
    }
    text += `--------------------------------------------------\n`;
    text += `DETALLE DE COMPONENTES (PRECIOS Y STOCK VERIFICADOS EN NISSEI.COM/PY):\n`;
    selectedComponents.forEach((c) => {
      const cant = (c.cantidad || 1) > 1 ? ` (x${c.cantidad})` : "";
      const subPyg = (c.precioPyg || 0) * (c.cantidad || 1);
      const subUsd = tipoCambio > 0 ? (subPyg / tipoCambio).toFixed(2) : "0.00";
      text += `• [SKU ${c.sku}] ${c.nombreWeb || c.descripcion}${cant}\n`;
      text += `  Gs. ${subPyg.toLocaleString("es-PY")} (Ref. US$ ${subUsd}) · En Stock Web\n`;
      if (c.urlWeb) {
        text += `  Link: ${c.urlWeb}\n`;
      }
    });

    text += `--------------------------------------------------\n`;
    text += `Consumo Estimado: ${resultadoCompatibilidad.consumoTotalWatts} W\n`;
    text += `Fuente Recomendada: ${resultadoCompatibilidad.fuenteRecomendadaWatts} W+\n`;
    text += `Servicio de Montaje & QA: ${
      costoMontajePyg === 0 ? "Bonificado (Gratis)" : `Gs. ${costoMontajePyg.toLocaleString("es-PY")}`
    }\n`;
    text += `TOTAL COTIZACIÓN OFICIAL (NISSEI.COM/PY):\n`;
    text += `Gs. ${totalPresupuestoPyg.toLocaleString("es-PY")} Guaraníes (IVA 10% Incluido)\n`;
    text += `Ref. Dólares: US$ ${totalPresupuestoUsd.toLocaleString("es-PY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (TC: ${tipoCambio.toLocaleString("es-PY")} Gs/USD)\n`;
    text += `--------------------------------------------------\n`;
    text += `Compatibilidad: ${
      resultadoCompatibilidad.compatible
        ? "Verificado 100% Compatible"
        : "Requiere revisión técnica"
    }\n`;
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
      vendedor: selectedVendedor,
      canal: "Tienda",
      tipoServicio: "Montaje",
      consumoEstimado: `${resultadoCompatibilidad.consumoTotalWatts}W`,
      observaciones:
        observacionesPresupuesto ||
        `Presupuesto oficial nissei.com/py (Total: Gs. ${totalPresupuestoPyg.toLocaleString("es-PY")}). Consumo estimado: ${resultadoCompatibilidad.consumoTotalWatts}W.`,
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
    <main className="min-h-dvh bg-[#fbf9f9] text-zinc-900 flex flex-col font-sans">
      {/* Barra Superior con Navegación y Estado de Conexión a https://nissei.com/py/ */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900 border border-zinc-200 rounded-lg shadow-2xs transition-all"
            title="Volver a la pantalla de Acceso"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:-translate-x-0.5 group-hover:text-zinc-900 transition-transform" />
            <span className="hidden sm:inline">Volver</span>
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold">
                <Wrench className="w-4 h-4" />
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-zinc-900 tracking-tight">
                Configurador &amp; Presupuestador de PC
              </h1>
              <a
                href="https://nissei.com/py/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Cotización y stock conectados estrictamente a https://nissei.com/py/"
              >
                <Globe className="w-3 h-3 text-emerald-600" />
                <span>Cotización Oficial nissei.com/py</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <p className="text-[11px] text-zinc-500 hidden sm:block">
              Precios en Guaraníes y disponibilidad en tiempo real sincronizados con{" "}
              <strong className="text-zinc-700">https://nissei.com/py/</strong>
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2">
          {/* Botón Sincronizar Precios en Vivo */}
          <button
            type="button"
            onClick={() => syncWithNisseiWeb(true)}
            disabled={isLoadingWeb}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Refrescar precios y disponibilidad ahora mismo desde https://nissei.com/py/"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeb ? "animate-spin text-emerald-600" : ""}`} />
            <span className="hidden md:inline">
              {isLoadingWeb ? "Sincronizando..." : "Actualizar Web"}
            </span>
          </button>

          {/* Selector de Moneda (Por defecto PYG ₲ oficial de nissei.com/py) */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200 text-xs font-mono">
            <button
              type="button"
              onClick={() => setMoneda("PYG")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
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
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              copiedSuccess
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 hover:bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {copiedSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {copiedSuccess ? "¡Copiado!" : "Copiar Presupuesto"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={selectedComponents.length === 0}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-zinc-900 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
            title="Imprimir cotización"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </header>

      {/* Contenedor Principal: 2 Columnas */}
      <div className="flex-1 max-w-[1680px] w-full mx-auto p-3 sm:p-5 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 min-w-0">
        {/* Columna Izquierda: Configurador y Catálogo de Componentes (7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          {/* Banner de Estado de Conexión Estricta con https://nissei.com/py/ */}
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              isLoadingWeb
                ? "bg-amber-50/80 border-amber-200 text-amber-900"
                : webSyncError
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-2">
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
                <span>
                  <strong>Conectado en vivo a https://nissei.com/py/</strong> ·{" "}
                  <span className="font-mono font-bold">{totalInStockCount}</span> componentes con
                  stock y cotización oficial web activa
                  {lastUpdatedWeb ? ` (Sincronizado ${lastUpdatedWeb})` : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-zinc-600">TC Ref Gs/USD:</span>
              <input
                type="number"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(Math.max(1, Number(e.target.value) || TIPO_CAMBIO_PYG_DEFECTO))}
                className="w-20 px-2 py-0.5 bg-white border border-zinc-300 rounded text-xs font-bold text-zinc-900 text-right outline-none focus:border-zinc-900"
                title="Tipo de cambio referencial para conversión a USD (Los precios en Gs. se leen exactamente de nissei.com/py)"
              />
            </div>
          </div>

          {/* Ficha de Datos del Vendedor y Cliente */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                Datos de la Cotización (Estricta Web nissei.com/py)
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-zinc-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                  Vendedor Asignado
                </label>
                <select
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-900 focus:bg-white transition-colors"
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
                <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Marcelo Gomez..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-900 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Ej: 0981 123456..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-900 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Plantillas Rápidas de Ensambles Recomendados */}
            <div className="pt-3 border-t border-zinc-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                Plantillas de Ensamble Rápido (Solo con Stock Real en nissei.com/py):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isLoadingWeb}
                    onClick={() => handleLoadPreset(p.id)}
                    className="p-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 text-left transition-all group cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <span className="text-xs font-bold text-zinc-900 block truncate group-hover:text-black">
                      {p.nombre}
                    </span>
                    <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
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

              <div className="flex items-center gap-4 flex-wrap">
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
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white font-bold shadow-xs"
                        : hasItem
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                        : "bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{slot.nombre.split(" ")[0]}</span>
                    {hasItem && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={catalogSearchTerm}
                onChange={(e) => {
                  setCatalogSearchTerm(e.target.value);
                  setDisplayLimit(60);
                }}
                placeholder="Buscar por SKU (ej: 67488, 131437), modelo o descripción en nissei.com/py..."
                className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-8 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-900 transition-colors shadow-2xs"
              />
              {catalogSearchTerm && (
                <button
                  type="button"
                  onClick={() => setCatalogSearchTerm("")}
                  className="absolute right-3 top-2 text-xs text-zinc-400 hover:text-zinc-700"
                >
                  ✕
                </button>
              )}
            </div>

            <div>
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                  setDisplayLimit(60);
                }}
                className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-zinc-900 transition-colors shadow-2xs cursor-pointer"
              >
                <option value="TODAS">
                  {marcasDisponibles.length > 1
                    ? `Todas las marcas (${marcasDisponibles.length - 1})`
                    : "Todas las marcas"}
                </option>
                {marcasDisponibles
                  .filter((m) => m !== "TODAS")
                  .map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
              </select>
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
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 max-h-[520px] overflow-y-auto shadow-sm">
            {isLoadingWeb && Object.keys(liveBySku).length === 0 ? (
              <div className="p-10 text-center text-zinc-500 space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-600" />
                <p className="text-xs font-semibold text-zinc-800">
                  Consultando precios en Guaraníes y disponibilidad en tiempo real en https://nissei.com/py/...
                </p>
                <p className="text-[11px] text-zinc-400">
                  Verificando catálogo oficial de Procesadores, Placas Madre, Memorias RAM, GPUs, SSDs, Fuentes, Gabinetes y Coolers.
                </p>
              </div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 space-y-2.5">
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

                  return (
                    <div
                      key={item.sku}
                      className={`p-3.5 transition-colors flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-zinc-50/90 border-l-4 border-l-zinc-900"
                          : !isInStock
                          ? "bg-zinc-50/40 opacity-65"
                          : "hover:bg-zinc-50/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                            SKU {item.sku}
                          </span>
                          {item.marca && (
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-300">
                              {item.marca}
                            </span>
                          )}
                          {isInStock ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              EN STOCK · NISSEI.COM/PY
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              ✕ SIN STOCK EN WEB
                            </span>
                          )}
                          {hasDiscount && discountPct > 0 && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              -{discountPct}% WEB
                            </span>
                          )}
                          {item.socket && item.socket !== "UNIVERSAL" && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono font-semibold">
                              {item.socket}
                            </span>
                          )}
                          {item.ramType && item.ramType !== "UNIVERSAL" && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono font-semibold">
                              {item.ramType}
                            </span>
                          )}
                          {item.potenciaWatts ? (
                            <span className="text-[9px] text-emerald-700 font-mono font-bold bg-emerald-50 border border-emerald-200 px-1 rounded">
                              {item.potenciaWatts}W
                            </span>
                          ) : null}
                        </div>

                        <h4 className="text-xs font-semibold text-zinc-900 line-clamp-2 leading-relaxed">
                          {item.nombreWeb || item.descripcion}
                        </h4>
                        {item.nombreWeb && item.nombreWeb.toUpperCase() !== item.descripcion.toUpperCase() && (
                          <span className="text-[10px] font-mono text-zinc-400 block truncate">
                            Ref. interna: {item.descripcion}
                          </span>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
                          <span>Garantía: {item.garantiaMeses} meses</span>
                          {item.urlWeb && (
                            <a
                              href={item.urlWeb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold hover:underline"
                            >
                              <span>Ver en nissei.com/py</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {item.hasIGpu === false && (
                            <span className="text-amber-700 font-medium">
                              ⚠️ Requiere placa de video dedicada
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Precios Estrictos de https://nissei.com/py/ y Botón de Selección */}
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          {item.sku === "STOCK-COOLER" ? (
                            <>
                              <span className="text-sm font-extrabold font-mono text-emerald-700 block">
                                BONIFICADO
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 block">
                                Incluido con CPU
                              </span>
                            </>
                          ) : isInStock ? (
                            <>
                              {hasDiscount && (
                                <span className="text-[10px] font-mono text-zinc-400 line-through block">
                                  ₲ {precioRegPyg.toLocaleString("es-PY")}
                                </span>
                              )}
                              {moneda === "PYG" ? (
                                <>
                                  <span className="text-sm font-extrabold font-mono text-zinc-900 block">
                                    ₲ {precioPyg.toLocaleString("es-PY")}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500 block">
                                    US$ {precioUsd.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm font-extrabold font-mono text-zinc-900 block">
                                    US$ {precioUsd.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500 block">
                                    ₲ {precioPyg.toLocaleString("es-PY")}
                                  </span>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-bold font-mono text-rose-700 block">
                                Sin stock web
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 block">
                                No cotizable
                              </span>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!isInStock}
                          onClick={() => handleSelectComponent(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            !isInStock
                              ? "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                              : isSelected
                              ? "bg-zinc-900 text-white shadow-xs cursor-pointer"
                              : "bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 cursor-pointer"
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
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm sticky top-16">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-900 flex items-center gap-2">
                  <span>Presupuesto de PC</span>
                  <span className="text-xs font-mono font-normal text-zinc-500">
                    ({selectedComponents.length} componentes)
                  </span>
                </h3>
                <span className="text-[11px] text-zinc-500 block mt-0.5">
                  {clienteNombre ? `Cliente: ${clienteNombre}` : "Cotización estricta de https://nissei.com/py/"}
                </span>
              </div>

              {/* Estado de Compatibilidad General */}
              <div
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
                  resultadoCompatibilidad.compatible
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800 animate-pulse"
                }`}
              >
                {resultadoCompatibilidad.compatible ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Compatible 100%</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
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
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 flex items-center gap-1 font-sans">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Consumo Estimado:
                </span>
                <span className="font-bold text-zinc-900">
                  {resultadoCompatibilidad.consumoTotalWatts} W
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 font-sans">Fuente Recomendada:</span>
                <span className="font-bold text-zinc-900">
                  {resultadoCompatibilidad.fuenteRecomendadaWatts} W+
                </span>
              </div>
            </div>

            {/* Lista de Componentes Cargados */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {selectedComponents.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                  <p className="text-xs">
                    Ningún componente seleccionado aún. Seleccione componentes con stock activo en{" "}
                    <strong>nissei.com/py</strong> o elija una plantilla rápida.
                  </p>
                </div>
              ) : (
                selectedComponents.map((c) => {
                  const subPyg = (c.precioPyg || 0) * (c.cantidad || 1);
                  const subUsd =
                    tipoCambio > 0 ? Math.round((subPyg / tipoCambio) * 100) / 100 : 0;
                  return (
                    <div
                      key={c.sku}
                      className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-zinc-700 uppercase">
                            {c.categoria}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-400">
                            #{c.sku}
                          </span>
                          <span className="text-[8px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                            WEB OK
                          </span>
                        </div>
                        <h5 className="font-medium text-zinc-900 line-clamp-1 mt-0.5">
                          {c.nombreWeb || c.descripcion}
                        </h5>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                          <span>
                            ₲ {(c.precioPyg || 0).toLocaleString("es-PY")}{" "}
                            {c.cantidad && c.cantidad > 1 ? `x ${c.cantidad}` : ""}
                          </span>
                          <span>·</span>
                          <span>Garantía: {c.garantiaMeses}m</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-zinc-900 block">
                          {moneda === "PYG"
                            ? `₲ ${subPyg.toLocaleString("es-PY")}`
                            : `US$ ${subUsd.toLocaleString("es-PY", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                        </span>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, -1)}
                            className="w-5 h-5 rounded bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-xs flex items-center justify-center cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs px-1 text-zinc-900 font-semibold">
                            {c.cantidad || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleChangeCantidad(c.sku, 1)}
                            className="w-5 h-5 rounded bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-xs flex items-center justify-center cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(c.sku)}
                            className="w-5 h-5 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600 text-xs flex items-center justify-center ml-1 cursor-pointer"
                            title="Quitar componente"
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

            {/* Servicio de Armado & Totales Estrictos Web */}
            <div className="pt-3 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600">Servicio de Montaje &amp; QA:</span>
                <select
                  value={costoMontajePyg}
                  onChange={(e) => setCostoMontajePyg(Number(e.target.value))}
                  className="bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 text-xs text-zinc-900 font-mono outline-none focus:border-zinc-900"
                >
                  <option value={0}>¡Bonificado / GRATIS!</option>
                  <option value={120000}>Básico (₲ 120.000)</option>
                  <option value={200000}>Avanzado + AIO (₲ 200.000)</option>
                  <option value={320000}>Custom Loop / Express (₲ 320.000)</option>
                </select>
              </div>

              {/* Resumen Total Estricto con https://nissei.com/py/ */}
              <div className="p-4 bg-zinc-900 text-white rounded-xl space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-zinc-400">
                    Total Oficial Web (Gs.):
                  </span>
                  <span className="text-2xl font-black font-mono text-white">
                    ₲ {totalPresupuestoPyg.toLocaleString("es-PY")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
                  <span className="text-zinc-400 font-mono">Equivalente en Dólares:</span>
                  <span className="font-mono font-bold text-zinc-200">
                    US${" "}
                    {totalPresupuestoUsd.toLocaleString("es-PY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 block pt-1 font-mono">
                  ✓ Precios exactos de https://nissei.com/py/ · IVA 10% Incluido
                </span>
              </div>

              {/* Botón Convertir en Orden Oficial */}
              <button
                type="button"
                onClick={handleCrearOrdenMontaje}
                disabled={selectedComponents.length === 0}
                className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-black disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Generar Orden de Montaje Oficial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Pie de Página */}
      <footer className="border-t border-zinc-200 bg-white py-3 text-center text-xs text-zinc-500 font-mono">
        NISSEI Tech Service Ops · Cotizador conectado en tiempo real a https://nissei.com/py/
      </footer>
    </main>
  );
}
