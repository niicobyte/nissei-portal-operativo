// Definiciones enriquecidas de Tipos de Producto y Categorías basadas en la base de datos real de NISSEI SATI CDE

export interface CategoryFamily {
  id: string;
  name: string;
  icon: string; // Monograma industrial (Hallmark: no emojis as icons)
  description: string;
  components: string[];
}

export const CATEGORY_FAMILIES: CategoryFamily[] = [
  {
    id: "COMPUTACION",
    name: "Informática & PCs",
    icon: "PC",
    description: "Notebooks, MacBooks, PCs de escritorio, componentes y periféricos",
    components: [
      "NOTEBOOK",
      "MACBOOK",
      "PC MONTADA",
      "MINI PC",
      "PLACA MADRE",
      "GPU",
      "GABINETE",
      "FUENTE",
      "TECLADO",
      "MOUSE",
      "KIT TECLADO+MOUSE",
      "TECLADO MECANICO",
      "HD INT.",
      "HD EXT.",
      "SSD",
      "MEM DDR4",
      "MEM DDR5",
      "COOLER"
    ],
  },
  {
    id: "TELEFONIA",
    name: "Smartphones & Tablets",
    icon: "TEL",
    description: "Celulares, iPads, tablets digitales y accesorios de carga",
    components: [
      "CELULAR",
      "TABLET",
      "IPAD",
      "TABLETA GRAFICA",
      "PENCIL",
      "CARGADOR DE PARED",
      "CABLE USB-C",
      "CABLE USB-C / LIGHTNING"
    ],
  },
  {
    id: "WEARABLES",
    name: "Relojes & Smartwatches",
    icon: "WR",
    description: "Smartwatches, pulseras de actividad, anillos inteligentes y bandas",
    components: [
      "RELOJ",
      "PULSERA",
      "ANILLO SMART"
    ],
  },
  {
    id: "AUDIO",
    name: "Audio & Sonido",
    icon: "AUD",
    description: "Auriculares inalámbricos, speakers Bluetooth, micrófonos y soundbars",
    components: [
      "AURICULAR",
      "SPEAKER",
      "PARLANTE",
      "SOUNDBAR",
      "MICROFONO",
      "MICROFONO INALÁMBRICO",
      "MICROFONO DE MANO",
      "INTERFAZ DE AUDIO"
    ],
  },
  {
    id: "FOTOGRAFIA",
    name: "Fotografía & Video",
    icon: "FTO",
    description: "Cámaras profesionales, lentes, drones, flashes e iluminación de estudio",
    components: [
      "CAMARA",
      "CAMARA FOTOGRAFICA",
      "CAMARA DIGITAL",
      "LENTE",
      "DRONE",
      "FLASH",
      "PANEL LED",
      "SOFTBOX",
      "ESTABILIZADOR",
      "TRIPODE",
      "BASTON LED"
    ],
  },
  {
    id: "IMPRESION",
    name: "Impresión & 3D",
    icon: "PRN",
    description: "Impresoras multifunción a tinta, térmicas de recibos y 3D",
    components: [
      "IMPRESORA",
      "IMPRESORA TERMICA",
      "IMPRESORA 3D",
      "IMPRESORA 3D RESINA",
      "IMPRESORA FOTOGRAFICA"
    ],
  },
  {
    id: "GAMING",
    name: "Gaming & Consolas",
    icon: "GM",
    description: "PlayStation 5, Nintendo Switch, consolas portátiles y mandos",
    components: [
      "VJ CON PS5",
      "VJ CON NINTENDO",
      "CONSOLA",
      "VJ CONSOLA PORTATIL",
      "VJ CONTROL",
      "SILLA/CADEIRA P/GAMER"
    ],
  },
  {
    id: "ELECTROHOGAR",
    name: "Electrohogar & Cocina",
    icon: "ELC",
    description: "Cafeteras, freidoras sin aceite, hornos y pequeños electrodomésticos",
    components: [
      "CAFETERA",
      "FREIDORA AIR FRYER",
      "HORNO",
      "MICROONDAS",
      "LICUADORA",
      "SANDWICHERA GRILL",
      "BATIDORA",
      "HERVIDORA",
      "FABRICADORA DE HIELO"
    ],
  },
  {
    id: "LIMPIEZA",
    name: "Aspiración & Limpieza",
    icon: "CLN",
    description: "Aspiradoras robot, aspiradoras inalámbricas y limpiadores",
    components: [
      "ASPIRADOR ROBOT",
      "ASPIRADORA",
      "ASPIRADORA VERTICAL",
      "ASPIRADORA PORTÁTIL",
      "ASPIRADOR ROBOT PISCINA",
      "ROBOT LIMPIA VIDRIOS",
      "LIMPIADOR A VAPOR"
    ],
  },
  {
    id: "PANTALLAS",
    name: "TVs & Monitores",
    icon: "DSP",
    description: "Smart TVs, monitores de alta tasa de refresco y proyectores",
    components: [
      "MONITOR",
      "MONITOR CURVO",
      "TV",
      "TV SMART",
      "PROYECTOR",
      "MEDIA PLAYER"
    ],
  },
  {
    id: "ENERGIA_REDES",
    name: "Energía, Redes & CCTV",
    icon: "NET",
    description: "Arrancadores de batería, power banks, UPS, routers y cámaras IP",
    components: [
      "ARRANCADOR",
      "CARGADOR PORTATIL",
      "UPS",
      "FILTRO DE ENERGIA",
      "ROUTER",
      "EXTENDER",
      "CAMARA IP",
      "CCTV"
    ],
  },
  {
    id: "CUIDADO_PERSONAL",
    name: "Cuidado Personal",
    icon: "CAR",
    description: "Secadores, planchitas para cabello, cortapelos y afeitadoras",
    components: [
      "SECADOR DE PELO",
      "PLANCHITA",
      "CORTA PELO",
      "AFEITADORA",
      "CEPILLO SECADOR",
      "BALANZA DIGITAL",
      "MASAJEADOR"
    ],
  },
];

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
  "DJI"
];
