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

// Detección automática inteligente de especificaciones a partir de la descripción real del SKU
export function enriquecerComponente(c: ComponenteMontaje): HardwarePresupuestoItem {
  const d = c.descripcion.toUpperCase();
  const cat = c.categoria as HardwarePresupuestoItem["categoria"];

  let socket: SocketType | undefined;
  let ramType: MemoryType | undefined;
  let tdpWatts = 0;
  let hasIGpu = true;
  let formFactor: FormFactor | undefined;
  let potenciaWatts = 0;
  let recomendadoPsuWatts = 500;
  let precioUsd = 50;
  let garantiaMeses = 12;

  // 1. PROCESADORES
  if (cat === "PROCESADOR") {
    garantiaMeses = 36;
    if (d.includes("1851") || d.includes("ULTRA")) {
      socket = "LGA1851";
      ramType = "DDR5";
      tdpWatts = 125;
      precioUsd = 320;
    } else if (d.includes("LGA1700") || d.includes("1700") || d.includes("I3-") || d.includes("I5-") || d.includes("I7-") || d.includes("I9-")) {
      socket = "LGA1700";
      ramType = "UNIVERSAL"; // Soporta DDR4 o DDR5 según la placa
      if (d.includes("I3-12100")) { tdpWatts = 65; precioUsd = 105; }
      else if (d.includes("I5-12400F") || d.includes("I5-14400F")) { tdpWatts = 65; hasIGpu = false; precioUsd = d.includes("14400") ? 195 : 140; }
      else if (d.includes("I5-12400")) { tdpWatts = 65; precioUsd = 155; }
      else if (d.includes("I7-12700")) { tdpWatts = 125; precioUsd = 295; }
      else if (d.includes("I7-14700KF")) { tdpWatts = 250; hasIGpu = false; precioUsd = 410; }
      else if (d.includes("I9-14900")) { tdpWatts = 250; precioUsd = 580; }
      else { tdpWatts = 65; precioUsd = 180; }
    } else if (d.includes("AM5") || d.includes("7700X") || d.includes("9600X") || d.includes("8500G") || d.includes("7900")) {
      socket = "AM5";
      ramType = "DDR5";
      if (d.includes("7700X")) { tdpWatts = 105; precioUsd = 340; }
      else if (d.includes("9600X")) { tdpWatts = 65; precioUsd = 280; }
      else if (d.includes("8500G")) { tdpWatts = 65; precioUsd = 175; }
      else if (d.includes("7900")) { tdpWatts = 65; precioUsd = 420; }
      else { tdpWatts = 105; precioUsd = 250; }
    } else if (d.includes("AM4") || d.includes("5600") || d.includes("5700")) {
      socket = "AM4";
      ramType = "DDR4";
      tdpWatts = 65;
      precioUsd = d.includes("5700G") ? 185 : 135;
    }
  }

  // 2. PLACAS MADRE
  if (cat === "PLACA_MADRE") {
    garantiaMeses = 36;
    formFactor = d.includes("/ATX") || d.includes(" ATX") ? "ATX" : "MATX";
    if (d.includes("DDR4") || d.includes("D4")) {
      ramType = "DDR4";
    } else if (d.includes("DDR5") || d.includes("D5")) {
      ramType = "DDR5";
    }

    if (d.includes("1851") || d.includes("B860")) {
      socket = "LGA1851";
      ramType = "DDR5";
      precioUsd = 145;
    } else if (d.includes("1700") || d.includes("H610") || d.includes("B760")) {
      socket = "LGA1700";
      if (!ramType) ramType = d.includes("B760M-AYW") ? "DDR5" : "DDR4";
      precioUsd = d.includes("B760") ? 125 : 78;
    } else if (d.includes("AM5") || d.includes("A620") || d.includes("B650") || d.includes("B840") || d.includes("X870")) {
      socket = "AM5";
      ramType = "DDR5";
      precioUsd = d.includes("X870") ? 295 : d.includes("B840") ? 165 : d.includes("B650") ? 125 : 95;
    } else if (d.includes("AM4") || d.includes("A520") || d.includes("B450") || d.includes("B550")) {
      socket = "AM4";
      ramType = "DDR4";
      precioUsd = 72;
    }
  }

  // 3. MEMORIA RAM
  if (cat === "RAM") {
    garantiaMeses = 36;
    if (d.includes("DDR5") || d.includes("D5")) {
      ramType = "DDR5";
      precioUsd = d.includes("32GB") ? 120 : 58;
    } else {
      ramType = "DDR4";
      precioUsd = d.includes("32GB") ? 75 : d.includes("16GB") ? 38 : 24;
    }
  }

  // 4. TARJETAS DE VIDEO (GPU)
  if (cat === "GPU") {
    garantiaMeses = 36;
    if (d.includes("5070")) { tdpWatts = 250; recomendadoPsuWatts = 750; precioUsd = 680; }
    else if (d.includes("5060 TI")) { tdpWatts = 180; recomendadoPsuWatts = 650; precioUsd = 465; }
    else if (d.includes("5060")) { tdpWatts = 145; recomendadoPsuWatts = 550; precioUsd = 350; }
    else if (d.includes("5050")) { tdpWatts = 115; recomendadoPsuWatts = 500; precioUsd = 260; }
    else if (d.includes("3060")) { tdpWatts = 170; recomendadoPsuWatts = 550; precioUsd = 295; }
    else if (d.includes("RX580") || d.includes("RX 580")) { tdpWatts = 150; recomendadoPsuWatts = 500; precioUsd = 110; }
    else { tdpWatts = 150; recomendadoPsuWatts = 500; precioUsd = 250; }
  }

  // 5. ALMACENAMIENTO (SSD)
  if (cat === "ALMACENAMIENTO") {
    garantiaMeses = 36;
    if (d.includes("2TB")) { precioUsd = 115; }
    else if (d.includes("1TB")) { precioUsd = d.includes("GEN5") || d.includes("8100") ? 125 : d.includes("SN3000") || d.includes("NV3") ? 65 : 58; }
    else if (d.includes("500GB") || d.includes("512GB") || d.includes("480GB")) { precioUsd = 38; }
    else { precioUsd = 22; }
  }

  // 6. FUENTES DE PODER
  if (cat === "FUENTE") {
    garantiaMeses = 36;
    if (d.includes("850W")) { potenciaWatts = 850; precioUsd = 125; }
    else if (d.includes("750W")) { potenciaWatts = 750; precioUsd = 98; }
    else if (d.includes("650W")) { potenciaWatts = 650; precioUsd = 72; }
    else if (d.includes("600W")) { potenciaWatts = 600; precioUsd = 54; }
    else if (d.includes("550W")) { potenciaWatts = 550; precioUsd = 48; }
    else if (d.includes("500W")) { potenciaWatts = 500; precioUsd = 42; }
    else { potenciaWatts = 500; precioUsd = 40; }
  }

  // 7. GABINETES
  if (cat === "GABINETE") {
    garantiaMeses = 12;
    formFactor = "ATX"; // Casi todos soportan ATX y mATX
    if (d.includes("KIT")) { precioUsd = 38; }
    else if (d.includes("LIGHT BASE 900")) { precioUsd = 195; }
    else if (d.includes("PURE BASE 501")) { precioUsd = d.includes("LX") ? 125 : 95; }
    else if (d.includes("COUGAR AIRFACE") || d.includes("FV150")) { precioUsd = d.includes("PRO") ? 85 : 65; }
    else { precioUsd = 34; }
  }

  // 8. REFRIGERACIÓN
  if (cat === "REFRIGERACION") {
    garantiaMeses = 12;
    socket = "UNIVERSAL";
    if (d.includes("360")) { precioUsd = 98; }
    else if (d.includes("240") || d.includes("LCD")) { precioUsd = 88; }
    else if (d.includes("PEERLESS ASSASSIN")) { precioUsd = 45; }
    else { precioUsd = 24; }
  }

  return {
    sku: c.sku,
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
