export type ThermalPaperProfile = "80_72" | "80_76" | "58_48";
export type ThermalLengthMode = "auto" | "80mm" | "100mm" | "120mm" | "150mm";

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
  const validLengths: ThermalLengthMode[] = ["auto", "80mm", "100mm", "120mm", "150mm"];
  const lengthMode: ThermalLengthMode =
    raw.lengthMode && validLengths.includes(raw.lengthMode)
      ? raw.lengthMode
      : DEFAULT_THERMAL_PRINT_SETTINGS.lengthMode;

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
  const heightRule = settings.lengthMode === "auto" ? "auto" : settings.lengthMode;

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
        background: #ffffff !important;
      }

      /* 1. Ocultar absolutamente todos los elementos en la página */
      body.thermal-80mm-print * {
        visibility: hidden !important;
      }

      /* 2. Rescatar y hacer visibles EXCLUSIVAMENTE el contenedor térmico y sus hijos */
      body.thermal-80mm-print #thermal-sticker-wrapper,
      body.thermal-80mm-print #thermal-sticker-wrapper * {
        visibility: visible !important;
      }

      /* 3. Posicionar el comprobante en la parte superior exacta sin margen forzado */
      body.thermal-80mm-print #thermal-sticker-wrapper {
        position: absolute !important;
        left: 0 !important;
        top: ${offsetY}mm !important;
        right: 0 !important;
        width: ${contentWidthMm}mm !important;
        max-width: ${contentWidthMm}mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        padding-left: ${settings.marginMm}mm !important;
        padding-right: ${settings.marginMm}mm !important;
        overflow: visible !important;
        transform: ${offsetX !== 0 ? `translateX(${offsetX}mm)` : "none"} !important;
        z-index: 999999 !important;
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
