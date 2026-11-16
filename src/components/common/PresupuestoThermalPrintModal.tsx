"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  SlidersHorizontal,
  RotateCcw,
  X,
  Info,
} from "lucide-react";
import {
  ThermalPrintSettings,
  ThermalPaperProfile,
  DEFAULT_THERMAL_PRINT_SETTINGS,
  THERMAL_PROFILE_META,
  getStoredThermalPrintSettings,
  saveThermalPrintSettings,
  resetThermalPrintSettings,
  getThermalEffectiveContentMm,
  buildThermalPrintCss,
} from "@/lib/thermalPrintConfig";

export interface PresupuestoThermalItem {
  sku: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  precioUnitarioPyg: number;
  subtotalPyg: number;
}

export interface PresupuestoThermalData {
  vendedor?: string;
  areaVendedor?: string;
  cliente?: string;
  items: PresupuestoThermalItem[];
  servicioMontajeNombre?: string;
  servicioMontajePyg: number;
  totalPyg: number;
  totalUsd: number;
  tipoCambio: number;
  consumoTotalWatts?: number;
  fuenteRecomendadaWatts?: number;
  fecha?: string;
}

export function formatearNombreComponenteBasico(raw: string, categoria?: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Caso especial cooler de fábrica
  if (/cooler\s+de\s+f[aá]brica/i.test(s) || /stock-cooler/i.test(s)) {
    return "Cooler de Fábrica (Stock)";
  }

  // 1. CPU: AMD Ryzen o Intel Core
  if (categoria === "PROCESADOR" || /Ryzen|Intel|Core\s+i|Core\s+Ultra/i.test(s)) {
    const cpuIntel = s.match(/(Intel\s+Core\s+(?:Ultra\s+)?[iI][3579]-\w+|\bIntel\s+Core\s+\w+-\w+)/i);
    if (cpuIntel) return cpuIntel[1];
    const cpuRyzen = s.match(/(AMD\s+Ryzen\s+[3579]\s+\w+|Ryzen\s+[3579]\s+\w+)/i);
    if (cpuRyzen) return cpuRyzen[1];
  }

  // Quitar prefijos comunes redundantes
  s = s.replace(
    /^(Procesador|Placa Madre|Memoria RAM|Placa de Video|Tarjeta Gr[aá]fica|Tarjeta de Video|Fuente de Alimentaci[oó]n|Fuente)\s+/i,
    ""
  );

  // 2. RAM: Ej "Adata GAMMIX D35 8GB DDR4 3200MHz" o "Adata 16GB DDR5 5600MHz"
  if (categoria === "RAM" || (/DDR[45]/i.test(s) && /\b\d+\s*GB\b/i.test(s))) {
    const ddr = s.match(/DDR[45]/i)?.[0] || "";
    const cap = s.match(/\b\d+\s*GB\b/i)?.[0]?.replace(/\s+/, "") || "";
    const mhz = s.match(/\b\d{4}\s*MHz\b/i)?.[0]?.replace(/\s+/, "") || "";
    const marca = s.match(/\b(Adata|Corsair|Kingston|Fury|Crucial|G\.Skill|Teamgroup|Patriot)\b/i)?.[0] || "";
    const modelo = s.match(/\b(GAMMIX\s+D\d+|Lancer|Beast|Vengeance|Ripjaws|T-Force)\b/i)?.[0] || "";
    const res = `${marca} ${modelo} ${cap} ${ddr} ${mhz}`.replace(/\s+/g, " ").trim();
    if (res.length > 5) return res;
  }

  // 3. GPU: Ej "Palit GeForce RTX 3050 6GB" o "MSI GeForce RTX 4060 8GB"
  if (categoria === "GPU" || /GeForce|Radeon|RTX|GTX|RX\s*\d+/i.test(s)) {
    const gpuMatch = s.match(/(GeForce\s+RTX\s+\d+|GeForce\s+GTX\s+\d+|Radeon\s+RX\s+\d+\w*)/i);
    if (gpuMatch) {
      const marca = s.match(/\b(Palit|MSI|ASUS|Gigabyte|Zotac|PowerColor|Sapphire|ASRock|PNY)\b/i)?.[0] || "";
      const vram = s.match(/\b\d+\s*GB\b/i)?.[0]?.replace(/\s+/, "") || "";
      return `${marca} ${gpuMatch[1]} ${vram}`.replace(/\s+/g, " ").trim();
    }
  }

  // 4. SSD / Almacenamiento: Ej "SSD WD Green SN3000 500GB M.2"
  if (categoria === "ALMACENAMIENTO" || /SSD|NVMe|M\.2|Disco/i.test(s)) {
    const cap = s.match(/\b(\d+\s*(?:GB|TB))\b/i)?.[0]?.replace(/\s+/, "") || "";
    const marca = s.match(/\b(Western Digital|WD|Kingston|Samsung|Crucial|Adata|Lexar|Gigabyte)\b/i)?.[0] || "";
    const serie = s.match(/\b(Green|Blue|Black|Plus|Evo)\b/i)?.[0] || "";
    const modelSn = s.match(/\b(SN\d+|NV\d+|KC\d+|NM\d+)\b/i)?.[0] || "";
    const res = `SSD ${marca} ${serie} ${modelSn} ${cap} M.2`
      .replace(/Western Digital/i, "WD")
      .replace(/\s+/g, " ")
      .trim();
    if (res.length > 8) return res;
  }

  // 5. Placa Madre: Ej "ASUS TUF B760-PLUS DDR5 Wi-Fi"
  if (categoria === "PLACA_MADRE" || /\b[BAZXH]\d{3}[A-Z]*(?:-[A-Z0-9]+)?\b/i.test(s)) {
    const marca = s.match(/\b(ASUS|ASRock|Gigabyte|MSI|Biostar)\b/i)?.[0] || "";
    const serie = s.match(/\b(TUF|ROG|ProArt|Gaming|Steel Legend|Phantom|Eagle|AORUS|PRO)\b/i)?.[0] || "";
    const chipset = s.match(/\b([BAZXH]\d{3}[A-Z]*(?:-[A-Z0-9]+)?)\b/i)?.[0] || "";
    const wifi = /Wi-?Fi/i.test(s) ? "Wi-Fi" : "";
    const ddr = s.match(/DDR[45]/i)?.[0] || "";
    const res = `${marca} ${serie} ${chipset} ${ddr} ${wifi}`.replace(/\s+/g, " ").trim();
    if (res.length > 5) return res;
  }

  // 6. Fuentes: Ej "Fuente ASRock PRO-650B 650W 80+ Bronze"
  if (categoria === "FUENTE" || /\b\d{3,4}\s*W\b/i.test(s)) {
    const marca = s.match(/\b(ASRock|Gigabyte|Corsair|EVGA|MSI|Redragon|Cooler Master)\b/i)?.[0] || "";
    const modelo = s.match(/\b(PRO-[A-Z0-9]+|GP-[A-Z0-9]+|CX\d+|CV\d+|MAG|Smart)\b/i)?.[0] || "";
    const w = s.match(/\b\d{3,4}\s*W\b/i)?.[0]?.replace(/\s+/, "") || "";
    const cert = s.match(/80\s*PLUS\s*(Bronze|Gold|White|Silver|Platinum)?/i);
    const certStr = cert ? `80+ ${cert[1] || ""}`.trim() : "";
    return `Fuente ${marca} ${modelo} ${w} ${certStr}`.replace(/\s+/g, " ").trim();
  }

  // 7. Limpieza de relleno para otros productos
  return s
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*-\s*(Negro|Blanco|Black|White)$/i, "")
    .replace(/\s*LGA\s*\d+/gi, "")
    .replace(/\s*AM[45]/gi, "")
    .replace(/\s*\d+\s*N[uú]cleos.*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface PresupuestoThermalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PresupuestoThermalData;
}

export function PresupuestoThermalPrintModal({
  isOpen,
  onClose,
  data,
}: PresupuestoThermalPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const [useShortNames, setUseShortNames] = useState(true);
  const [thermalSettings, setThermalSettings] = useState<ThermalPrintSettings>(
    DEFAULT_THERMAL_PRINT_SETTINGS
  );
  const [showThermalConfig, setShowThermalConfig] = useState(false);
  const [isUltraBlack, setIsUltraBlack] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setThermalSettings(getStoredThermalPrintSettings());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("thermal-80mm-print");
    } else {
      document.body.classList.remove("thermal-80mm-print");
    }
    return () => {
      document.body.classList.remove("thermal-80mm-print");
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const updateThermalSetting = <K extends keyof ThermalPrintSettings>(
    key: K,
    val: ThermalPrintSettings[K]
  ) => {
    setThermalSettings((prev) => {
      const next = { ...prev, [key]: val };
      saveThermalPrintSettings(next);
      return next;
    });
  };

  const handleResetThermal = () => {
    const def = resetThermalPrintSettings();
    setThermalSettings(def);
  };

  const handlePrint = () => {
    saveThermalPrintSettings(thermalSettings);
    window.print();
  };

  const activeThermalMeta = THERMAL_PROFILE_META[thermalSettings.paperProfile];
  const activeThermalContentMm = getThermalEffectiveContentMm(thermalSettings);

  const fechaImpresion =
    data.fecha ||
    new Date().toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const modalContent = (
    <div
      id="thermal-print-modal-overlay"
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 print:p-0 print:m-0 print:bg-transparent print:static print:block print:min-h-0 print:h-auto print:w-full"
    >
      <style>{`
        @page {
          size: ${thermalSettings.paperProfile === "58_48" ? "58mm" : "80mm"} auto;
          margin: 0 !important;
          margin-top: 0mm !important;
          margin-bottom: 0mm !important;
          margin-left: 0mm !important;
          margin-right: 0mm !important;
        }

        #thermal-sticker-80mm {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          /* Ocultar absolutamente cualquier otro elemento de la página */
          body.thermal-80mm-print > *:not(#thermal-print-modal-overlay) {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Eliminar completamente el modal container del flujo y dejarlo plano */
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
            -webkit-backdrop-filter: none !important;
            filter: none !important;
            transform: none !important;
          }

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
            overflow: visible !important;
            filter: none !important;
            transform: none !important;
          }

          body.thermal-80mm-print {
            background: #ffffff !important;
          }

          /* El ticket inicia arriba de la primera página, centrado en el rollo */
          body.thermal-80mm-print #thermal-sticker-wrapper {
            position: relative !important;
            top: ${thermalSettings.offsetYMm}mm !important;
            left: 0 !important;
            right: 0 !important;
            width: ${activeThermalContentMm}mm !important;
            max-width: ${activeThermalContentMm}mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            padding-left: ${thermalSettings.marginMm}mm !important;
            padding-right: ${thermalSettings.marginMm}mm !important;
            overflow: visible !important;
            transform: ${thermalSettings.offsetXMm !== 0 ? `translateX(${thermalSettings.offsetXMm}mm)` : "none"} !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          body.thermal-80mm-print #thermal-sticker-wrapper,
          body.thermal-80mm-print #thermal-sticker-wrapper * {
            visibility: visible !important;
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            border-color: #000000 !important;
            opacity: 1 !important;
            text-shadow: none !important;
            filter: none !important;
          }

          body.thermal-80mm-print #thermal-sticker-80mm {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          body.thermal-80mm-print #thermal-sticker-80mm * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .thermal-ultra-mode,
          .thermal-ultra-mode * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            font-weight: 900 !important;
          }
        }
      `}</style>

      <div
        id="thermal-print-modal-card"
        className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 border border-zinc-200 max-h-[92dvh] overflow-y-auto overscroll-contain print:w-full print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-0 print:shadow-none print:rounded-none print:bg-transparent print:static print:block print:min-h-0 print:h-auto"
      >
        {/* Cabecera del modal (oculta al imprimir) */}
        <div className="flex items-start justify-between gap-2 border-b border-zinc-200 pb-3 print:hidden">
          <div className="min-w-0">
            <h2 className="text-base font-black text-zinc-900 flex items-center gap-2">
              <Printer className="w-4 h-4 text-zinc-700" />
              <span>Imprimir Ticket de Presupuesto</span>
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Formato Térmico {activeThermalMeta.shortLabel} ({activeThermalContentMm}mm) · {thermalSettings.scalePct}%
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowThermalConfig((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                showThermalConfig
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                  : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300"
              }`}
              title="Calibrar papel, márgenes, escala y oscuridad de tinta"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Calibrar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-900 p-1.5 rounded-xl hover:bg-zinc-100 cursor-pointer transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel de Calibración Desplegable */}
        {showThermalConfig && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 space-y-3.5 text-xs print:hidden animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-800">
                <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
                <span>Calibración de Impresora Térmica</span>
              </div>
              <button
                type="button"
                onClick={handleResetThermal}
                className="text-[11px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-semibold cursor-pointer underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            </div>

            {/* Perfil de Papel */}
            <div className="space-y-1.5">
              <span className="font-bold text-zinc-700 block">Ancho de Rollo / Papel:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["80_72", "80_76", "58_48"] as ThermalPaperProfile[]).map((prof) => {
                  const meta = THERMAL_PROFILE_META[prof];
                  if (!meta) return null;
                  const isSel = thermalSettings.paperProfile === prof;
                  return (
                    <button
                      key={prof}
                      type="button"
                      onClick={() => updateThermalSetting("paperProfile", prof)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        isSel
                          ? "bg-zinc-900 text-white border-zinc-900 font-bold shadow-xs"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <span className="block font-mono text-[11px] font-bold">{meta.shortLabel}</span>
                      <span className={`block text-[10px] ${isSel ? "text-zinc-300" : "text-zinc-500"}`}>
                        {meta.contentWidthMm}mm útil
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escala y Calibración Y / X */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Escala de impresión:</span>
                  <span className="font-mono font-bold text-zinc-900">{thermalSettings.scalePct}%</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={120}
                  step={5}
                  value={thermalSettings.scalePct}
                  onChange={(e) => updateThermalSetting("scalePct", Number(e.target.value))}
                  className="w-full accent-zinc-900 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Tinta Ultra Negra:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {isUltraBlack ? "Máxima" : "Estándar"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUltraBlack((prev) => !prev)}
                  className={`w-full py-1 px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                    isUltraBlack
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-700 border-zinc-200"
                  }`}
                >
                  {isUltraBlack ? "✓ Negro Intenso ON" : "Desactivado"}
                </button>
              </div>
            </div>

            {/* Ajuste Fino de Ejes: Vertical (Y) y Horizontal (X) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Subir/Bajar (Y):</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {thermalSettings.offsetYMm > 0 ? `+${thermalSettings.offsetYMm}` : thermalSettings.offsetYMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={15}
                  step={1}
                  value={thermalSettings.offsetYMm}
                  onChange={(e) => updateThermalSetting("offsetYMm", Number(e.target.value))}
                  className="w-full accent-zinc-900 cursor-pointer"
                  title="Ajuste vertical de inicio. Valores negativos (-15mm, -10mm) suben el texto hacia el inicio del rollo"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", -15)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    -15mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", -10)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    -10mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", 0)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    0mm
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Posición Horizontal (X):</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {thermalSettings.offsetXMm > 0 ? `+${thermalSettings.offsetXMm}` : thermalSettings.offsetXMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={-8}
                  max={8}
                  step={0.5}
                  value={thermalSettings.offsetXMm}
                  onChange={(e) => updateThermalSetting("offsetXMm", Number(e.target.value))}
                  className="w-full accent-zinc-900 cursor-pointer"
                  title="Ajuste horizontal fino (+/- mm). Mueve el ticket a la izquierda o derecha"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetXMm", -4)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    -4mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetXMm", 0)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    0mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetXMm", 4)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    +4mm
                  </button>
                </div>
              </div>
            </div>

            {/* Márgenes Laterales y Modo de Nombres */}
            <div className="space-y-2 pt-1 border-t border-zinc-200">
              <div className="space-y-1">
                <span className="font-bold text-zinc-700 block text-[11px]">Márgenes Laterales:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 2, 4].map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => updateThermalSetting("marginMm", mm)}
                      className={`py-1 rounded-lg border text-[11px] font-bold text-center cursor-pointer transition-colors ${
                        thermalSettings.marginMm === mm
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {mm}mm
                    </button>
                  ))}
                </div>
              </div>

              {/* Formato de nombres de componentes en el ticket */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Formato de Nombres en Ticket:</span>
                  <span className="font-mono font-bold text-zinc-900 text-[10px]">
                    {useShortNames ? "Básico / Limpio" : "Descripción Completa"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUseShortNames(true)}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold text-center cursor-pointer transition-all ${
                      useShortNames
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    ✓ Básico (ej: Ryzen 5 7900X)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseShortNames(false)}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold text-center cursor-pointer transition-all ${
                      !useShortNames
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    Descripción Web Completa
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  {useShortNames
                    ? "Limpio y directo: Muestra el modelo principal sin datos redundantes de socket ni núcleos."
                    : "Muestra la descripción completa del producto sin recortar nada con puntos (...)."}
                </p>
              </div>
            </div>

            {/* Tip POS-80 / 3nStar */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[10.5px] text-amber-900 leading-tight space-y-1">
              <div className="flex items-center gap-1 font-bold">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Configuración recomendada para POS-80 / Térmica:</span>
              </div>
              <p className="text-amber-950">
                En la ventana de impresión de Chrome/Edge: dejar <strong>Márgenes: Ninguno</strong> y <strong>Escala: 100%</strong>. Si tu impresora lo admite en Tamaño de papel, seleccioná <strong>80 x Receipt</strong> o <strong>Continuous</strong> para que no pagine a hojas de 210mm.
              </p>
            </div>
          </div>
        )}

        {/* Vista Previa del Ticket Térmico */}
        <div
          id="thermal-sticker-wrapper"
          className="mx-auto print:mx-auto transition-all"
          style={{
            maxWidth:
              thermalSettings.paperProfile === "58_48"
                ? "230px"
                : thermalSettings.paperProfile === "80_72"
                ? "290px"
                : "310px",
            transform:
              thermalSettings.offsetXMm !== 0
                ? `translateX(${thermalSettings.offsetXMm}mm)`
                : undefined,
          }}
        >
          <div
            id="thermal-sticker-80mm"
            className={`w-full border ${
              isUltraBlack ? "border-2 border-black" : "border border-dashed border-zinc-300"
            } bg-white p-3.5 text-black print:w-full print:max-w-none print:border-0 print:p-0 print:pt-0 print:m-0 print:mt-0 space-y-2 print:space-y-1.5 ${
              isUltraBlack ? "thermal-ultra-mode font-black" : ""
            }`}
            style={{
              zoom: thermalSettings.scalePct / 100,
            }}
          >
            {/* Encabezado NISSEI */}
            <div className={`text-center ${isUltraBlack ? "border-b-[3px]" : "border-b-2"} border-black pb-2 print:pb-1`}>
              <h1 className="text-xl uppercase tracking-wider font-black text-black">
                NISSEI
              </h1>
              <p className="text-[10px] font-mono tracking-tight font-bold text-black uppercase">
                PRESUPUESTO DE MONTAJE
              </p>
            </div>

            {/* Metadatos: Vendedor, Cliente, Fecha */}
            <div className="text-[11px] font-mono space-y-0.5 text-black border-b border-dashed border-black pb-2">
              <div className="flex justify-between">
                <span className="font-bold">FECHA/HORA:</span>
                <span className="font-bold">{fechaImpresion}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">VENDEDOR:</span>
                <span className="font-black truncate max-w-[170px]">
                  {data.vendedor || "Salón de Ventas"}
                </span>
              </div>
              {data.areaVendedor && (
                <div className="flex justify-between text-[10px]">
                  <span>ÁREA:</span>
                  <span className="font-bold">{data.areaVendedor}</span>
                </div>
              )}
              {data.cliente && (
                <div className="flex justify-between">
                  <span className="font-bold">CLIENTE:</span>
                  <span className="font-black truncate max-w-[170px]">{data.cliente}</span>
                </div>
              )}
            </div>

            {/* Detalle de Componentes */}
            <div className="space-y-1 pt-0.5">
              <div className="flex justify-between text-[10px] font-mono font-black border-b border-black pb-0.5 uppercase">
                <span>COMPONENTE / SKU</span>
                <span>SUBTOTAL</span>
              </div>

              <div className="space-y-2 pt-1">
                {data.items.map((item, idx) => {
                  const displayNombre = useShortNames
                    ? formatearNombreComponenteBasico(item.nombre, item.categoria)
                    : item.nombre;
                  return (
                    <div key={idx} className="text-[11px] font-mono leading-tight space-y-0.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-black text-black break-words whitespace-normal leading-snug flex-1">
                          {displayNombre}
                        </span>
                        <span className="font-black text-black shrink-0 whitespace-nowrap pl-1 text-right">
                          ₲ {item.subtotalPyg.toLocaleString("es-PY")}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-black/80 font-bold">
                        <span>
                          SKU #{item.sku} · Cant: {item.cantidad}
                        </span>
                        <span>
                          {item.cantidad > 1
                            ? `(₲ ${item.precioUnitarioPyg.toLocaleString("es-PY")} c/u)`
                            : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Servicio de Montaje */}
            <div className="pt-2 border-t border-dashed border-black text-[11px] font-mono space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase">
                  COSTO DE SERVICIO DEL MONTAJE:
                </span>
                <span className="font-black">
                  {data.servicioMontajePyg === 0
                    ? "¡BONIFICADO!"
                    : `₲ ${data.servicioMontajePyg.toLocaleString("es-PY")}`}
                </span>
              </div>

              {data.consumoTotalWatts ? (
                <div className="flex justify-between text-[10px] text-black/80 font-bold">
                  <span>CONSUMO EST.: {data.consumoTotalWatts}W</span>
                  <span>FUENTE REC.: {data.fuenteRecomendadaWatts || 500}W+</span>
                </div>
              ) : null}
            </div>

            {/* Totales */}
            <div className="pt-2 border-t-2 border-black space-y-1 font-mono">
              <div className="flex justify-between items-center text-[13px] font-black">
                <span>TOTAL (GS):</span>
                <span className="text-[15px] font-black">
                  ₲ {data.totalPyg.toLocaleString("es-PY")}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span>EQUIVALENTE EN USD:</span>
                <span className="font-black">
                  US${" "}
                  {data.totalUsd.toLocaleString("es-PY", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-[9.5px] font-bold text-black/80 pt-0.5">
                (T.C. Referencial: ₲ {data.tipoCambio.toLocaleString("es-PY")} · IVA Incluido)
              </div>
            </div>

            {/* Pie Legal Obligatorio */}
            <div className="pt-3 border-t border-black text-center space-y-1 font-mono">
              <div className="border border-black p-1.5 bg-white">
                <p className="text-[10.5px] font-black uppercase leading-tight text-black">
                  *** PRESUPUESTO SUJETO A VARIACIÓN SEGÚN COTIZACIÓN ***
                </p>
              </div>
              <p className="text-[9px] font-bold text-black/80 pt-1 leading-tight uppercase">
                Garantía oficial de 3 meses en componentes
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción del Modal */}
        <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ticket Térmico</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
