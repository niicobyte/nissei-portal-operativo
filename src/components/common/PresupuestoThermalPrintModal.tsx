"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  SlidersHorizontal,
  RotateCcw,
  X,
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
  const [thermalSettings, setThermalSettings] = useState<ThermalPrintSettings>(
    DEFAULT_THERMAL_PRINT_SETTINGS
  );
  const [showThermalConfig, setShowThermalConfig] = useState(false);
  const [isUltraBlack, setIsUltraBlack] = useState(true);

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 print:p-0 print:bg-white print:static">
      <style>{buildThermalPrintCss(thermalSettings)}</style>

      <style>{`
        #thermal-sticker-80mm {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
        @media print {
          body.thermal-80mm-print,
          body.thermal-80mm-print #thermal-sticker-80mm,
          body.thermal-80mm-print #thermal-sticker-80mm * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            border-color: #000000 !important;
            opacity: 1 !important;
            text-shadow: none !important;
            filter: none !important;
          }
          .thermal-ultra-mode,
          .thermal-ultra-mode * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            font-weight: 900 !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 border border-zinc-200 max-h-[92dvh] overflow-y-auto overscroll-contain print:w-auto print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-0 print:shadow-none print:rounded-none">
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
                {(["80_72", "80_68", "58_48"] as ThermalPaperProfile[]).map((prof) => {
                  const meta = THERMAL_PROFILE_META[prof];
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

            {/* Escala y Calibración Y */}
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
                PRESUPUESTO DE COMPUTADORA
              </p>
              <div className="mt-1 inline-block px-2 py-0.5 font-mono text-[9px] uppercase font-black border border-black bg-white">
                COTIZACIÓN ESTRICTA NISSEI.COM/PY
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
                {data.items.map((item, idx) => (
                  <div key={idx} className="text-[11px] font-mono leading-tight space-y-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-black text-black line-clamp-2">
                        {item.nombre}
                      </span>
                      <span className="font-black text-black shrink-0 whitespace-nowrap">
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
                ))}
              </div>
            </div>

            {/* Servicio de Montaje */}
            <div className="pt-2 border-t border-dashed border-black text-[11px] font-mono space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase">
                  MONTAJE &amp; QA:
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
                Garantía oficial de 3 meses en componentes · Verificación de stock sujeta a disponibilidad física
              </p>
              <p className="text-[9px] font-bold text-black pt-0.5">
                https://nissei.com/py/
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
}
