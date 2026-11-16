// Motor de Compatibilidad y Catálogo de Presupuestos de PC - NISSEI Taller de Montajes
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
  formFactor?: FormFactor;
  potenciaWatts?: number;
  recomendadoPsuWatts?: number;
  garantiaMeses: number;
  cantidad?: number;
}

const KNOWN_BRANDS = [
  "AMD", "INTEL", "ASUS", "ASROCK", "GIGABYTE", "MSI", "BIOSTAR", "MAXSUN",
  "CORSAIR", "KINGSTON", "CRUCIAL", "ADATA", "XPG", "PATRIOT", "TEAMGROUP", "LEXAR",
  "ZOTAC", "PNY", "PALIT", "SAPPHIRE", "XFX", "POWERCOLOR",
  "WESTERN DIGITAL", "WD", "SEAGATE", "SAMSUNG", "HIKSEMI", "SANDISK",
  "COUGAR", "BE QUIET!", "BE QUIET", "THERMALTAKE", "COOLER MASTER", "DEEPCOOL",
  "NZXT", "LIAN LI", "GAMDIAS", "REDRAGON", "AIGO", "DARKFLASH", "SATE", "XTECH",
  "EVGA", "SEASONIC", "FSP", "ANTEC", "AEROCOOL", "THERMALRIGHT", "ARCTIC",
];

function detectBrandFromText(upperDesc: string): string | undefined {
  for (const b of KNOWN_BRANDS) {
    if (upperDesc.includes(b)) {
      return b === "BE QUIET" ? "BE QUIET!" : b === "WD" ? "WESTERN DIGITAL" : b;
    }
  }
  return undefined;
}

// Detección automática inteligente de especificaciones técnicas (sin precios inventados)
export function enriquecerComponente(
  c: ComponenteMontaje & { marca?: string }
): HardwarePresupuestoItem {
  const d = c.descripcion.toUpperCase();
  const cat = c.categoria as HardwarePresupuestoItem["categoria"];

  let socket: SocketType | undefined;
  let ramType: MemoryType | undefined;
  let tdpWatts = 0;
  let hasIGpu = true;
  let formFactor: FormFactor | undefined;
  let potenciaWatts = 0;
  let recomendadoPsuWatts = 500;
  const precioUsd = 0; // Estricto: los precios provienen únicamente de https://nissei.com/py/
  let garantiaMeses = 12;
  const marca = c.marca || detectBrandFromText(d);

  // 1. PROCESADORES
  if (cat === "PROCESADOR") {
    garantiaMeses = 36;
    if (
      d.includes("F ") ||
      d.endsWith("F") ||
      d.includes("KF") ||
      d.includes("10100F") ||
      d.includes("12100F") ||
      d.includes("12400F") ||
      d.includes("12600KF") ||
      d.includes("12900KF") ||
      d.includes("14100F") ||
      d.includes("14400F") ||
      d.includes("14700F") ||
      d.includes("14700KF") ||
      d.includes("14900F") ||
      d.includes("225F") ||
      d.includes("250KF") ||
      d.includes("8400F") ||
      d.includes("4500") ||
      d.includes("5500") ||
      d.includes("5600X") ||
      d.includes("5700X") ||
      d.includes("5800X") ||
      d.includes("5900X") ||
      d.includes("5950X")
    ) {
      hasIGpu = false;
    }

    if (d.includes("1851") || d.includes("ULTRA")) {
      socket = "LGA1851";
      ramType = "DDR5";
      tdpWatts = d.includes("285K") ? 250 : 125;
    } else if (
      d.includes("LGA1200") ||
      d.includes("LGA 1200") ||
      d.includes("10100") ||
      d.includes("10400") ||
      d.includes("11400")
    ) {
      socket = "LGA1200";
      ramType = "DDR4";
      tdpWatts = 65;
    } else if (
      d.includes("LGA1700") ||
      d.includes("LGA 1700") ||
      d.includes("1700") ||
      d.includes("12100") ||
      d.includes("12400") ||
      d.includes("12500") ||
      d.includes("12600") ||
      d.includes("12700") ||
      d.includes("12900") ||
      d.includes("14100") ||
      d.includes("14400") ||
      d.includes("14700") ||
      d.includes("14900")
    ) {
      socket = "LGA1700";
      ramType = "UNIVERSAL";
      tdpWatts = d.includes("14700") || d.includes("14900") || d.includes("12900") ? 220 : d.includes("12700") || d.includes("12600") ? 125 : 65;
    } else if (
      d.includes("AM5") ||
      d.includes("7600") ||
      d.includes("7700") ||
      d.includes("7800") ||
      d.includes("7900") ||
      d.includes("7950") ||
      d.includes("8400") ||
      d.includes("8500") ||
      d.includes("8600") ||
      d.includes("8700") ||
      d.includes("9600") ||
      d.includes("9700") ||
      d.includes("9800") ||
      d.includes("9850") ||
      d.includes("9900") ||
      d.includes("9950")
    ) {
      socket = "AM5";
      ramType = "DDR5";
      tdpWatts = d.includes("9900") || d.includes("9950") || d.includes("9800") || d.includes("9850") || d.includes("7800") ? 120 : d.includes("7700") ? 105 : 65;
    } else if (
      d.includes("AM4") ||
      d.includes("3200G") ||
      d.includes("3400G") ||
      d.includes("4100") ||
      d.includes("4500") ||
      d.includes("5300G") ||
      d.includes("5500") ||
      d.includes("5600") ||
      d.includes("5700") ||
      d.includes("5800") ||
      d.includes("5900")
    ) {
      socket = "AM4";
      ramType = "DDR4";
      tdpWatts = d.includes("5800") || d.includes("5900") ? 105 : 65;
    }
  }

  // 2. PLACAS MADRE
  if (cat === "PLACA_MADRE") {
    garantiaMeses = 36;
    formFactor = d.includes("/ATX") || d.includes(" ATX") ? "ATX" : "MATX";
    if (d.includes("DDR4") || d.includes(" D4")) {
      ramType = "DDR4";
    } else if (d.includes("DDR5") || d.includes(" D5")) {
      ramType = "DDR5";
    }

    if (d.includes("1851") || d.includes("B860") || d.includes("Z890") || d.includes("H810")) {
      socket = "LGA1851";
      ramType = "DDR5";
    } else if (d.includes("1200") || d.includes("H510") || d.includes("B560") || d.includes("H410")) {
      socket = "LGA1200";
      ramType = "DDR4";
    } else if (d.includes("1700") || d.includes("H610") || d.includes("B760") || d.includes("Z790") || d.includes("B660")) {
      socket = "LGA1700";
      if (!ramType) ramType = d.includes("DDR5") || d.includes("D5") ? "DDR5" : "DDR4";
    } else if (
      d.includes("AM5") ||
      d.includes("A620") ||
      d.includes("B650") ||
      d.includes("B840") ||
      d.includes("B850") ||
      d.includes("X670") ||
      d.includes("X870")
    ) {
      socket = "AM5";
      ramType = "DDR5";
    } else if (
      d.includes("AM4") ||
      d.includes("A320") ||
      d.includes("A520") ||
      d.includes("B450") ||
      d.includes("B550") ||
      d.includes("X570")
    ) {
      socket = "AM4";
      ramType = "DDR4";
    }
  }

  // 3. MEMORIA RAM
  if (cat === "RAM") {
    garantiaMeses = 36;
    if (d.includes("DDR5") || d.includes("D5") || d.includes("5200") || d.includes("5600") || d.includes("6000") || d.includes("6400")) {
      ramType = "DDR5";
    } else {
      ramType = "DDR4";
    }
  }

  // 4. TARJETAS DE VIDEO (GPU)
  if (cat === "GPU") {
    garantiaMeses = 36;
    if (d.includes("5090") || d.includes("4090")) { tdpWatts = 450; recomendadoPsuWatts = 1000; }
    else if (d.includes("5080") || d.includes("4080") || d.includes("7900 XTX")) { tdpWatts = 320; recomendadoPsuWatts = 850; }
    else if (d.includes("5070") || d.includes("4070") || d.includes("7800 XT") || d.includes("9070")) { tdpWatts = 250; recomendadoPsuWatts = 750; }
    else if (d.includes("5060 TI") || d.includes("4060 TI") || d.includes("7700 XT") || d.includes("6750")) { tdpWatts = 180; recomendadoPsuWatts = 650; }
    else if (d.includes("5060") || d.includes("4060") || d.includes("3060") || d.includes("7600") || d.includes("6600")) { tdpWatts = 160; recomendadoPsuWatts = 550; }
    else if (d.includes("3050") || d.includes("1650") || d.includes("RX 580") || d.includes("RX580")) { tdpWatts = 130; recomendadoPsuWatts = 500; }
    else { tdpWatts = 150; recomendadoPsuWatts = 550; }
  }

  // 5. ALMACENAMIENTO (SSD / HDD)
  if (cat === "ALMACENAMIENTO") {
    garantiaMeses = 36;
  }

  // 6. FUENTES DE PODER
  if (cat === "FUENTE") {
    garantiaMeses = 36;
    const matchW = d.match(/\b(1600|1300|1200|1050|1000|850|750|700|650|600|550|500|450|400)\s*W\b/);
    if (matchW) {
      potenciaWatts = Number(matchW[1]);
    } else {
      potenciaWatts = 500;
    }
  }

  // 7. GABINETES
  if (cat === "GABINETE") {
    garantiaMeses = 12;
    formFactor = "ATX";
  }

  // 8. REFRIGERACIÓN
  if (cat === "REFRIGERACION") {
    garantiaMeses = 12;
    socket = "UNIVERSAL";
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
  ...(catalogoNisseiRaw as unknown as HardwarePresupuestoItem[]),
  ...montajesAdicionales,
  // Cooler stock estándar
  {
    sku: "STOCK-COOLER",
    marca: "ORIGINAL",
    descripcion: "COOLER DE FÁBRICA / STOCK (INCLUIDO CON PROCESADOR)",
    categoria: "REFRIGERACION",
    precioUsd: 0,
    precioPyg: 0,
    stockStatus: "IN_STOCK",
    verificadoWeb: true,
    socket: "UNIVERSAL",
    garantiaMeses: 36,
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

  // 2. RAM vs Placa Madre
  if (mb && rams.length > 0) {
    for (const r of rams) {
      if (mb.ramType && r.ramType && mb.ramType !== "UNIVERSAL" && r.ramType !== "UNIVERSAL") {
        if (mb.ramType !== r.ramType) {
          alertas.push({
            tipo: "ERROR",
            titulo: "Incompatibilidad de Memoria RAM",
            detalle: `La placa madre utiliza slots ${mb.ramType}, pero la memoria seleccionada es ${r.ramType}.`,
          });
          break;
        }
      }
    }
  }

  // 3. Tarjeta de Video / Gráficos
  let tieneVideo = false;
  if (gpus.length > 0) {
    tieneVideo = true;
  } else if (cpu && cpu.hasIGpu !== false) {
    tieneVideo = true;
  } else if (cpu && cpu.hasIGpu === false) {
    alertas.push({
      tipo: "WARNING",
      titulo: "Requiere Placa de Video Dedicada (GPU)",
      detalle: `El procesador seleccionado (${cpu.descripcion.split(" ")[1] || "CPU"}) no posee chip de video integrado. Debe agregar una placa de video dedicada para dar imagen al monitor.`,
    });
  }

  // 4. Consumo Eléctrico & Fuente de Poder
  const cpuWatts = cpu?.tdpWatts || 65;
  const gpuWatts = gpus.reduce((acc, g) => acc + (g.tdpWatts || 150), 0);
  const baseWatts = 60; // Placa madre + RAMs + SSDs + Fans
  const consumoTotalWatts = cpuWatts + gpuWatts + baseWatts;
  
  // Margen de seguridad del 25% + pico transitorio
  const fuenteRecomendadaWatts = Math.max(
    Math.ceil((consumoTotalWatts * 1.3) / 50) * 50,
    gpus[0]?.recomendadoPsuWatts || 500
  );

  if (psu) {
    const psuPotencia = psu.potenciaWatts || 500;
    if (psuPotencia < consumoTotalWatts) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Fuente Insuficiente",
        detalle: `La fuente de poder (${psuPotencia}W) no cubre el consumo estimado del equipo (${consumoTotalWatts}W). El equipo podría apagarse bajo carga.`,
      });
    } else if (psuPotencia < fuenteRecomendadaWatts) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Margen de Fuente Ajustado",
        detalle: `La fuente (${psuPotencia}W) cubre el consumo nominal (${consumoTotalWatts}W), pero para estabilidad a largo plazo se recomienda una fuente de ${fuenteRecomendadaWatts}W.`,
      });
    }
  }

  // 5. Formato de Placa Madre vs Gabinete
  if (mb && gabinete) {
    if (mb.formFactor === "ATX" && gabinete.descripcion.toUpperCase().includes("MATX ONLY")) {
      alertas.push({
        tipo: "ERROR",
        titulo: "Formato de Gabinete Reducido",
        detalle: `La placa madre es de tamaño ATX completo y no cabe en un gabinete compacto Micro-ATX.`,
      });
    }
  }

  // 6. Refrigeración líquida 360mm en gabinetes estándar
  if (cooler && cooler.descripcion.includes("360") && gabinete) {
    const descGabinete = gabinete.descripcion.toUpperCase();
    if (descGabinete.includes("1103K") || descGabinete.includes("1102K") || descGabinete.includes("KIT")) {
      alertas.push({
        tipo: "WARNING",
        titulo: "Espacio de Watercooler 360mm",
        detalle: `El gabinete básico seleccionado podría no tener espacio frontal o superior para un radiador de 360mm. Se recomienda gabinete Cougar o Be Quiet! de media torre amplia.`,
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
