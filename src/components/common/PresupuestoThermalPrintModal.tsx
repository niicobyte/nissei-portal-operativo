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
  ThermalLengthMode,
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
              <span className="font-heading font-extrabold text-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
                Calibración de Impresora Térmica
              </span>
              <button
                type="button"
                onClick={handleResetThermal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-black bg-[#FFFDF9] hover:bg-[#FFD23F] border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
              >
                <RotateCcw className="w-3 h-3 text-black" />
                <span>Restablecer</span>
              </button>
            </div>

            {/* Ancho de papel */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">
                Ancho del rollo / cabezal:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(THERMAL_PROFILE_META) as ThermalPaperProfile[]).map((key) => {
                  const active = thermalSettings.paperProfile === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateThermalSetting("paperProfile", key)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-heading border-2 border-black text-center transition-all cursor-pointer ${
                        active
                          ? "bg-black text-[#FFD23F] font-extrabold shadow-[2px_2px_0px_#000]"
                          : "bg-[#FFFDF9] text-black font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                      }`}
                    >
                      {THERMAL_PROFILE_META[key].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Formato y Márgenes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">
                  Largo de corte:
                </label>
                <select
                  value={thermalSettings.lengthMode}
                  onChange={(e) =>
                    updateThermalSetting("lengthMode", e.target.value as ThermalLengthMode)
                  }
                  className="w-full rounded-lg border-2 border-black bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-black outline-none shadow-[2px_2px_0px_#000]"
                >
                  <option value="auto">Rollo continuo (Recomendado - Auto)</option>
                  <option value="120mm">Etiqueta 120mm (Stickers precortados)</option>
                  <option value="150mm">Etiqueta 150mm (Stickers precortados)</option>
                  <option value="200mm">Etiqueta 200mm (Stickers precortados)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-heading font-extrabold text-black uppercase tracking-wider">
                  Márgenes laterales (X):
                </label>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 4].map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => updateThermalSetting("marginMm", mm)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono border-2 border-black transition-all cursor-pointer ${
                        thermalSettings.marginMm === mm
                          ? "bg-black text-[#FFD23F] font-bold shadow-[2px_2px_0px_#000]"
                          : "bg-[#FFFDF9] text-black font-bold shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                      }`}
                    >
                      {mm}mm
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Escala y Centrados X / Y */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-heading font-bold text-black">Escala:</span>
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
                  <span className="font-heading font-bold text-black">Posición (X):</span>
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
                />
              </div>

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
                  title="Desplaza el inicio verticalmente. Valores negativos (-15mm, -25mm) contrarrestan el avance en blanco de la impresora"
                />
                <div className="flex items-center justify-between text-[10px] pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", -20)}
                    className="hover:text-black font-mono font-bold underline cursor-pointer text-neutral-800"
                  >
                    Subir -20mm
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
            </div>

            {/* Opción Bien Negro / Alto Contraste */}
            <div className="pt-2 border-t-2 border-black border-dashed">
              <label className="flex items-start gap-3 text-xs font-medium text-black cursor-pointer p-3 rounded-lg bg-[#FFFDF9] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FAF6EE] transition-colors">
                <input
                  type="checkbox"
                  checked={isUltraBlack}
                  onChange={(e) => {
                    updateThermalSetting("highContrast", e.target.checked);
                    setIsUltraBlack(e.target.checked);
                  }}
                  className="rounded border-2 border-black accent-black mt-0.5 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="font-heading font-extrabold text-black block text-xs">
                    Negro Intenso (Ultra Black / Cabezal térmico nítido)
                  </span>
                  <span className="text-[11px] text-neutral-800 leading-tight block mt-0.5 font-medium">
                    Aplica tinta negra pura (#000000), trazo engrosado y bordes sólidos de 2px para que la impresora térmica imprima bien oscuro y legible.
                  </span>
                </div>
              </label>
            </div>

            {/* Tip operativo y solución para espacio arriba y saltos en 3nStar / POS-80 */}
            <div className="rounded-lg bg-[#FFD23F]/30 border-2 border-black p-3 text-xs text-black shadow-[2px_2px_0px_#000] space-y-1.5 font-sans">
              <div className="flex items-center gap-1.5 font-heading font-extrabold text-black">
                <Info className="w-4 h-4 text-black shrink-0" />
                <span>Solución a saltos en blanco y espacio arriba (3nStar / POS-80):</span>
              </div>
              <ul className="text-[11px] leading-relaxed list-disc list-inside space-y-1 text-black font-medium">
                <li>
                  <strong>Evitar saltos en blanco en el medio:</strong> Dejá siempre <strong>Largo de corte: Rollo continuo (Auto)</strong>. Las etiquetas fijas cortan el comprobante a la mitad.
                </li>
                <li>
                  <strong>En la ventana de Chrome:</strong> Dejar <strong>Escala: 100%</strong> y <strong>Márgenes: Ninguno</strong>.
                </li>
                <li>
                  <strong>Tamaño de papel en Chrome:</strong> Cambiar de <em>80(72.1) x 210 mm</em> a <strong>80 x Receipt</strong> o <strong>Continuous / Rollo</strong> para evitar que Windows divida en hojas fijas de 210mm.
                </li>
                <li>
                  <strong>Compensar avance de cabezal:</strong> En impresoras 3nStar, podés usar <strong>Subir/Bajar (Y)</strong> en <strong>-10mm</strong> a <strong>-20mm</strong> para que el texto comience pegado al borde cortado.
                </li>
              </ul>
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
