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

import {
  formatearNombreComponenteBasico as formatearNombreBasicoShared,
} from "@/data/montajesData";

export function formatearNombreComponenteBasico(raw: string, categoria?: string): string {
  return formatearNombreBasicoShared(raw, categoria);
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
        className="bg-[#FFFDF9] rounded-xl w-full max-w-lg p-5 border-3 border-black shadow-[6px_6px_0px_#000000] space-y-4 max-h-[92dvh] overflow-y-auto overscroll-contain print:w-full print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-0 print:shadow-none print:rounded-none print:bg-transparent print:static print:block print:min-h-0 print:h-auto"
      >
        {/* Cabecera del modal (oculta al imprimir) */}
        <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-3 print:hidden">
          <div className="min-w-0">
            <h2 className="text-base font-heading font-extrabold text-black flex items-center gap-2">
              <span className="p-1.5 bg-[#FFD23F] border border-black rounded shadow-[2px_2px_0px_#000]">
                <Printer className="w-4 h-4 text-black" />
              </span>
              <span>TICKET DE PRESUPUESTO PC</span>
            </h2>
            <p className="text-[11px] text-zinc-700 font-mono mt-1 font-bold">
              Formato Térmico {activeThermalMeta.shortLabel} ({activeThermalContentMm}mm) · Escala {thermalSettings.scalePct}%
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowThermalConfig((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer ${
                showThermalConfig
                  ? "bg-black text-white"
                  : "bg-[#FFFDF9] hover:bg-[#FAF6EE] text-black"
              }`}
              title="Calibrar papel, márgenes, escala y oscuridad de tinta"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Calibrar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-black hover:bg-black hover:text-white p-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-colors"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel de Calibración Desplegable (Neo-Brutalismo Retro) */}
        {showThermalConfig && (
          <div className="rounded-xl border-2 border-black bg-[#FAF6EE] p-4 space-y-3.5 text-xs shadow-[3px_3px_0px_#000] print:hidden animate-in fade-in">
            <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
              <div className="flex items-center gap-1.5 font-heading font-extrabold text-black uppercase tracking-wide text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
                <span>Calibración de Impresora Térmica</span>
              </div>
              <button
                type="button"
                onClick={handleResetThermal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-black bg-[#FFFDF9] hover:bg-[#FFD23F] border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
              >
                <RotateCcw className="w-3 h-3 text-black" />
                <span>Restablecer</span>
              </button>
            </div>

            {/* Perfil de Papel */}
            <div className="space-y-1.5">
              <span className="font-heading font-extrabold text-black block text-[11px] uppercase tracking-wider">
                Ancho de Rollo / Papel:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(["80_72", "80_76", "58_48"] as ThermalPaperProfile[]).map((prof) => {
                  const meta = THERMAL_PROFILE_META[prof];
                  if (!meta) return null;
                  const isSel = thermalSettings.paperProfile === prof;
                  return (
                    <button
                      key={prof}
                      type="button"
                      onClick={() => updateThermalSetting("paperProfile", prof)}
                      className={`p-2 rounded-lg border-2 border-black text-left cursor-pointer transition-all ${
                        isSel
                          ? "bg-black text-[#FFD23F] font-heading font-extrabold shadow-[2px_2px_0px_#000]"
                          : "bg-[#FFFDF9] text-black font-heading font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                      }`}
                    >
                      <span className="block font-mono text-[11px] font-bold">{meta.shortLabel}</span>
                      <span className={`block text-[10px] ${isSel ? "text-neutral-300" : "text-neutral-600"} font-mono`}>
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
                  <span className="font-heading font-bold text-black">Escala de impresión:</span>
                  <span className="font-mono font-black text-black">{thermalSettings.scalePct}%</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={120}
                  step={5}
                  value={thermalSettings.scalePct}
                  onChange={(e) => updateThermalSetting("scalePct", Number(e.target.value))}
                  className="w-full accent-black cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-heading font-bold text-black">Tinta Ultra Negra:</span>
                  <span className="font-mono font-bold text-black">
                    {isUltraBlack ? "Máxima" : "Estándar"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUltraBlack((prev) => !prev)}
                  className={`w-full py-1.5 px-2.5 rounded-lg border-2 border-black text-xs font-heading font-extrabold transition-all cursor-pointer ${
                    isUltraBlack
                      ? "bg-black text-[#FFD23F] shadow-[2px_2px_0px_#000]"
                      : "bg-[#FFFDF9] text-black shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
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
                  <span className="font-heading font-bold text-black">Subir/Bajar (Y):</span>
                  <span className="font-mono font-black text-black">
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
                  className="w-full accent-black cursor-pointer"
                  title="Ajuste vertical de inicio. Valores negativos (-15mm, -10mm) suben el texto hacia el inicio del rollo"
                />
                <div className="flex items-center justify-between text-[10px] pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", -15)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    -15mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", -10)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    -10mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", 0)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    0mm
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-heading font-bold text-black">Posición Horizontal (X):</span>
                  <span className="font-mono font-black text-black">
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
                  className="w-full accent-black cursor-pointer"
                  title="Ajuste horizontal fino (+/- mm). Mueve el ticket a la izquierda o derecha"
                />
                <div className="flex items-center justify-between text-[10px] pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetXMm", -4)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    -4mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetXMm", 0)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    0mm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetXMm", 4)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    +4mm
                  </button>
                </div>
              </div>
            </div>

            {/* Márgenes Laterales y Modo de Nombres */}
            <div className="space-y-2.5 pt-2 border-t-2 border-black border-dashed">
              <div className="space-y-1.5">
                <span className="font-heading font-extrabold text-black block text-[11px] uppercase tracking-wider">
                  Márgenes Laterales:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 2, 4].map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => updateThermalSetting("marginMm", mm)}
                      className={`py-1.5 rounded-lg border-2 border-black text-xs font-mono font-bold text-center cursor-pointer transition-all ${
                        thermalSettings.marginMm === mm
                          ? "bg-black text-[#FFD23F] shadow-[2px_2px_0px_#000]"
                          : "bg-[#FFFDF9] text-black shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                      }`}
                    >
                      {mm}mm
                    </button>
                  ))}
                </div>
              </div>

              {/* Formato de nombres de componentes en el ticket (Permanente Básico / Limpio) */}
              <div className="p-3 rounded-lg bg-[#FFFDF9] border-2 border-black shadow-[2px_2px_0px_#000] text-xs flex items-center justify-between">
                <div>
                  <span className="font-heading font-extrabold text-black block text-[11px]">Formato de Nombres en Ticket:</span>
                  <span className="text-[10px] text-neutral-700 font-medium">Muestra el modelo principal limpio y legible sin descripciones redundantes.</span>
                </div>
                <span className="font-mono font-bold text-white bg-[#2A9D8F] border border-black px-2 py-0.5 rounded text-[10px] whitespace-nowrap shadow-[1px_1px_0px_#000]">
                  ✓ Básico Permanente
                </span>
              </div>
            </div>

            {/* Tip POS-80 / 3nStar */}
            <div className="rounded-lg bg-[#FFD23F]/30 border-2 border-black p-3 text-xs text-black shadow-[2px_2px_0px_#000] space-y-1.5 font-sans">
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
            {/* Encabezado Térmico Limpio (Fondo Blanco, Borde Negro 2px - Previene Sobrecalentamiento Térmico) */}
            <div className={`text-center ${isUltraBlack ? "border-b-[3px]" : "border-b-2"} border-black pb-2 print:pb-1.5 space-y-1`}>
              <div className="border-2 border-black bg-white text-black px-2 py-1 font-heading text-[13px] font-black uppercase tracking-wider block w-full print:border-2 print:border-black print:bg-white print:text-black">
                NISSEI · TIENDA ASUNCION
              </div>
              <div className="inline-block px-2 py-0.5 font-mono text-[10px] uppercase text-black font-black border border-black bg-white">
                PRESUPUESTO DE ENSAMBLE DE PC
              </div>
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
                  const displayNombre = formatearNombreComponenteBasico(item.nombre, item.categoria);
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
            </div>

            {/* Bloque Destacado de Totales Neo-Brutalista con Doble Borde */}
            <div className="pt-2 border-t-2 border-black space-y-1 font-mono">
              <div className="border-4 border-double border-black p-2 bg-white space-y-1">
                <div className="flex justify-between items-center text-[13px] font-black font-heading">
                  <span>TOTAL (GS):</span>
                  <span className="text-[16px] font-black font-mono">
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
              </div>
              <div className="text-[9.5px] font-bold text-black/90 pt-0.5 text-center">
                (TC Dólar del Día: ₲ {data.tipoCambio.toLocaleString("es-PY")})
              </div>
            </div>

            {/* Pie Legal Obligatorio */}
            <div className="pt-2 border-t border-black text-center space-y-1 font-mono">
              <div className="border border-black p-1 bg-white">
                <p className="text-[10px] font-black uppercase leading-tight text-black">
                  *** PRESUPUESTO SUJETO A VARIACIÓN SEGÚN COTIZACIÓN ***
                </p>
              </div>
              <p className="text-[9px] font-bold text-black/80 leading-tight uppercase">
                Todos los componentes tienen 3 meses de garantía
              </p>
            </div>

          </div>
        </div>

        {/* Botones de Acción del Modal */}
        <div className="pt-3 border-t-2 border-black flex items-center justify-end gap-2.5 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border-2 border-black rounded-lg text-xs font-bold text-black bg-[#FAF6EE] hover:bg-[#F4EFE6] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-[#FFD23F] hover:bg-[#FACC15] text-black border-2 border-black rounded-lg text-xs font-heading font-extrabold flex items-center gap-2 shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-black" />
            <span>Imprimir Ticket Térmico</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
