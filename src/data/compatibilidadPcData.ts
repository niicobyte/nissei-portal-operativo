// Motor Inteligente de Compatibilidad y Catálogo de Presupuestos de PC - NISSEI Taller de Montajes
import { CATALOGO_MONTAJE_PC, ComponenteMontaje } from "./montajesData";
import catalogoNisseiRaw from "./catalogoNisseiHardware.json";

export type SocketType = "LGA1700" | "LGA1851" | "AM4" | "AM5" | "LGA1200" | "LGA1151" | "UNIVERSAL";
export type MemoryType = "DDR4" | "DDR5" | "UNIVERSAL";
export type FormFactor = "ATX" | "MATX" | "ITX" | "EATX" | "UNIVERSAL";

export interface HardwarePresupuestoItem {
  sku: string;
  marca?: string;
  descripcion: string;
  categoria:
    | "PROCESADOR"
    | "PLACA_MADRE"
    | "RAM"
    | "GPU"
    | "ALMACENAMIENTO"
    | "FUENTE"
    | "GABINETE"
    | "REFRIGERACION"
    | "OTROS";
  precioUsd: number;
  precioPyg?: number;
  precioRegularPyg?: number;
  stockStatus?: "IN_STOCK" | "OUT_OF_STOCK";
  urlWeb?: string;
  nombreWeb?: string;
  verificadoWeb?: boolean;
  socket?: SocketType;
  ramType?: MemoryType;
  tdpWatts?: number;
  hasIGpu?: boolean;
  includesCooler?: boolean;
  isCpuCooler?: boolean;
  esM2Nvme?: boolean;
  capacidadGb?: number;
  formFactor?: FormFactor;
  potenciaWatts?: number;
  recomendadoPsuWatts?: number;
  isKitOficina?: boolean;
  fuenteIncluidaWatts?: number;
  maxRadiatorMm?: number;
  maxMbFormFactor?: FormFactor;
  radiatorSizeMm?: number;
  isAioLiquid?: boolean;
  garantiaMeses: number;
  cantidad?: number;
}

const KNOWN_BRANDS = [
  "AMD", "INTEL", "ASUS", "ASROCK", "GIGABYTE", "MSI", "BIOSTAR", "MAXSUN",
  "CORSAIR", "KINGSTON", "CRUCIAL", "ADATA", "XPG", "PATRIOT", "TEAMGROUP", "LEXAR", "G.SKILL",
  "ZOTAC", "PNY", "PALIT", "SAPPHIRE", "XFX", "POWERCOLOR",
  "WESTERN DIGITAL", "WD", "SEAGATE", "SAMSUNG", "HIKSEMI", "SANDISK", "FTX",
  "COUGAR", "BE QUIET!", "BE QUIET", "THERMALTAKE", "COOLER MASTER", "DEEPCOOL",
  "NZXT", "LIAN LI", "GAMDIAS", "REDRAGON", "AIGO", "DARKFLASH", "SATE", "SATELLITE", "XTECH",
  "EVGA", "SEASONIC", "FSP", "ANTEC", "AEROCOOL", "THERMALRIGHT", "ARCTIC",
];

function detectBrandFromText(upperDesc: string): string | undefined {
  for (const b of KNOWN_BRANDS) {
    if (upperDesc.includes(b)) {
      if (b === "BE QUIET") return "BE QUIET!";
      if (b === "WD") return "WESTERN DIGITAL";
      if (b === "SATELLITE") return "SATE";
      return b;
    }
  }
  return undefined;
}

/**
 * Extrae capacidad en GB (ej. 16GB -> 16, 512GB -> 512, 1TB -> 1000, 2TB -> 2000)
 */
function detectCapacityGb(upperDesc: string): number | undefined {
  const tbMatch = upperDesc.match(/\b(\d+(?:\.\d+)?)\s*TB\b/i);
  if (tbMatch) {
    return Math.round(Number(tbMatch[1]) * 1000);
  }
  const gbMatches = Array.from(upperDesc.matchAll(/\b(\d+)\s*GB\b/gi)).map((m) => Number(m[1]));
  if (gbMatches.length > 0) {
    // Tomar el valor típico de capacidad (evitando números pequeños de caché o VRAM si es SSD)
    return Math.max(...gbMatches);
  }
  return undefined;
}

// Detección automática experta de especificaciones técnicas (Garantía oficial: 3 meses)
export function enriquecerComponente(
  c: ComponenteMontaje & { marca?: string }
): HardwarePresupuestoItem {
  const d = c.descripcion
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .toUpperCase();
  const cat = c.categoria as HardwarePresupuestoItem["categoria"];

  let socket: SocketType | undefined;
  let ramType: MemoryType | undefined;
  let tdpWatts = 0;
  let hasIGpu = true;
  let includesCooler = true;
  let isCpuCooler = false;
  let esM2Nvme = false;
  let capacidadGb = detectCapacityGb(d);
  let formFactor: FormFactor | undefined;
  let potenciaWatts = 0;
  let recomendadoPsuWatts = 500;
  const precioUsd = 0; // Estricto: los precios provienen únicamente de https://nissei.com/py/
  const garantiaMeses = 3; // Garantía oficial de 3 meses
  const marca = c.marca || detectBrandFromText(d);

  // 1. PROCESADORES
  if (cat === "PROCESADOR") {
    // 1.1 Detectar Socket y tipo de memoria RAM
    if (d.includes("1851") || d.includes("ULTRA 5") || d.includes("ULTRA 7") || d.includes("ULTRA 9") || d.includes("CORE ULTRA")) {
      socket = "LGA1851";
      ramType = "DDR5";
      tdpWatts = d.includes("285K") ? 250 : 125;
    } else if (
      d.includes("LGA1200") ||
      d.includes("LGA 1200") ||
      /\b(10100|10100F|10400|10400F|10700|11400|11400F|11700)\b/.test(d)
    ) {
      socket = "LGA1200";
      ramType = "DDR4";
      tdpWatts = 65;
    } else if (
      d.includes("LGA1151") ||
      d.includes("LGA 1151") ||
      /\b(9100|9400|9700|8100|8400|7100|7400)\b/.test(d)
    ) {
      socket = "LGA1151";
      ramType = "DDR4";
      tdpWatts = 65;
    } else if (
      d.includes("LGA1700") ||
      d.includes("LGA 1700") ||
      d.includes("1700") ||
      /\b(12100|12400|12500|12600|12700|12900|13100|13400|13600|13700|13900|14100|14400|14600|14700|14900)[A-Z]*\b/.test(d)
    ) {
      socket = "LGA1700";
      ramType = "UNIVERSAL"; // Soporta placas LGA1700 DDR4 o DDR5
      tdpWatts =
        d.includes("14700") || d.includes("14900") || d.includes("13900") || d.includes("12900")
          ? 220
          : d.includes("12700") || d.includes("12600") || d.includes("13600") || d.includes("14600")
          ? 125
          : 65;
    } else if (
      d.includes("AM5") ||
      /\b(7500F|7600|7600X|7600X3D|7700|7700X|7700X3D|7800X3D|7900|7900X|7900X3D|7950X|7950X3D|8400F|8500G|8600G|8700F|8700G|9600X|9700X|9800X3D|9850X3D|9900X|9900X3D|9950X|9950X3D)\b/.test(d)
    ) {
      socket = "AM5";
      ramType = "DDR5";
      tdpWatts =
        d.includes("9900") || d.includes("9950") || d.includes("9800") || d.includes("9850") || d.includes("7800") || d.includes("7900") || d.includes("7950")
          ? 120
          : d.includes("7700") || d.includes("7600X")
          ? 105
          : 65;
    } else if (
      d.includes("AM4") ||
      /\b(3200G|3400G|3600|4100|4500|4600G|5300G|5500|5600|5600G|5600GE|5600X|5700|5700G|5700X|5700X3D|5800X|5800XT|5800X3D|5900X|5900XT|5950X)\b/.test(d)
    ) {
      socket = "AM4";
      ramType = "DDR4";
      tdpWatts = d.includes("5800") || d.includes("5900") || d.includes("5950") ? 105 : 65;
    }

    // 1.2 Detectar si tiene gráficos integrados (hasIGpu) con precisión quirúrgica
    if (socket === "AM4") {
      // En AM4 SOLO los procesadores terminados en G o GE tienen gráficos integrados Radeon
      hasIGpu = /\b(3000G|3200G|3400G|4300G|4600G|4700G|5300G|5600G|5600GE|5600GT|5700G)\b/.test(d);
    } else if (socket === "AM5") {
      // En AM5 los 7500F, 8400F y 8700F NO tienen gráficos integrados; el resto (7000/9000/8000G) sí tienen RDNA2/RDNA3
      hasIGpu = !/\b(7500F|8400F|8700F)\b/.test(d);
    } else {
      // En Intel (LGA1200, LGA1700, LGA1851), los terminados en F o KF NO tienen gráficos integrados
      hasIGpu = !/\b(\d{3,5}K?F)\b/.test(d);
    }

    // 1.3 Detectar si incluye Cooler de fábrica en la caja
    if (
      d.includes("SIN COOLER") ||
      d.includes("S/COOLER") ||
      d.includes("S/ COOLER") ||
      d.includes("SIN CAJA") ||
      d.includes("S/CAJA") ||
      d.includes("S/ CAJA") ||
      d.includes("BULK") ||
      d.includes("TRAY") ||
      d.includes("WOF") ||
      /\b(12600K|12600KF|12700K|12700KF|12900K|12900KF|13600K|13600KF|13700K|13700KF|13900K|13900KF|14600K|14600KF|14700K|14700KF|14900K|14900KF|245K|245KF|250KF|265K|265KF|285K)\b/.test(d) ||
      /\b(5700X|5700X3D|5800X|5800X3D|5900X|5900XT|5950X|7600X|7600X3D|7700X|7700X3D|7800X3D|7900X|7950X|9600X|9700X|9800X3D|9850X3D|9900X|9900X3D|9950X|9950X3D)\b/.test(d)
    ) {
      includesCooler = false;
    }
  }

  // 2. PLACAS MADRE
  if (cat === "PLACA_MADRE") {
    if (d.includes("E-ATX") || d.includes("EATX")) {
      formFactor = "EATX";
    } else if (d.includes("MINI-ITX") || d.includes("ITX")) {
      formFactor = "MATX";
    } else if (
      d.includes("MICRO ATX") ||
      d.includes("MICRO-ATX") ||
      d.includes("M-ATX") ||
      d.includes("MATX") ||
      /\b[A-Z0-9]+M\b/.test(d)
    ) {
      formFactor = "MATX";
    } else if (d.includes("ATX")) {
      formFactor = "ATX";
    } else {
      formFactor = "MATX";
    }

    if (d.includes("1851") || /\b(H810|B860|Z890)[A-Z0-9-]*\b/.test(d)) {
      socket = "LGA1851";
      ramType = "DDR5";
    } else if (d.includes("LGA 1200") || d.includes("LGA1200") || /\b(H410|B460|Z490|H510|B560|Z590)[A-Z0-9-]*\b/.test(d)) {
      socket = "LGA1200";
      ramType = "DDR4";
    } else if (d.includes("LGA 1151") || d.includes("LGA1151") || /\b(H310|B360|B365|H370|Z390|H110)[A-Z0-9-]*\b/.test(d)) {
      socket = "LGA1151";
      ramType = "DDR4";
    } else if (d.includes("1700") || /\b(H610|B660|H670|Z690|B760|H770|Z790)[A-Z0-9-]*\b/.test(d)) {
      socket = "LGA1700";
      if (d.includes("DDR5") || d.includes("/D5") || d.includes(" D5") || d.includes("-D5")) {
        ramType = "DDR5";
      } else if (d.includes("DDR4") || d.includes("/D4") || d.includes(" D4") || d.includes("-D4") || d.includes("H610")) {
        ramType = "DDR4";
      } else {
        // Las placas B760 / Z790 de nueva generación que no llevan sufijo D4 utilizan DDR5
        ramType = d.includes("Z790") || d.includes("WIFI") ? "DDR5" : "DDR4";
      }
    } else if (
      d.includes("AM5") ||
      /\b(A620|B650|B650E|X670|X670E|B840|B850|X870|X870E)[A-Z0-9-]*\b/.test(d)
    ) {
      socket = "AM5";
      ramType = "DDR5";
    } else if (
      d.includes("AM4") ||
      /\b(A320|B350|X370|B450|X470|A520|B550|X570)[A-Z0-9-]*\b/.test(d)
    ) {
      socket = "AM4";
      ramType = "DDR4";
    }
  }

  // 3. MEMORIA RAM
  if (cat === "RAM") {
    if (d.includes("DDR5") || d.includes("D5") || /\b(4800|5200|5600|6000|6400|6800|7200)\s*MHZ\b/.test(d)) {
      ramType = "DDR5";
    } else {
      ramType = "DDR4";
    }
  }

  // 4. TARJETAS DE VIDEO (GPU)
  if (cat === "GPU") {
    if (d.includes("5090") || d.includes("4090")) { tdpWatts = 450; recomendadoPsuWatts = 1000; }
    else if (d.includes("5080") || d.includes("4080") || d.includes("7900 XTX")) { tdpWatts = 320; recomendadoPsuWatts = 850; }
    else if (d.includes("5070 TI") || d.includes("4070 TI") || d.includes("9070 XT") || d.includes("7900 XT")) { tdpWatts = 285; recomendadoPsuWatts = 750; }
    else if (d.includes("5070") || d.includes("4070") || d.includes("7800 XT") || d.includes("9070")) { tdpWatts = 230; recomendadoPsuWatts = 700; }
    else if (d.includes("5060 TI") || d.includes("4060 TI") || d.includes("7700 XT") || d.includes("9060 XT") || d.includes("6750")) { tdpWatts = 180; recomendadoPsuWatts = 650; }
    else if (d.includes("5060") || d.includes("4060") || d.includes("3060") || d.includes("7600") || d.includes("6600") || d.includes("B580")) { tdpWatts = 150; recomendadoPsuWatts = 550; }
    else if (d.includes("5050") || d.includes("3050") || d.includes("6500") || d.includes("1650") || d.includes("RX 580") || d.includes("RX580")) { tdpWatts = 120; recomendadoPsuWatts = 500; }
    else { tdpWatts = 150; recomendadoPsuWatts = 550; }
  }

  // 5. ALMACENAMIENTO (SSD / HDD)
  if (cat === "ALMACENAMIENTO") {
    esM2Nvme =
      d.includes("M.2") ||
      d.includes("NVME") ||
      d.includes("PCIE") ||
      d.includes("PCI-E") ||
      d.includes("GEN4") ||
      d.includes("GEN3") ||
      d.includes("GEN5");
  }

  // 6. FUENTES DE PODER
  if (cat === "FUENTE") {
    const matchW = d.match(/\b(1600|1300|1200|1050|1000|900|850|800|750|700|650|600|550|500|450|400)\s*W\b/);
    if (matchW) {
      potenciaWatts = Number(matchW[1]);
    } else {
      potenciaWatts = 0; // Si no especifica watts reales, no asumir 500W
    }
  }

  // 7. GABINETES
  let isKitOficina = false;
  let fuenteIncluidaWatts = 0;
  let maxRadiatorMm = 360;
  let maxMbFormFactor: FormFactor = "ATX";

  if (cat === "GABINETE") {
    const esKit =
      d.includes("KIT") ||
      d.includes("TEC.ESP") ||
      d.includes("TEC.POR") ||
      d.includes("TECLADO") ||
      d.includes("SPEAKER") ||
      /\b(K701|K731|K761|MKT2802)\b/.test(d);

    if (esKit) {
      isKitOficina = true;
      maxRadiatorMm = 0; // Cero soporte para refrigeración líquida
      maxMbFormFactor = d.includes("ITX") && !d.includes("ATX") ? "MATX" : "ATX";
      const matchW = d.match(/FUENTE\s*(?:\((\d+)\s*W\)?|(\d+)\s*W)/i) || d.match(/(\d+)\s*W/i);
      if (matchW) {
        fuenteIncluidaWatts = Number(matchW[1] || matchW[2]);
      } else {
        fuenteIncluidaWatts = 200;
      }
      formFactor = "ATX";
    } else {
      if (d.includes("E-ATX") || d.includes("EATX")) {
        maxMbFormFactor = "EATX";
        formFactor = "EATX";
      } else if (
        (d.includes("MINI-ITX") || d.includes("ITX")) &&
        !d.includes("ATX")
      ) {
        maxMbFormFactor = "ITX";
        formFactor = "MATX";
      } else if (
        d.includes("M-ATX") ||
        d.includes("MATX") ||
        d.includes("MICRO ATX") ||
        d.includes("MICRO TOWER") ||
        d.includes("MINI TOWER")
      ) {
        if (!d.includes("ATX/") && !d.includes("MID TOWER") && !d.includes("/ATX")) {
          maxMbFormFactor = "MATX";
          formFactor = "MATX";
        } else {
          maxMbFormFactor = "ATX";
          formFactor = "ATX";
        }
      } else {
        maxMbFormFactor = "ATX";
        formFactor = "ATX";
      }

      const esCompactoSin360 =
        d.includes("PURITY") ||
        d.includes("MB311L") ||
        d.includes("Q300L") ||
        d.includes("MX110") ||
        d.includes("CFV-235") ||
        d.includes("DUST 2") ||
        d.includes("1100K") ||
        d.includes("1101K") ||
        d.includes("1102K") ||
        d.includes("1103K") ||
        d.includes("1300K") ||
        d.includes("K8502") ||
        d.includes("ATHENA M4M") ||
        d.includes("AURA GC10M") ||
        d.includes("D300") ||
        d.includes("TK-1") ||
        d.includes("T6") ||
        d.includes("T7") ||
        d.includes("N2") ||
        d.includes("V12") ||
        d.includes("BO400") ||
        d.includes("MCG-IB4500") ||
        (maxMbFormFactor === "MATX" && !d.includes("A3-MATX")) ||
        maxMbFormFactor === "ITX";

      if (esCompactoSin360) {
        maxRadiatorMm = 240;
      } else {
        maxRadiatorMm = 360;
      }
    }
  }

  // 8. REFRIGERACIÓN
  let radiatorSizeMm = 0;
  let isAioLiquid = false;

  if (cat === "REFRIGERACION") {
    socket = "UNIVERSAL";
    isAioLiquid =
      d.includes("WATER") ||
      d.includes("LIQUIDO") ||
      d.includes("LÍQUIDO") ||
      d.includes("LIQUID") ||
      d.includes("AIO") ||
      d.includes("PURE LOOP") ||
      d.includes("LIGHT LOOP") ||
      d.includes("SILENT LOOP") ||
      d.includes("AURA GL") ||
      d.includes("CHIONE");

    if (d.includes("360MM") || d.includes("360 MM") || /\b360\b/.test(d)) {
      radiatorSizeMm = 360;
      isAioLiquid = true;
    } else if (d.includes("240MM") || d.includes("240 MM") || /\b240\b/.test(d)) {
      radiatorSizeMm = 240;
      isAioLiquid = true;
    } else if (d.includes("280MM") || d.includes("280 MM") || /\b280\b/.test(d)) {
      radiatorSizeMm = 280;
      isAioLiquid = true;
    } else if (d.includes("120MM") || d.includes("120 MM") || /\b120\b/.test(d)) {
      radiatorSizeMm = 120;
      isAioLiquid = true;
    } else if (d.includes("420MM") || d.includes("420 MM") || /\b420\b/.test(d)) {
      radiatorSizeMm = 420;
      isAioLiquid = true;
    }

    isCpuCooler =
      isAioLiquid ||
      d.includes("PARA CPU") ||
      d.includes("P/ CPU") ||
      d.includes("P/CPU") ||
      d.includes("CPU COOLER") ||
      d.includes("COOLER CPU") ||
      d.includes("ASSASSIN") ||
      d.includes("PURE ROCK") ||
      d.includes("DARK ROCK") ||
      d.includes("AK400") ||
      d.includes("AK500") ||
      d.includes("AK620") ||
      d.includes("AG400") ||
      d.includes("FROZN") ||
      d.includes("PEERLESS") ||
      d.includes("PHANTOM SPIRIT") ||
      d.includes("THERMALRIGHT") ||
      d.includes("DISIPADOR");
  }

  return {
    sku: c.sku,
    marca,
    descripcion: c.descripcion,
    categoria: cat,
    precioUsd,
    socket,
    ramType,
    tdpWatts,
    hasIGpu,
    includesCooler,
    isCpuCooler,
    esM2Nvme,
    capacidadGb,
    formFactor,
    potenciaWatts,
    recomendadoPsuWatts,
    isKitOficina,
    fuenteIncluidaWatts,
    maxRadiatorMm,
    maxMbFormFactor,
    radiatorSizeMm,
    isAioLiquid,
    garantiaMeses,
    cantidad: 1,
  };
}

// Catálogo base enriquecido a partir de la base de datos oficial de NISSEI y CATALOGO_MONTAJE_PC
const skusNissei = new Set((catalogoNisseiRaw as HardwarePresupuestoItem[]).map((i) => i.sku));
const montajesAdicionales = CATALOGO_MONTAJE_PC
  .filter((c) => !skusNissei.has(c.sku))
  .map(enriquecerComponente);

export const CATALOGO_PRESUPUESTO_OFICIAL: HardwarePresupuestoItem[] = [
  ...(catalogoNisseiRaw as unknown as HardwarePresupuestoItem[]).map((item) => ({
    ...item,
    garantiaMeses: 3,
  })),
  ...montajesAdicionales,
  // Cooler stock estándar (incluido en caja con procesadores que traen cooler de fábrica)
  {
    sku: "STOCK-COOLER",
    marca: "ORIGINAL",
    descripcion: "COOLER DE FÁBRICA / STOCK (INCLUIDO CON PROCESADOR)",
    categoria: "REFRIGERACION",
    precioUsd: 0,
    precioPyg: 0,
    stockStatus: "IN_STOCK",
    verificadoWeb: true,
    isCpuCooler: true,
    socket: "UNIVERSAL",
    garantiaMeses: 3,
    cantidad: 1,
  },
];

// Reglas de compatibilidad en tiempo real y detección defensiva contra errores de venta
export type AlertaTipo = "ERROR" | "WARNING" | "INFO" | "SUGGESTION";

export interface AlertaCompatibilidad {
  tipo: AlertaTipo;
  titulo: string;
  detalle: string;
  categoriaTarget?: HardwarePresupuestoItem["categoria"];
  accionSugerida?: string;
  accionTipo?: "CAMBIAR_TAB" | "DUPLICAR_RAM" | "AGREGAR_COOLER";
}

export interface ChecklistPC {
  cpu: boolean;
  mb: boolean;
  ram: boolean;
  storage: boolean;
  gpu: boolean; // tiene tarjeta gráfica o procesador con iGPU
  psu: boolean;
  gabinete: boolean;
  cooler: boolean;
}

export interface ResultadoCompatibilidad {
  compatible: boolean;
  alertas: AlertaCompatibilidad[];
  consumoTotalWatts: number;
  fuenteRecomendadaWatts: number;
  tieneVideo: boolean;
  checklist: ChecklistPC;
  totalErrores: number;
  totalWarnings: number;
  totalSugerencias: number;
  porcentajeCompletitud: number;
}

export function verificarCompatibilidadPC(
  items: HardwarePresupuestoItem[]
): ResultadoCompatibilidad {
  const alertas: AlertaCompatibilidad[] = [];

  const cpu = items.find((i) => i.categoria === "PROCESADOR");
  const mb = items.find((i) => i.categoria === "PLACA_MADRE");
  const rams = items.filter((i) => i.categoria === "RAM");
  const gpus = items.filter((i) => i.categoria === "GPU");
  const psu = items.find((i) => i.categoria === "FUENTE");
  const gabinete = items.find((i) => i.categoria === "GABINETE");
  const cooler = items.find((i) => i.categoria === "REFRIGERACION");
  const ssds = items.filter((i) => i.categoria === "ALMACENAMIENTO");

  // =========================================================================
  // 1. COMPATIBILIDAD CRÍTICA DE SOCKET (CPU vs PLACA MADRE)
  // =========================================================================
  if (cpu && mb) {
    if (cpu.socket && mb.socket && cpu.socket !== "UNIVERSAL" && mb.socket !== "UNIVERSAL") {
      if (cpu.socket !== mb.socket) {
        alertas.push({
          tipo: "ERROR",
          titulo: "Incompatibilidad Crítica de Socket (CPU vs Placa Madre)",
          detalle: `El procesador requiere socket ${cpu.socket}, pero la placa madre tiene socket ${mb.socket}. Físicamente no pueden ensamblarse.`,
          categoriaTarget: "PLACA_MADRE",
          accionSugerida: `Ver placas madre con socket ${cpu.socket}`,
          accionTipo: "CAMBIAR_TAB",
        });
      }
    }
  }

  // =========================================================================
  // 2. COMPATIBILIDAD CRÍTICA DE MEMORIA RAM (DDR4 vs DDR5)
  // =========================================================================
  if (rams.length > 0) {
    const requiredRam =
      mb?.ramType && mb.ramType !== "UNIVERSAL"
        ? mb.ramType
        : cpu?.ramType && cpu.ramType !== "UNIVERSAL"
        ? cpu.ramType
        : undefined;

    if (requiredRam) {
      for (const r of rams) {
        if (r.ramType && r.ramType !== "UNIVERSAL" && r.ramType !== requiredRam) {
          alertas.push({
            tipo: "ERROR",
            titulo: "Incompatibilidad de Generación de RAM (DDR4 vs DDR5)",
            detalle: `La plataforma requiere memoria ${requiredRam}, pero el módulo elegido (${r.nombreWeb || r.descripcion}) es ${r.ramType}. La ranura física es diferente y no encajará.`,
            categoriaTarget: "RAM",
            accionSugerida: `Ver memorias RAM ${requiredRam}`,
            accionTipo: "CAMBIAR_TAB",
          });
          break;
        }
      }
    }

    // Verificar si se mezclaron tipos de RAM
    const hasDdr4 = rams.some((r) => r.ramType === "DDR4");
    const hasDdr5 = rams.some((r) => r.ramType === "DDR5");
    if (hasDdr4 && hasDdr5) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Mezcla de Tecnologías de RAM Incompatible",
        detalle: "Se han agregado módulos DDR4 y DDR5 al mismo tiempo. Una placa madre solo admite una tecnología de memoria.",
        categoriaTarget: "RAM",
        accionSugerida: "Homogeneizar tipo de memoria RAM",
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 3. SALIDA DE VIDEO OBLIGATORIA (ERROR CLÁSICO DE VENTA)
  // =========================================================================
  let tieneVideo = false;
  if (gpus.length > 0) {
    tieneVideo = true;
  } else if (cpu && cpu.hasIGpu !== false) {
    tieneVideo = true;
  } else if (cpu && cpu.hasIGpu === false) {
    alertas.push({
      tipo: "ERROR",
      titulo: "PC Sin Salida de Video (Error Crítico de Venta)",
      detalle: `El procesador (${cpu.nombreWeb || cpu.descripcion}) NO posee gráficos integrados. Es OBLIGATORIO agregar una Placa de Video (GPU); de lo contrario, la computadora no dará imagen.`,
      categoriaTarget: "GPU",
      accionSugerida: "Ver Placas de Video compatibles",
      accionTipo: "CAMBIAR_TAB",
    });
  }

  // =========================================================================
  // 4. VERIFICACIÓN DE REFRIGERACIÓN Y COOLER DE CPU
  // =========================================================================
  if (cpu) {
    if (cpu.includesCooler === false) {
      if (!cooler || cooler.sku === "STOCK-COOLER") {
        alertas.push({
          tipo: "ERROR",
          titulo: "Procesador vendido SIN Cooler de Fábrica (Riesgo Térmico)",
          detalle: `El procesador (${cpu.nombreWeb || cpu.descripcion}) viene de fábrica sin disipador en caja. Es obligatorio cotizar un Cooler por aire o Líquida AIO para que el equipo pueda encender sin sobrecalentarse.`,
          categoriaTarget: "REFRIGERACION",
          accionSugerida: "Ver Coolers de CPU / AIO",
          accionTipo: "CAMBIAR_TAB",
        });
      } else if (cooler.isCpuCooler === false) {
        alertas.push({
          tipo: "ERROR",
          titulo: "Ventilador de Gabinete en lugar de Cooler de CPU",
          detalle: `Se seleccionó un ventilador de chasis (${cooler.nombreWeb || cooler.descripcion}), pero este procesador requiere un disipador térmico para socket ${cpu.socket || "CPU"}.`,
          categoriaTarget: "REFRIGERACION",
          accionSugerida: "Ver Coolers para CPU",
          accionTipo: "CAMBIAR_TAB",
        });
      }
    }
  }

  // =========================================================================
  // 5. CONSUMO ELÉCTRICO Y FUENTE DE PODER
  // =========================================================================
  const cpuWatts = cpu?.tdpWatts || 65;
  const gpuWatts = gpus.reduce((acc, g) => acc + (g.tdpWatts || 150), 0);
  const baseWatts = 60; // Placa madre + RAMs + SSDs + Fans
  const consumoTotalWatts = cpuWatts + gpuWatts + baseWatts;

  const fuenteRecomendadaWatts = Math.max(
    Math.ceil((consumoTotalWatts * 1.3) / 50) * 50,
    gpus[0]?.recomendadoPsuWatts || 500
  );

  if (psu) {
    const psuPotencia = psu.potenciaWatts || 0;
    if (psuPotencia < consumoTotalWatts) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Potencia de Fuente Insuficiente (Riesgo de Apagado)",
        detalle: `La fuente seleccionada (${psuPotencia}W) no cubre la demanda eléctrica del equipo (${consumoTotalWatts}W). Seleccione una fuente ATX de al menos ${fuenteRecomendadaWatts}W.`,
        categoriaTarget: "FUENTE",
        accionSugerida: `Ver Fuentes de ${fuenteRecomendadaWatts}W+`,
        accionTipo: "CAMBIAR_TAB",
      });
    } else if (psuPotencia < fuenteRecomendadaWatts) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Margen de Fuente Ajustado para Picos de Carga",
        detalle: `La fuente (${psuPotencia}W) cubre el consumo nominal (${consumoTotalWatts}W), pero para picos de exigencia en juegos o render se recomienda ${fuenteRecomendadaWatts}W+.`,
        categoriaTarget: "FUENTE",
        accionSugerida: `Ver Fuentes de ${fuenteRecomendadaWatts}W+`,
        accionTipo: "CAMBIAR_TAB",
      });
    }
  } else if (gabinete && gabinete.isKitOficina && gabinete.fuenteIncluidaWatts) {
    // Si no seleccionó fuente independiente pero tiene un gabinete kit con fuente integrada (ej. 200W)
    if (gpus.length > 0) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Fuente de Kit Insuficiente para Placa de Video Dedicada",
        detalle: `El gabinete kit (${gabinete.nombreWeb || gabinete.descripcion}) incluye una fuente genérica de ${gabinete.fuenteIncluidaWatts}W sin conectores PCIe de 6 u 8 pines. La placa de video (${gpus[0].nombreWeb || gpus[0].descripcion}) requiere alimentación dedicada y una fuente certificada de al menos ${fuenteRecomendadaWatts}W. Debe agregar una fuente ATX certificada.`,
        categoriaTarget: "FUENTE",
        accionSugerida: `Ver Fuentes de ${fuenteRecomendadaWatts}W+`,
        accionTipo: "CAMBIAR_TAB",
      });
    } else if (consumoTotalWatts > gabinete.fuenteIncluidaWatts) {
      alertas.push({
        tipo: "ERROR",
        titulo: `Consumo del Equipo (${consumoTotalWatts}W) Supera la Fuente del Kit (${gabinete.fuenteIncluidaWatts}W)`,
        detalle: `El consumo estimado (${consumoTotalWatts}W) supera la capacidad máxima de la fuente de ${gabinete.fuenteIncluidaWatts}W incluida en el kit. Riesgo inminente de sobrecalentamiento, apagado o daño eléctrico. Se requiere una fuente ATX de al menos ${fuenteRecomendadaWatts}W.`,
        categoriaTarget: "FUENTE",
        accionSugerida: `Ver Fuentes de ${fuenteRecomendadaWatts}W+`,
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 6. BALANCE TÉRMICO / VRM THROTTLING (CPU GAMA ALTA vs PLACA BÁSICA)
  // =========================================================================
  if (cpu && mb) {
    const descCpu = (cpu.nombreWeb || cpu.descripcion).toUpperCase();
    const descMb = (mb.nombreWeb || mb.descripcion).toUpperCase();

    const esCpuGamaAlta =
      descCpu.includes("I7") ||
      descCpu.includes("I9") ||
      descCpu.includes("RYZEN 9") ||
      descCpu.includes("7800X3D") ||
      descCpu.includes("9800X3D") ||
      descCpu.includes("ULTRA 7") ||
      descCpu.includes("ULTRA 9");

    const esPlacaEntrada =
      descMb.includes("H610") ||
      descMb.includes("H510") ||
      descMb.includes("H410") ||
      descMb.includes("H810") ||
      descMb.includes("A520") ||
      descMb.includes("A320") ||
      descMb.includes("A620M-HDV") ||
      descMb.includes("A620M-E");

    if (esCpuGamaAlta && esPlacaEntrada) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Desbalance de Placa Madre (VRM Throttling)",
        detalle: `Este procesador de alto consumo sobrecalentará las fases de poder (VRMs) de una placa madre básica de entrada, provocando caídas de FPS por limitación térmica. Se sugiere cotizar una placa chipset B o Z (B760 / B650 / Z790) con disipador en VRMs.`,
        categoriaTarget: "PLACA_MADRE",
        accionSugerida: "Ver Placas con disipador en VRM",
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 7. DESBALANCE DE CUELLO DE BOTELLA (CPU vs GPU DE ALTO RENDIMIENTO)
  // =========================================================================
  if (cpu && gpus.length > 0) {
    const gpu = gpus[0];
    const descGpu = (gpu.nombreWeb || gpu.descripcion).toUpperCase();
    const descCpu = (cpu.nombreWeb || cpu.descripcion).toUpperCase();

    const esGpuMuyPotente =
      descGpu.includes("4070") ||
      descGpu.includes("4080") ||
      descGpu.includes("4090") ||
      descGpu.includes("5070") ||
      descGpu.includes("5080") ||
      descGpu.includes("5090") ||
      descGpu.includes("3080") ||
      descGpu.includes("7800 XT") ||
      descGpu.includes("7900");

    const esCpuGamaBaja =
      descCpu.includes("I3") ||
      descCpu.includes("10100") ||
      descCpu.includes("12100") ||
      descCpu.includes("14100") ||
      descCpu.includes("RYZEN 3") ||
      descCpu.includes("3200G") ||
      descCpu.includes("4500");

    if (esGpuMuyPotente && esCpuGamaBaja) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Cuello de Botella Severo (CPU Limitando a la GPU)",
        detalle: `La placa de video de alto rendimiento (${gpu.nombreWeb || gpu.descripcion}) estará severamente limitada por el procesador ${cpu.nombreWeb || cpu.descripcion}. Para aprovechar los FPS al 100%, se recomienda subir a un Core i5 13ª/14ª Gen o Ryzen 5 7600/7700.`,
        categoriaTarget: "PROCESADOR",
        accionSugerida: "Ver Procesadores recomendados",
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 8. SUGERENCIA PRO: DUAL CHANNEL EN MEMORIA RAM
  // =========================================================================
  if (rams.length > 0) {
    const totalModulos = rams.reduce((acc, r) => acc + (r.cantidad || 1), 0);
    if (totalModulos === 1) {
      const ram = rams[0];
      alertas.push({
        tipo: "SUGGESTION",
        titulo: "💡 Oportunidad de Venta: Activar Dual Channel en RAM",
        detalle: `Cotizar 2 módulos activa la tecnología Dual Channel, incrementando entre un +15% y +25% los FPS en juegos y la fluidez del equipo prácticamente sin diferencia de precio.`,
        categoriaTarget: "RAM",
        accionSugerida: `Duplicar a 2 módulos (Activar Dual Channel)`,
        accionTipo: "DUPLICAR_RAM",
      });
    }
  }

  // =========================================================================
  // 9. SUGERENCIA PRO: CAPACIDAD DE ALMACENAMIENTO SSD
  // =========================================================================
  if (ssds.length > 0 && gpus.length > 0) {
    const totalCapacidad = ssds.reduce((acc, s) => acc + (s.capacidadGb || 0), 0);
    if (totalCapacidad > 0 && totalCapacidad < 480) {
      alertas.push({
        tipo: "SUGGESTION",
        titulo: "💡 Almacenamiento Ajustado para Juegos Actuales",
        detalle: `240GB se saturan rápidamente (Windows y utilitarios ocupan ~50GB, y los juegos modernos pesan de 70GB a 150GB c/u). Se recomienda sugerir un SSD M.2 NVMe de 500GB o 1TB.`,
        categoriaTarget: "ALMACENAMIENTO",
        accionSugerida: "Ver SSDs de 500GB / 1TB",
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 10. SUGERENCIA PRO: REFRIGERACIÓN LÍQUIDA PARA CPUS CALIENTES
  // =========================================================================
  if (cpu) {
    const descCpu = (cpu.nombreWeb || cpu.descripcion).toUpperCase();
    const esCpuMuyCaliente =
      (cpu.tdpWatts || 0) >= 120 ||
      descCpu.includes("14700") ||
      descCpu.includes("13700") ||
      descCpu.includes("14900") ||
      descCpu.includes("13900") ||
      descCpu.includes("7800X3D") ||
      descCpu.includes("9800X3D") ||
      descCpu.includes("7900X") ||
      descCpu.includes("7950X");

    if (esCpuMuyCaliente) {
      const esAioLiquid = cooler && (/240|360|LIQUID|WATER|AIO/i.test(cooler.descripcion) || /240|360|LIQUID|WATER|AIO/i.test(cooler.nombreWeb || ""));
      if (!esAioLiquid) {
        alertas.push({
          tipo: "SUGGESTION",
          titulo: "💡 Refrigeración Líquida AIO Recomendada",
          detalle: `Este procesador trabaja a temperaturas elevadas bajo carga plena. Una Refrigeración Líquida AIO de 240mm o 360mm mantendrá el equipo en temperaturas óptimas y totalmente silencioso.`,
          categoriaTarget: "REFRIGERACION",
          accionSugerida: "Ver Water Coolers AIO",
          accionTipo: "CAMBIAR_TAB",
        });
      }
    }
  }

  // =========================================================================
  // 11. INCOMPATIBILIDAD FÍSICA: COOLER / WATER COOLER vs GABINETE
  // =========================================================================
  if (cooler && cooler.sku !== "STOCK-COOLER" && gabinete) {
    const coolerDesc = cooler.nombreWeb || cooler.descripcion;
    const gabineteDesc = gabinete.nombreWeb || gabinete.descripcion;
    const isLiquid = Boolean(cooler.isAioLiquid || /WATER|LIQUID|L[IÍ]QUIDO|AIO|360|240/i.test(coolerDesc));
    const is360 = Boolean(cooler.radiatorSizeMm === 360 || /360\s*MM|\b360\b/i.test(coolerDesc));
    const is240 = Boolean(cooler.radiatorSizeMm === 240 || /240\s*MM|\b240\b/i.test(coolerDesc));

    // Caso A: Refrigeración Líquida (AIO) en Gabinete Kit de Oficina
    if (isLiquid && gabinete.isKitOficina) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Incompatibilidad Física Absoluta: Cooler Líquido en Gabinete Kit de Oficina",
        detalle: `El ${coolerDesc} es una refrigeración líquida que requiere anclajes para radiador (${is360 ? "360mm" : is240 ? "240mm" : "AIO"}). El gabinete (${gabineteDesc}) es un kit básico de oficina cerrado sin espacio ni rejillas para radiadores de agua. Debe cambiar a un Gabinete Gamer Mid-Tower con soporte de refrigeración líquida o usar un cooler de aire convencional.`,
        categoriaTarget: "GABINETE",
        accionSugerida: "Cambiar a Gabinete Gamer Compatible",
        accionTipo: "CAMBIAR_TAB",
      });
    }
    // Caso B: Radiador de 360mm en Gabinete que no admite 360mm
    else if (is360 && (gabinete.maxRadiatorMm !== undefined && gabinete.maxRadiatorMm < 360)) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Incompatibilidad Física: Radiador de 360mm No Cabe en este Gabinete",
        detalle: `El Cooler Líquido (${coolerDesc}) posee un radiador de 360mm (~40 cm de largo con 3 ventiladores de 120mm) que no entra físicamente en el gabinete (${gabineteDesc}). Este gabinete solo admite coolers de aire o radiadores de hasta 240mm. Seleccione un gabinete Mid-Tower amplio o Full-Tower con soporte de 360mm (ej: Cougar MX600 / Airface Pro, Lian Li Lancool / O11, Corsair 4000D/5000D, Satellite K880/K896/K904).`,
        categoriaTarget: "GABINETE",
        accionSugerida: "Ver Gabinetes con Soporte 360mm",
        accionTipo: "CAMBIAR_TAB",
      });
    }
    // Caso C: Radiador de 240mm en Gabinete sin soporte de radiador
    else if (is240 && gabinete.maxRadiatorMm === 0) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Incompatibilidad Física: Radiador de 240mm No Compatible con Gabinete",
        detalle: `El gabinete seleccionado (${gabineteDesc}) no admite la instalación del radiador de 240mm del ${coolerDesc}.`,
        categoriaTarget: "GABINETE",
        accionSugerida: "Ver Gabinetes Compatibles",
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 12. INCOMPATIBILIDAD FÍSICA: PLACA MADRE vs GABINETE (FACTOR DE FORMA)
  // =========================================================================
  if (mb && gabinete) {
    const mbDesc = mb.nombreWeb || mb.descripcion;
    const gabineteDesc = gabinete.nombreWeb || gabinete.descripcion;
    if (mb.formFactor === "ATX" && (gabinete.maxMbFormFactor === "MATX" || gabinete.maxMbFormFactor === "ITX")) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Incompatibilidad de Tamaño: Placa Madre ATX en Gabinete Micro-ATX / ITX",
        detalle: `La placa madre (${mbDesc}) es de tamaño ATX estándar (305x244 mm) y no cabe físicamente dentro del gabinete (${gabineteDesc}), que solo admite placas compactas Micro-ATX o Mini-ITX. Debe cambiar a una Placa Micro-ATX o a un Gabinete compatible con ATX.`,
        categoriaTarget: "GABINETE",
        accionSugerida: "Ver Gabinetes ATX",
        accionTipo: "CAMBIAR_TAB",
      });
    } else if (mb.formFactor === "EATX" && gabinete.maxMbFormFactor !== "EATX") {
      alertas.push({
        tipo: "ERROR",
        titulo: "Placa Madre E-ATX Requiere Gabinete Full-Tower E-ATX",
        detalle: `La placa madre (${mbDesc}) es de formato extendido E-ATX y requiere un gabinete espacioso certificado para E-ATX.`,
        categoriaTarget: "GABINETE",
        accionSugerida: "Ver Gabinetes E-ATX",
        accionTipo: "CAMBIAR_TAB",
      });
    }
  }

  // =========================================================================
  // 13. CHECKLIST DE COMPLETITUD DE LA COMPUTADORA
  // =========================================================================
  const tienePsuAdecuada = Boolean(
    psu ||
    (gabinete?.isKitOficina &&
     gabinete.fuenteIncluidaWatts &&
     gpus.length === 0 &&
     consumoTotalWatts <= gabinete.fuenteIncluidaWatts)
  );

  const checklist: ChecklistPC = {
    cpu: Boolean(cpu),
    mb: Boolean(mb),
    ram: rams.length > 0,
    storage: ssds.length > 0,
    gpu: tieneVideo,
    psu: tienePsuAdecuada,
    gabinete: Boolean(gabinete),
    cooler: Boolean(cooler || (cpu && cpu.includesCooler)),
  };

  const checksKeys = Object.keys(checklist) as Array<keyof ChecklistPC>;
  const completados = checksKeys.filter((k) => checklist[k]).length;
  const porcentajeCompletitud = Math.round((completados / checksKeys.length) * 100);

  const totalErrores = alertas.filter((a) => a.tipo === "ERROR").length;
  const totalWarnings = alertas.filter((a) => a.tipo === "WARNING").length;
  const totalSugerencias = alertas.filter((a) => a.tipo === "SUGGESTION").length;

  return {
    compatible: totalErrores === 0,
    alertas,
    consumoTotalWatts,
    fuenteRecomendadaWatts,
    tieneVideo,
    checklist,
    totalErrores,
    totalWarnings,
    totalSugerencias,
    porcentajeCompletitud,
  };
}

// Tipo de cambio referencial (USD a Guaraníes)
export const TIPO_CAMBIO_PYG_DEFECTO = 7850;
