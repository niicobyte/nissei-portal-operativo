import { normalizeCategoryText, normalizeComponentName } from "@/data/recepcionCategories";

export const QUICK_ACCESSORIES_BY_TYPE_STORAGE_KEY =
  "nissei_recepcion_accesorios_por_tipo_v2";

export const BASE_ACCESSORIES = ["Unidad", "Caja", "Manuales"] as const;

interface ComponentPresetRule {
  match: RegExp;
  extras: string[];
}

const COMPONENT_ACCESSORY_RULES: ComponentPresetRule[] = [
  {
    match: /(AURICULAR|HEADSET|EARBUD|AIRPOD|BUDS)/,
    extras: ["Almohadillas", "Estuche de carga", "Adaptador USB / Dongle"],
  },
  {
    match: /(TV\s*STICK|TV\s*BOX|CONVERSOR|MEDIA\s*PLAYER|CHROMECAST|FIRE\s*TV|APPLE\s*TV)/,
    extras: ["Control Remoto", "Adaptador HDMI", "Fuente de poder"],
  },
  {
    match: /(SMART\s*TV|\bTV\b|TELEVISOR)/,
    extras: ["Control Remoto", "Soporte para pared", "Base / Patas", "Cable de poder"],
  },
  {
    match: /(MONITOR)/,
    extras: ["Base / Soporte", "Fuente / Cargador", "Cable HDMI / DP", "Cable de poder"],
  },
  {
    match: /(PROYECTOR)/,
    extras: ["Control Remoto", "Cable de poder", "Cable HDMI", "Tapa de lente"],
  },
  {
    match: /(CELULAR|SMARTPHONE|IPHONE|TELEFONO)/,
    extras: ["Cargador", "Funda / Carcasa", "Pin extractor SIM"],
  },
  {
    match: /(TABLET|IPAD|TABLETA\s*GRAFICA)/,
    extras: ["Cargador", "Lápiz / Stylus", "Funda / Teclado"],
  },
  {
    match: /(NOTEBOOK|MACBOOK|LAPTOP|ULTRABOOK)/,
    extras: ["Cargador Original", "Cable de poder", "Funda / Mochila"],
  },
  {
    match: /(PC\s*ALL\s*IN\s*ONE|MINI\s*PC|PC\s*MONTADA|\bNUC\b|PC\s*HP)/,
    extras: ["Cable de poder", "Teclado", "Mouse", "Fuente externa"],
  },
  {
    match: /(RELOJ|WATCH|SMARTBAND|PULSERA)/,
    extras: ["Malla / Correa", "Base de carga magnética"],
  },
  {
    match: /(LENTE\s*VR|OCULUS|QUEST|\bVR\b)/,
    extras: ["Controles (Izq/Der)", "Cargador", "Correa / Espuma"],
  },
  {
    match: /(CAMARA\s*IP|CCTV|TIMBRE|CERRADURA)/,
    extras: ["Fuente de alimentación", "Soporte de pared", "Tornillos / Tarugos", "Tarjeta Micro SD"],
  },
  {
    match: /(DRONE)/,
    extras: ["Control Remoto", "Baterías", "Hélices de repuesto", "Cargador / Hub", "Estuche"],
  },
  {
    match: /(ESTABILIZADOR|GIMBAL)/,
    extras: ["Trípode mini", "Pinza / Soporte", "Estuche"],
  },
  {
    match: /(CAMARA|FILMADORA|GOPRO|ACTION\s*CAM)/,
    extras: ["Batería", "Cargador", "Lente", "Tapa de lente", "Correa"],
  },
  {
    match: /(LENTE|OBJETIVO)/,
    extras: ["Tapa delantera", "Tapa trasera", "Parasol", "Estuche"],
  },
  {
    match: /(PARLANTE|SPEAKER|ALTAVOZ|SOUNDBAR|BARRA\s*DE\s*SONIDO|CAJA\s*DE\s*SONIDO|TORRE\s*DE\s*SONIDO|RADIO)/,
    extras: ["Cargador / Fuente", "Control Remoto", "Micrófono", "Cable de poder"],
  },
  {
    match: /(MICROFONO|GRABADORA\s*DE\s*VOZ)/,
    extras: ["Receptor", "Filtro / Espuma", "Estuche", "Clip / Soporte"],
  },
  {
    match: /(IMPRESORA|ETIQUETADORA|ROTULADORA)/,
    extras: ["Fuente / Cable de poder", "Cartuchos / Tintas", "Rollo de papel", "Bandeja"],
  },
  {
    match: /(PS5|PS4|XBOX|NINTENDO|CONSOLA|VIDEO\s*JUEGO|VIDEOJUEGO)/,
    extras: ["Control / Joystick", "Cable HDMI", "Cable de poder", "Base / Soporte"],
  },
  {
    match: /(JOYSTICK|CONTROL|VOLANTE|GAMEPAD)/,
    extras: ["Receptor USB (Dongle)", "Pedales", "Soporte / Abrazadera"],
  },
  {
    match: /(TECLADO|MOUSE|KIT\s*TECLADO)/,
    extras: ["Receptor USB (Dongle)", "Reposamuñecas", "Keycaps / Switches"],
  },
  {
    match: /(ROUTER|SWITCH|EXTENDER|REPETIDOR|MODEM|ACCESS\s*POINT|STARLINK)/,
    extras: ["Fuente de alimentación", "Cable de red (LAN)", "Antenas", "Soporte"],
  },
  {
    match: /(\bUPS\b|NOBREAK|ESTACION\s*DE\s*ENERGIA|ARRANCADOR)/,
    extras: ["Cable de poder", "Cargador", "Pinzas / Adaptadores"],
  },
  {
    match: /(PLANCHA\s*A\s*VAPOR|VAPORIZADOR|PLANCHA)/,
    extras: ["Tanque de agua", "Cepillo", "Dosificador", "Base"],
  },
  {
    match: /(ASPIRAD|LIMPIA\s*VIDRIOS)/,
    extras: ["Base de carga", "Cepillos", "Filtro", "Boquillas / Tubo", "Control Remoto"],
  },
  {
    match: /(HIDROLAV)/,
    extras: ["Pistola / Lanza", "Manguera", "Boquillas", "Recipiente de jabón"],
  },
  {
    match: /(AIRE\s*ACOND|VENTILADOR|CLIMATIZADOR|HUMIDIFIC|PURIFICADOR)/,
    extras: ["Control Remoto", "Base / Pie", "Filtro"],
  },
  {
    match: /(CAFETERA)/,
    extras: ["Portafiltro", "Filtro", "Jarra", "Cuchara dosificadora", "Tanque de agua"],
  },
  {
    match: /(FREIDORA|AIR\s*FRYER|HORNO|MICROONDAS)/,
    extras: ["Canasta / Bandeja", "Rejilla", "Plato giratorio"],
  },
  {
    match: /(LICUADORA|BATIDORA|MIXER|PROCESADORA)/,
    extras: ["Vaso / Jarra", "Tapa", "Cuchillas / Batidores"],
  },
  {
    match: /(SECADOR|PLANCHITA|MODELADOR|RIZADOR)/,
    extras: ["Boquilla / Difusor", "Peines / Cabezales", "Estuche"],
  },
  {
    match: /(AFEITADOR|BARBEADOR|CORTA\s*PELO|TRIMMER|DEPILADOR)/,
    extras: ["Peines guía", "Cargador / Base", "Cepillo limpiador", "Aceite"],
  },
  {
    match: /(TALADRO|ATORNILLADOR|HERRAMIENTA|COMPRESOR|SOLDAR)/,
    extras: ["Batería", "Cargador", "Maletín", "Brocas / Puntas"],
  },
  {
    match: /(PATINET|SCOOTER|BICICLETA)/,
    extras: ["Cargador", "Llave / Herramientas"],
  },
];

/**
 * Devuelve una clave canónica por tipo de componente para almacenar accesos directos
 * de accesorios diferenciados en localStorage.
 */
export function getComponentAccessoryKey(tipoComponente?: string | null): string {
  const raw = (tipoComponente || "").trim();
  if (!raw) return "GENERAL";
  const norm = normalizeComponentName(raw);
  if (!norm || norm === "GENERAL" || norm === "SIN ESPECIFICAR") {
    return "GENERAL";
  }
  return norm;
}

/**
 * Retorna la lista predeterminada de accesos directos para el tipo de componente dado,
 * combinando la base común (Unidad, Caja, Manuales) con sugerencias específicas.
 */
export function getDefaultAccessoriesForComponent(
  tipoComponente?: string | null
): string[] {
  const norm = normalizeCategoryText(tipoComponente) || normalizeComponentName(tipoComponente);
  const combined: string[] = [...BASE_ACCESSORIES];

  if (norm && norm !== "OTRO" && norm !== "GENERAL") {
    const matched = COMPONENT_ACCESSORY_RULES.find((rule) => rule.match.test(norm));
    if (matched) {
      for (const extra of matched.extras) {
        if (!combined.some((item) => item.toLowerCase() === extra.toLowerCase())) {
          combined.push(extra);
        }
      }
    }
  }

  return combined;
}
