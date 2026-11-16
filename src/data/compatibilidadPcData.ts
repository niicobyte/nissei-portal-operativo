// Motor Inteligente de Compatibilidad y Catálogo de Presupuestos de PC - NISSEI Taller de Montajes
import { CATALOGO_MONTAJE_PC, ComponenteMontaje } from "./montajesData";
import catalogoNisseiRaw from "./catalogoNisseiHardware.json";

export type SocketType = "LGA1700" | "LGA1851" | "AM4" | "AM5" | "LGA1200" | "LGA1151" | "UNIVERSAL";
export type MemoryType = "DDR4" | "DDR5" | "UNIVERSAL";
export type FormFactor = "ATX" | "MATX" | "EATX" | "UNIVERSAL";

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
    formFactor = d.includes("E-ATX") || d.includes("EATX") ? "EATX" : d.includes("/ATX") || d.includes(" ATX") ? "ATX" : "MATX";

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
  if (cat === "GABINETE") {
    formFactor = "ATX";
  }

  // 8. REFRIGERACIÓN
  if (cat === "REFRIGERACION") {
    socket = "UNIVERSAL";
    // Distinguir un verdadero Cooler de Procesador (Aire o Líquido AIO) de un simple ventilador de gabinete
    isCpuCooler =
      d.includes("PARA CPU") ||
      d.includes("P/ CPU") ||
      d.includes("P/CPU") ||
      d.includes("CPU COOLER") ||
      d.includes("COOLER CPU") ||
      d.includes("WATER") ||
      d.includes("LIQUIDO") ||
      d.includes("LÍQUIDO") ||
      d.includes("LIQUID") ||
      d.includes("AIO") ||
      d.includes("240MM") ||
      d.includes("240 MM") ||
      d.includes("360MM") ||
      d.includes("360 MM") ||
      d.includes("ASSASSIN") ||
      d.includes("PURE ROCK") ||
      d.includes("DARK ROCK") ||
      d.includes("PURE LOOP") ||
      d.includes("LIGHT LOOP") ||
      d.includes("SILENT LOOP") ||
      d.includes("AK400") ||
      d.includes("AK500") ||
      d.includes("AK620") ||
      d.includes("AG400") ||
      d.includes("AURA GL") ||
      d.includes("CHIONE");
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

// Reglas de compatibilidad en tiempo real
export interface ResultadoCompatibilidad {
  compatible: boolean;
  alertas: Array<{
    tipo: "ERROR" | "WARNING" | "INFO";
    titulo: string;
    detalle: string;
  }>;
  consumoTotalWatts: number;
  fuenteRecomendadaWatts: number;
  tieneVideo: boolean;
}

export function verificarCompatibilidadPC(
  items: HardwarePresupuestoItem[]
): ResultadoCompatibilidad {
  const alertas: ResultadoCompatibilidad["alertas"] = [];

  const cpu = items.find((i) => i.categoria === "PROCESADOR");
  const mb = items.find((i) => i.categoria === "PLACA_MADRE");
  const rams = items.filter((i) => i.categoria === "RAM");
  const gpus = items.filter((i) => i.categoria === "GPU");
  const psu = items.find((i) => i.categoria === "FUENTE");
  const gabinete = items.find((i) => i.categoria === "GABINETE");
  const cooler = items.find((i) => i.categoria === "REFRIGERACION");

  // 1. Socket CPU vs Placa Madre
  if (cpu && mb) {
    if (cpu.socket && mb.socket && cpu.socket !== "UNIVERSAL" && mb.socket !== "UNIVERSAL") {
      if (cpu.socket !== mb.socket) {
        alertas.push({
          tipo: "ERROR",
          titulo: "Incompatibilidad de Socket",
          detalle: `El procesador requiere socket ${cpu.socket}, pero la placa madre tiene socket ${mb.socket}. No podrán ensamblarse físicamente.`,
        });
      }
    }
  }

  // 2. RAM vs Placa Madre / Procesador
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
            titulo: "Incompatibilidad de Memoria RAM",
            detalle: `La plataforma seleccionada requiere memoria ${requiredRam}, pero el módulo elegido (${r.nombreWeb || r.descripcion}) es ${r.ramType}.`,
          });
          break;
        }
      }
    }
  }

  // 3. Tarjeta de Video / Gráficos Integrados
  let tieneVideo = false;
  if (gpus.length > 0) {
    tieneVideo = true;
  } else if (cpu && cpu.hasIGpu !== false) {
    tieneVideo = true;
  } else if (cpu && cpu.hasIGpu === false) {
    alertas.push({
      tipo: "ERROR",
      titulo: "Falta Placa de Video Dedicada (Sin Salida de Video)",
      detalle: `El procesador seleccionado (${cpu.nombreWeb || cpu.descripcion}) NO posee gráficos integrados. Es obligatorio agregar una Placa de Video (GPU) para que la PC dé imagen.`,
    });
  }

  // 4. Verificación de Cooler de CPU
  if (cpu && cooler) {
    if (cpu.includesCooler === false && cooler.sku === "STOCK-COOLER") {
      alertas.push({
        tipo: "ERROR",
        titulo: "Procesador vendido SIN Cooler de fábrica",
        detalle: `El procesador (${cpu.nombreWeb || cpu.descripcion}) no incluye cooler en su caja. Debe seleccionar un Cooler de CPU por aire o refrigeración líquida AIO.`,
      });
    } else if (cpu.includesCooler === false && cooler.isCpuCooler === false) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Ventilador de Gabinete en lugar de Cooler de CPU",
        detalle: `Seleccionó un ventilador de chasis (${cooler.nombreWeb || cooler.descripcion}), pero este procesador requiere un disipador o Water Cooler para CPU.`,
      });
    }
  }

  // 5. Consumo Eléctrico & Fuente de Poder
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
        titulo: "Fuente de Poder Insuficiente",
        detalle: `La fuente seleccionada (${psuPotencia}W) no cubre la demanda energética del equipo (${consumoTotalWatts}W). Seleccione una fuente ATX de al menos ${fuenteRecomendadaWatts}W.`,
      });
    } else if (psuPotencia < fuenteRecomendadaWatts) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Margen de Fuente Ajustado",
        detalle: `La fuente (${psuPotencia}W) cubre el consumo base (${consumoTotalWatts}W), pero se recomienda ${fuenteRecomendadaWatts}W+ para picos de carga.`,
      });
    }
  }

  // 6. Refrigeración líquida 360mm en gabinetes compactos
  if (cooler && (cooler.descripcion.includes("360") || cooler.nombreWeb?.includes("360")) && gabinete) {
    const descGabinete = (gabinete.nombreWeb || gabinete.descripcion).toUpperCase();
    if (descGabinete.includes("1103K") || descGabinete.includes("1102K") || descGabinete.includes("MINI") || descGabinete.includes("MICRO")) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Espacio para Radiador de 360mm",
        detalle: `Verifique que el gabinete seleccionado soporte radiadores de 360mm en el panel superior o frontal.`,
      });
    }
  }

  const tieneErrores = alertas.some((a) => a.tipo === "ERROR");

  return {
    compatible: !tieneErrores,
    alertas,
    consumoTotalWatts,
    fuenteRecomendadaWatts,
    tieneVideo,
  };
}

// Tipo de cambio referencial (USD a Guaraníes)
export const TIPO_CAMBIO_PYG_DEFECTO = 7850;
