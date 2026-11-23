export type ThermalPaperProfile = "80_72" | "80_76" | "58_48";
export type ThermalLengthMode = "auto" | "100mm" | "120mm" | "150mm" | "200mm";

export interface ThermalPrintSettings {
  paperProfile: ThermalPaperProfile;
  lengthMode: ThermalLengthMode;
  marginMm: number;
  offsetXMm: number;
  offsetYMm: number;
  scalePct: number;
  highContrast: boolean;
}

export const THERMAL_SETTINGS_STORAGE_KEY = "nissei_thermal_print_settings_v1";

export const DEFAULT_THERMAL_PRINT_SETTINGS: ThermalPrintSettings = {
  paperProfile: "80_72",
  lengthMode: "auto",
  marginMm: 0, // 0mm para iniciar bien arriba sin espacio desperdiciado
  offsetXMm: 0,
  offsetYMm: 0, // Ajuste fino vertical (+/- mm)
  scalePct: 100,
  highContrast: true, // Negro intenso por defecto para cabezales térmicos
};

export const THERMAL_PROFILE_META: Record<
  ThermalPaperProfile,
  { pageWidthMm: number; contentWidthMm: number; label: string; shortLabel: string }
> = {
  "80_72": {
    pageWidthMm: 80,
    contentWidthMm: 72,
    label: "80mm estándar (72mm útil)",
    shortLabel: "80mm · 72mm útil",
  },
  "80_76": {
    pageWidthMm: 80,
    contentWidthMm: 76,
    label: "80mm ancho completo (76mm)",
    shortLabel: "80mm · 76mm",
  },
  "58_48": {
    pageWidthMm: 58,
    contentWidthMm: 48,
    label: "58mm mini (48mm útil)",
    shortLabel: "58mm · 48mm",
  },
};

function clamp(val: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : fallback;
}

export function sanitizeThermalSettings(
  raw?: Partial<ThermalPrintSettings> | null
): ThermalPrintSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THERMAL_PRINT_SETTINGS };
  const paperProfile: ThermalPaperProfile =
    raw.paperProfile && raw.paperProfile in THERMAL_PROFILE_META
      ? raw.paperProfile
      : DEFAULT_THERMAL_PRINT_SETTINGS.paperProfile;

  // Lista de longitudes permitidas
  // NOTA CRÍTICA: "80mm" fue removido porque los usuarios lo seleccionaban confundiéndolo con el ancho del rollo (80mm),
  // lo cual forzaba un corte de página rígido a 80mm de alto, generando un salto en blanco en el medio de los componentes.
  // Cualquier valor "80mm" o inválido se normaliza automáticamente a "auto" (rollo continuo).
  const validLengths: ThermalLengthMode[] = ["auto", "100mm", "120mm", "150mm", "200mm"];
  const rawLength = String(raw.lengthMode || "");
  const lengthMode: ThermalLengthMode =
    rawLength === "80mm" || !validLengths.includes(rawLength as ThermalLengthMode)
      ? "auto"
      : (rawLength as ThermalLengthMode);

  return {
    paperProfile,
    lengthMode,
    marginMm: clamp(Number(raw.marginMm), 0, 6, DEFAULT_THERMAL_PRINT_SETTINGS.marginMm),
    offsetXMm: clamp(Number(raw.offsetXMm), -10, 10, DEFAULT_THERMAL_PRINT_SETTINGS.offsetXMm),
    offsetYMm: clamp(Number(raw.offsetYMm), -35, 15, DEFAULT_THERMAL_PRINT_SETTINGS.offsetYMm),
    scalePct: clamp(Number(raw.scalePct), 75, 130, DEFAULT_THERMAL_PRINT_SETTINGS.scalePct),
    highContrast: raw.highContrast !== undefined ? Boolean(raw.highContrast) : DEFAULT_THERMAL_PRINT_SETTINGS.highContrast,
  };
}

export function getStoredThermalPrintSettings(): ThermalPrintSettings {
  if (typeof window === "undefined") return { ...DEFAULT_THERMAL_PRINT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(THERMAL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THERMAL_PRINT_SETTINGS };
    return sanitizeThermalSettings(JSON.parse(raw) as Partial<ThermalPrintSettings>);
  } catch {
    return { ...DEFAULT_THERMAL_PRINT_SETTINGS };
  }
}

export function saveThermalPrintSettings(settings: ThermalPrintSettings): ThermalPrintSettings {
  const clean = sanitizeThermalSettings(settings);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THERMAL_SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignorar errores de cuota de almacenamiento
    }
  }
  return clean;
}

export function resetThermalPrintSettings(): ThermalPrintSettings {
  return saveThermalPrintSettings({ ...DEFAULT_THERMAL_PRINT_SETTINGS });
}

export function getThermalEffectiveContentMm(settings: ThermalPrintSettings): number {
  const profile = THERMAL_PROFILE_META[settings.paperProfile];
  return Math.max(40, Math.min(profile.contentWidthMm, profile.pageWidthMm - settings.marginMm * 2));
}

export function buildThermalPrintCss(settings: ThermalPrintSettings): string {
  const profile = THERMAL_PROFILE_META[settings.paperProfile];
  const contentWidthMm = getThermalEffectiveContentMm(settings);
  const scale = Math.max(0.75, Math.min(1.3, settings.scalePct / 100));
  const scaledInnerMm = (contentWidthMm / scale).toFixed(2);
  const isAutoLength = !settings.lengthMode || settings.lengthMode === "auto" || (settings.lengthMode as string) === "80mm";
  const heightRule = isAutoLength ? "auto" : settings.lengthMode;

  const offsetX = settings.offsetXMm || 0;
  const offsetY = settings.offsetYMm || 0;

  return `
    @page {
      size: ${profile.pageWidthMm}mm ${heightRule};
      margin: 0 !important;
      margin-top: 0mm !important;
      margin-bottom: 0mm !important;
      margin-left: 0mm !important;
      margin-right: 0mm !important;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: 100% !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }

      /* 1. Ocultar absolutamente todos los elementos en el body excepto los modales térmicos */
      body.thermal-80mm-print > *:not(#sati-thermal-print-modal-overlay):not(#thermal-print-modal-overlay) {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* 2. Ocultar elementos dentro del modal que no formen parte del ticket térmico */
      body.thermal-80mm-print * {
        visibility: hidden !important;
      }

      body.thermal-80mm-print #thermal-sticker-wrapper,
      body.thermal-80mm-print #thermal-sticker-wrapper * {
        visibility: visible !important;
      }

      /* 3. Aplanar contenedores de modal para evitar scroll o altura fantasma */
      #sati-thermal-print-modal-overlay,
      #thermal-print-modal-overlay {
        position: static !important;
        display: block !important;
        inset: auto !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
        backdrop-filter: none !important;
        filter: none !important;
        transform: none !important;
      }

      #sati-thermal-modal-card,
      #thermal-print-modal-card {
        position: static !important;
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }

      /* 4. Posicionar el comprobante en la parte superior exacta sin margen forzado ni saltos de página */
      body.thermal-80mm-print #thermal-sticker-wrapper {
        position: static !important;
        display: block !important;
        width: ${contentWidthMm}mm !important;
        max-width: ${contentWidthMm}mm !important;
        margin: 0 auto !important;
        margin-top: ${offsetY}mm !important;
        padding: 0 !important;
        padding-left: ${settings.marginMm}mm !important;
        padding-right: ${settings.marginMm}mm !important;
        overflow: visible !important;
        transform: ${offsetX !== 0 ? `translateX(${offsetX}mm)` : "none"} !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      body.thermal-80mm-print #thermal-sticker-80mm {
        display: block !important;
        width: ${scaledInnerMm}mm !important;
        max-width: none !important;
        margin: 0 !important;
        margin-top: 0 !important;
        padding: 0 !important;
        padding-top: 0 !important;
        border: 0 !important;
        zoom: ${scale};
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      /* Evitar que cualquier fondo oscuro o invertido queme el papel en impresoras térmicas */
      body.thermal-80mm-print #thermal-sticker-80mm *:not(svg):not(path):not(rect):not(line) {
        background: transparent !important;
        background-color: transparent !important;
        color: #000000 !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }

      body.thermal-80mm-print #thermal-sticker-80mm li {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      body.thermal-80mm-print #thermal-sticker-80mm > div:first-child {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }

      body.thermal-80mm-print #thermal-sticker-80mm h1 {
        margin-top: 0 !important;
        padding-top: 0 !important;
        line-height: 1.1 !important;
      }
    }
  `;
}
