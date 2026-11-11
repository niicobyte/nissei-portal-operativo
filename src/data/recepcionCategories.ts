// Definiciones enriquecidas de Rubros, Subcategorías y Clasificación de Productos
// Basadas en el catálogo real de NISSEI Post-Venta & SATI ASU - CDE

export interface CategoryFamily {
  id: string;
  name: string;
  icon: string; // Monograma industrial (sin emojis)
  description: string;
  components: string[];
}

export const OTHER_CATEGORY_FAMILY: CategoryFamily = {
  id: "OTROS",
  name: "Otros Artículos",
  icon: "VAR",
  description: "Otros productos, repuestos y artículos varios",
  components: [],
};

export const CATEGORY_FAMILIES: CategoryFamily[] = [
  {
    id: "COMPUTACION",
    name: "Informática & Hardware PC",
    icon: "PC",
    description: "Notebooks, MacBooks, PCs armadas, componentes internos y periféricos",
    components: [
      "NOTEBOOK",
      "MACBOOK",
      "MACBOOK AIR",
      "MACBOOK PRO",
      "PC MONTADA",
      "PC ALL IN ONE",
      "PC HP HOMEN",
      "MINI PC",
      "NUC",
      "LICENCIA WINDOWS",
      "PLACA MADRE",
      "MB",
      "CPU",
      "GPU",
      "VGA",
      "MEMORIA",
      "MEMORIA RAM",
      "DDR4",
      "MEM DDR3",
      "MEM DDR4",
      "MEM DDR5",
      "MEM NB DDR4",
      "MEM NB DDR3L",
      "SSD",
      "SSD M.2",
      "HDD",
      "HD INT.",
      "HD INTERNO",
      "HD. INTERNO",
      "HD EXT.",
      "HD EXTERNO",
      "PENDRIVE",
      "MEM SD",
      "MEM MICRO SD",
      "FUENTE",
      "GABINETE",
      "CASE",
      "COOLER",
      "COOLER LIQUID",
      "COOLER P/ NOTEBOOK",
      "COOLER P/NOTEBOOK",
      "COOLER/FAN",
      "TECLADO",
      "TECLADO MECANICO",
      "MINI TECLADO",
      "TECLADO NUMERICO",
      "KIT TECLADO",
      "KIT TECLADO+MOUSE",
      "KIT TECLADO+MOUSE+MOUSEPAD+AURICULAR+SPEAKER SATELLITE KG-502 RGB ESPAÑOL",
      "MOUSE",
      "WEBCAM",
      "HUB",
      "HUB USB-C",
      "ADAPTADOR",
      "ADAP.",
      "ADAP WIRELESS",
      "ADAPTADOR WIRELESS",
      "MULTIPLICADOR",
      "SILLA",
      "SILLA PARA GAMER",
      "SILLA/CADEIRA P/GAMER",
      "MESA GAMER MOTORIZADA",
    ],
  },
  {
    id: "TELEFONIA",
    name: "Telefonía, Tablets & Carga",
    icon: "TEL",
    description: "Celulares, tablets, iPads, lápices digitales, cables y cargadores",
    components: [
      "CELULAR",
      "TELEFONO IP",
      "INTERCOMUNICADOR",
      "RADIO COMUNICADOR",
      "TABLET",
      "IPAD",
      "TABLETA GRAFICA",
      "PENCIL",
      "ESTUCHE",
      "ESTUCHE C/ TECLADO",
      "ESTUCHE TECLADO",
      "CARGADOR",
      "CARGADOR DE PARED",
      "CARGADOR PORTATIL",
      "CARGADOR P/ AUTO",
      "CARGADOR P/ AUTOS",
      "CARGADOR AC",
      "CARGADOR DE BATERIA",
      "CABLE",
      "CABLE USB",
      "CABLE USB-C",
      "CABLE USB-A / USB-C",
      "CABLE USB-A / LIGTHNING",
      "CABLE USB-C / LIGHTNING",
      "CABLE USB-C / USB-C",
      "SOPORTE",
      "SOPORTE PARA AUTO",
      "SOPORTE CELULAR P/ AUTO",
      "MONTURA PARA CELULAR",
      "MONTURA P/ CELULAR",
    ],
  },
  {
    id: "WEARABLES",
    name: "Relojes, Wearables & GPS",
    icon: "WR",
    description: "Smartwatches, pulseras, anillos inteligentes, localizadores y GPS",
    components: [
      "RELOJ",
      "RELOJ SMART",
      "PULSERA",
      "ANILLO",
      "ANILLO SMART",
      "AIRTAG",
      "LOCALIZADOR",
      "GPS",
    ],
  },
  {
    id: "AUDIO",
    name: "Audio & Sonido",
    icon: "AUD",
    description: "Auriculares, parlantes, speakers, soundbars, micrófonos y car audio",
    components: [
      "AURICULAR",
      "SPEAKER",
      "SPEAKER PORTATIL",
      "SPEAKER P/ PC",
      "PARLANTE",
      "PARLANTE MONITOR",
      "ALTAVOZ",
      "SOUNDBAR",
      "HOMEPOD",
      "ECHO SHOW",
      "MICROFONO",
      "MICROFONO INALÁMBRICO",
      "MICROFONO DE MANO",
      "MICROFONO P/CEL",
      "INTERFAZ",
      "INTERFAZ DE AUDIO",
      "GRABADORA DE VOZ",
      "GRABADORA DE ZOOM",
      "RADIO",
      "RADIO PORTATIL",
      "CAR AUDIO",
      "AUTORADIO",
      "CARPLAY",
      "RECEIVER",
      "RECEPTOR",
      "GUITARRA",
    ],
  },
  {
    id: "FOTOGRAFIA",
    name: "Fotografía, Video & Drones",
    icon: "FTO",
    description: "Cámaras profesionales, lentes, drones, flashes, luces y estabilizadores",
    components: [
      "CAMARA",
      "CAMARA FOTOGRAFICA",
      "CAMARA DIGITAL",
      "CAMARA INFANTIL",
      "CAMARA CORPORAL",
      "CAMARA P/AUTO",
      "FILMADORA",
      "VIDEO GRABADORA",
      "LENTE",
      "LENTE DE REALIDAD VIRTUAL",
      "LENTE REALIDAD VIRTUAL",
      "DRONE",
      "FLASH",
      "PANEL LED",
      "LED ANULAR",
      "LUZ LED",
      "BASTON LED",
      "SOFTBOX",
      "ESTABILIZADOR",
      "TRIPODE",
      "MINI TRIPODE",
      "BATERIA PARA CAMARA",
      "KIT DE ANILLOS ADAP",
    ],
  },
  {
    id: "PANTALLAS",
    name: "TVs, Monitores & Video",
    icon: "DSP",
    description: "Smart TVs, TV Sticks, monitores, proyectores y adaptadores de video",
    components: [
      "TV",
      "TV SMART",
      "TV STICK",
      "CONVERSOR DIGITAL",
      "CONVERSOR TV DIGITAL",
      "CONVERSOR DE TV DIGITAL",
      "MEDIA PLAYER",
      "RECEPTOR TV",
      "RECEPTOR IPTV",
      "LED RGB P/TV",
      "SOPORTE P/TV",
      "MONITOR",
      "MONITOR CURVO",
      "MONITOR PORTATIL",
      "SOPORTE P/ MONITOR",
      "PROYECTOR",
      "PANTALLA DE PROYECCION",
      "SWITCH DE VIDEO",
      "HDMI SPLITTER",
      "EXTENSOR HDMI",
      "MICRO CONVERTER",
    ],
  },
  {
    id: "IMPRESION",
    name: "Impresión, POS & Oficina",
    icon: "PRN",
    description: "Impresoras multifunción, térmicas, 3D, etiquetadoras, POS y oficina",
    components: [
      "IMPRESORA",
      "IMPRESORA TERMICA",
      "IMPRESORA PORTATIL",
      "IMPRESORA LASER",
      "IMPRESORA POS",
      "IMPRESORA FOTOGRAFICA",
      "IMPRESORA DE CORTE",
      "IMPRESORA 3D",
      "IMPRESORA 3D RESINA",
      "ETIQUETADORA",
      "ROTULADORA PORTATIL",
      "REFILL",
      "MARCADOR DE ASISTENCIA",
      "TERMINAL DE ACCESO FACIAL",
      "LECTOR CODIGO DE BARRA",
      "CONTADOR DE DINERO",
      "CONTADOR DE BILLETES",
      "CAJA DE DINERO",
      "BALANZA COMERCIAL",
    ],
  },
  {
    id: "GAMING",
    name: "Gaming & Consolas",
    icon: "GM",
    description: "Consolas PlayStation, Nintendo, portátiles, mandos y simuladores",
    components: [
      "VJ CON PS5",
      "VJ J PS5",
      "VJ CON NINTENDO",
      "CONSOLA",
      "VJ CONSOLA",
      "VJ CONSOLA PORTATIL",
      "VJ CONTROL",
      "VJ PS5 CONTROL",
      "VIDEO JUEGO",
      "VIDEOJUEGO",
      "VOLANTE",
      "FIGURA DE ACCION",
      "CARTAS",
    ],
  },
  {
    id: "ENERGIA_REDES",
    name: "Redes, Energía & CCTV",
    icon: "NET",
    description: "Routers, UPS, estabilizadores, cámaras IP/CCTV, domótica y baterías",
    components: [
      "ROUTER",
      "HUB SWITCH",
      "SWITCH",
      "EXTENDER",
      "SOPORTE PARA AUTOMOVIL STARLINK",
      "ARRANCADOR",
      "UPS",
      "ESTABILIZADOR",
      "ESTACION DE ENERGIA",
      "FILTRO DE ENERGIA",
      "BATERIA",
      "PILA RECARGABLE",
      "PILAS",
      "PILA BOTON",
      "CAMARA IP",
      "CAMARA/ EXT.",
      "CCTV",
      "KIT CCTV",
      "BABY CALL",
      "CERRADURA DIGITAL",
      "INTERRUPTOR",
      "INTERRUPTOR SMART",
      "INTERRUMPTOR SMART",
      "CONTROL",
      "CONTROL SMART",
      "CONTROL INFRARROJO",
      "TIMBRE ELECTRICO",
      "SENSOR",
      "FOCO",
      "FOCO LED SMART",
      "LED",
      "LUZ DE EMERGENCIA",
      "LAMPARA",
      "LAMPARA DE TECHO",
    ],
  },
  {
    id: "LIMPIEZA",
    name: "Aspiración, Limpieza & Clima",
    icon: "CLN",
    description: "Robots aspiradores, hidrolavadoras, lavarropas, climatización y planchado",
    components: [
      "ASPIRADOR",
      "ASPIRADOR ROBOT",
      "ASPIRADORA",
      "ASPIRADORA VERTICAL",
      "ASPIRADORA PORTÁTIL",
      "ASPIRADORA PORTATIL",
      "ASPIRADOR ROBOT PISCINA",
      "SOPLADORA/ASPIRADORA",
      "ROBOT LIMPIA VIDRIOS",
      "LIMPIA VIDRIO",
      "LIMPIADOR A VAPOR",
      "HIDROLAVADORA",
      "LAVARROPA",
      "LAVARROPAS",
      "LAVASECARROPA",
      "LAVASECARROPAS",
      "LAVAVAJILLA",
      "LAVAVAJILLAS",
      "AIRE ACONDICIONADO",
      "VENTILADOR",
      "DESHUMIFICADOR",
      "DESHUMIDIFICADOR",
      "HUMIDIFICADOR",
      "PURIFICADOR DE AIRE",
      "ESTUFA A GAS",
      "CALENTADOR",
      "PLANCHA A VAPOR",
      "VAPORIZADOR",
      "MATA INSECTO",
    ],
  },
  {
    id: "ELECTROHOGAR",
    name: "Electrohogar & Cocina",
    icon: "ELC",
    description: "Cafeteras, freidoras Air Fryer, hornos, licuadoras, heladoras y cocina",
    components: [
      "CAFETERA",
      "FREIDORA",
      "FREIDORA AIR FRYER",
      "FREIDORA ELECTRICA",
      "AIR FRYER FREIDORA/HORNO ELÉCTRICO",
      "HORNO",
      "HORNO ELECTRICO",
      "HORNO P/PIZZA",
      "HORNO-FREIDORA",
      "MICROONDAS",
      "LICUADORA",
      "LICUADORA PORTÁTIL",
      "LICUADORA PERSONAL",
      "BATIDORA",
      "MIXER",
      "MINI MIXER",
      "SANDWICHERA",
      "SANDWICHERA GRILL",
      "PANQUEQUERA/CREPERA",
      "WAFFLERA",
      "HERVIDORA",
      "HERVIDORA DE HUEVOS",
      "JARRA ELECTRICA",
      "JARRA ELÉCTRICA",
      "ARROCERA",
      "OLLA A PRESION",
      "OLLA A PRESIÓN",
      "FABRICADORA DE HIELO",
      "FABRICADORA DE HELO",
      "FABRICADORA DE PAN",
      "MAQUINA DE HELADO",
      "MAQUINA DE HELADOS",
      "MAQUINA DE GRANIZADO",
      "MAQUINA DE GRANIZADOS",
      "COCINA A GAS",
      "COCINA INFRARROJA",
      "COCINA ELECTRICA",
      "COCINA ANAFE",
      "PLACA INFRARROJA",
      "DISPENSADOR DE AGUA",
      "BEBEDERO",
      "CAVA",
      "CAVA P/ VINOS",
      "HELADERA",
      "CONSERVADORA",
      "TERMO",
      "MOLINILLO",
      "EXTRACTOR",
      "PRENSA DE HAMBURGUESA",
      "CORTADOR DE FRUTAS Y VERDURAS",
      "SELLADORA",
    ],
  },
  {
    id: "CUIDADO_PERSONAL",
    name: "Cuidado Personal & Salud",
    icon: "CAR",
    description: "Secadores, planchitas, afeitadoras, masajeadores, balanzas y salud",
    components: [
      "SECADOR DE PELO",
      "SECADOR",
      "CEPILLO SECADOR",
      "SECADOR CEPILLO",
      "PLANCHITA",
      "CORTA PELO",
      "KIT CORTA PELO",
      "AFEITADORA",
      "BARBEADOR",
      "TRIMMER",
      "DEPILADOR",
      "MODELADOR",
      "MODELADOR DE PELO",
      "ONDULADOR",
      "MULTIESTILIZADOR",
      "CEPILLO DE DIENTE",
      "LIMPIADOR DENTAL",
      "MASAJEADOR",
      "ESPEJO LED",
      "LENTE DE SOL",
      "BALANZA",
      "BALANZA DIGITAL",
      "MEDIDOR DE PRESION",
      "MEDIDOR PRESION DIGITAL",
      "NEBULIZADOR",
      "PERFUME",
      "COLONIA",
    ],
  },
  {
    id: "HERRAMIENTAS_OTROS",
    name: "Herramientas, Movilidad & Hogar",
    icon: "TOL",
    description: "Taladros, jardinería, patinetas eléctricas, bolsos, mochilas y equipamiento",
    components: [
      "TALADRO",
      "KIT TALADRO",
      "LLAVE DE IMPACTO",
      "MINI MOTOSIERRA",
      "CORTASETOS",
      "CORTACERCO",
      "CORTA PASTO",
      "DESMALEZADORA",
      "MASCARA DE SOLDAR",
      "COMPRESOR DE AIRE",
      "VALVULA DE RIEGO",
      "PATINETA",
      "PATINETE ELECTRICA",
      "SCOOTER",
      "CASCO",
      "MAQUINA DE COSER",
      "MOCHILA",
      "BOLSO PARA VIAJE",
      "CALZADO",
      "BOTIN DE SEGURIDAD",
      "CAMISETA",
      "COLCHON INFLABLE",
      "EDREDON",
      "ALFOMBRA",
      "BASURERO",
      "CANILLA",
      "GRIFERIA",
      "REPISA",
      "LONA",
      "JAULA",
      "PISTOLA",
      "REEL MARINE",
    ],
  },
];

export function normalizeCategoryText(raw: string | undefined | null): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function normalizeComponentName(raw: string | undefined | null): string {
  return String(raw || "OTRO").trim().toUpperCase() || "OTRO";
}

// Mapa directo precomputado (sin tildes -> familia) para resolución instantánea O(1)
const EXACT_FAMILY_LOOKUP = new Map<string, CategoryFamily>();
for (const fam of CATEGORY_FAMILIES) {
  for (const comp of fam.components) {
    const key = normalizeCategoryText(comp);
    if (!EXACT_FAMILY_LOOKUP.has(key)) {
      EXACT_FAMILY_LOOKUP.set(key, fam);
    }
  }
}

function getFamily(id: string): CategoryFamily {
  return CATEGORY_FAMILIES.find((f) => f.id === id) || OTHER_CATEGORY_FAMILY;
}

/**
 * Clasifica cualquier `tipoComponente` (incluyendo variaciones futuras de CSV) en su Rubro / Categoría Padre.
 */
export function findCategoryFamily(tipo: string | undefined | null): CategoryFamily {
  const norm = normalizeCategoryText(tipo);
  if (!norm) return OTHER_CATEGORY_FAMILY;

  // 1. Coincidencia exacta
  const exact = EXACT_FAMILY_LOOKUP.get(norm);
  if (exact) return exact;

  // 2. Coincidencia parcial priorizando nombres exactos más largos para evitar colisiones
  let bestPartial: { fam: CategoryFamily; len: number } | null = null;
  for (const fam of CATEGORY_FAMILIES) {
    for (const comp of fam.components) {
      const compNorm = normalizeCategoryText(comp);
      if (compNorm.length >= 4 && norm.includes(compNorm)) {
        if (!bestPartial || compNorm.length > bestPartial.len) {
          bestPartial = { fam, len: compNorm.length };
        }
      }
    }
  }
  if (bestPartial) return bestPartial.fam;

  // 3. Reglas semánticas por palabras clave para productos nuevos
  if (/(NOTEBOOK|MACBOOK|LAPTOP|PLACA MADRE|\bPC\b|DDR\d|SSD|NVME|\bHDD\b|TECLADO|MOUSE|GABINETE|FUENTE|COOLER|WEBCAM|GAMER)/.test(norm)) {
    return getFamily("COMPUTACION");
  }
  if (/(CELULAR|IPHONE|XIAOMI.*REDMI|TABLET|IPAD|CARGADOR|CABLE\s+USB|ESTUCHE)/.test(norm)) {
    return getFamily("TELEFONIA");
  }
  if (/(RELOJ|WATCH|PULSERA|SMARTBAND|AIRTAG|GPS|LOCALIZADOR)/.test(norm)) {
    return getFamily("WEARABLES");
  }
  if (/(AURICULAR|HEADSET|SPEAKER|PARLANTE|ALTAVOZ|SOUNDBAR|MICROFONO|RADIO|CARPLAY|AUDIO)/.test(norm)) {
    return getFamily("AUDIO");
  }
  if (/(CAMARA\s+IP|CCTV|ROUTER|SWITCH|\bUPS\b|ARRANCADOR|CERRADURA|TIMBRE|BATERIA|\bPILA\b)/.test(norm)) {
    return getFamily("ENERGIA_REDES");
  }
  if (/(CAMARA|DRONE|FILMADORA|LENTE|FLASH|TRIPODE|SOFTBOX|ESTABILIZADOR)/.test(norm)) {
    return getFamily("FOTOGRAFIA");
  }
  if (/(SMART\s*TV|\bTV\b|MONITOR|PROYECTOR|HDMI|MEDIA PLAYER)/.test(norm)) {
    return getFamily("PANTALLAS");
  }
  if (/(IMPRESORA|ETIQUETADORA|ROTULADORA|POS\b|CONTADOR DE|ASISTENCIA|BARRA)/.test(norm)) {
    return getFamily("IMPRESION");
  }
  if (/(PS5|NINTENDO|CONSOLA|VIDEOJUEGO|VIDEO JUEGO|JOYSTICK|VOLANTE)/.test(norm)) {
    return getFamily("GAMING");
  }
  if (/(ASPIRAD|HIDROLAV|LAVARROP|LAVAVAJ|AIRE ACOND|VENTILADOR|HUMIDIFIC|PLANCHA A VAPOR|VAPORIZADOR)/.test(norm)) {
    return getFamily("LIMPIEZA");
  }
  if (/(CAFETERA|FREIDORA|AIR FRYER|HORNO|MICROONDAS|LICUADORA|BATIDORA|MIXER|COCINA|HELADO|GRANIZAD|SANDWICHERA|HERVIDORA|JARRA|OLLA|HELADERA|BEBEDERO)/.test(norm)) {
    return getFamily("ELECTROHOGAR");
  }
  if (/(SECADOR|PLANCHITA|CORTA\s*PELO|AFEITADOR|BARBEADOR|TRIMMER|DEPILADOR|MASAJEADOR|BALANZA|PRESION|NEBULIZADOR|PERFUME)/.test(norm)) {
    return getFamily("CUIDADO_PERSONAL");
  }
  if (/(TALADRO|MOTOSIERRA|CORTASET|DESMALEZ|PATINET|SCOOTER|MOCHILA|BOTIN|CALZADO|SOLDAR)/.test(norm)) {
    return getFamily("HERRAMIENTAS_OTROS");
  }

  return OTHER_CATEGORY_FAMILY;
}

/**
 * Verifica si un ticket cumple con el filtro jerárquico (Rubro padre y/o lista de subcategorías).
 */
export function matchesCategoryFilter(
  tipoComponente: string | undefined | null,
  selectedFamily: string,
  selectedCategories: string[]
): boolean {
  if (selectedCategories.length > 0) {
    const normalizedComp = normalizeComponentName(tipoComponente);
    return selectedCategories.some((c) => normalizeComponentName(c) === normalizedComp);
  }
  if (selectedFamily && selectedFamily !== "TODOS") {
    return findCategoryFamily(tipoComponente).id === selectedFamily;
  }
  return true;
}

export const TOP_SATI_BRANDS = [
  "XION",
  "XIAOMI",
  "HP",
  "SAMSUNG",
  "JBL",
  "SATELLITE",
  "APPLE",
  "SONY",
  "CANON",
  "LENOVO",
  "ASUS",
  "GIGABYTE",
  "DELL",
  "MEGA STAR",
  "HAYLOU",
  "GODOX",
  "EPSON",
  "KODAK",
  "C IDEA",
  "BLACKVIEW",
  "ACER",
  "BASEUS",
  "BAMBU LAB",
  "NINTENDO",
  "OSTER",
  "DJI",
];
