import React, { useState, useEffect } from "react";
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

export interface SatiComprobanteData {
  idOrden: string;
  codigoProducto?: string;
  cliente?: string;
  equipo?: string;
  serial?: string;
  estado?: string;
  accesorios?: string;
  informeTecnico?: string;
  tecnico?: string;
  subtitulo?: string;
}

interface SatiThermalPrintModalProps {
  data: SatiComprobanteData;
  onClose: () => void;
}

export function SatiThermalPrintModal({
  data,
  onClose,
}: SatiThermalPrintModalProps) {
  const [thermalSettings, setThermalSettings] = useState<ThermalPrintSettings>(
    DEFAULT_THERMAL_PRINT_SETTINGS
  );
  const [showThermalConfig, setShowThermalConfig] = useState(false);

  useEffect(() => {
    setThermalSettings(getStoredThermalPrintSettings());
  }, []);

  // Activar la clase de impresión térmica en body mientras el modal esté montado
  useEffect(() => {
    document.body.classList.add("thermal-80mm-print");
    return () => {
      document.body.classList.remove("thermal-80mm-print");
    };
  }, []);

  const updateThermalSetting = <K extends keyof ThermalPrintSettings>(
    key: K,
    value: ThermalPrintSettings[K]
  ) => {
    setThermalSettings((prev) =>
      saveThermalPrintSettings({ ...prev, [key]: value })
    );
  };

  const activeThermalMeta = THERMAL_PROFILE_META[thermalSettings.paperProfile];
  const activeThermalContentMm = getThermalEffectiveContentMm(thermalSettings);

  const isUltraBlack = thermalSettings.highContrast;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 print:static print:inset-auto print:bg-transparent print:p-0 print:block animate-in fade-in">
      <style media="print">{buildThermalPrintCss(thermalSettings)}</style>

      {/* Estilos especiales para ultra negro y aislamiento en impresión térmica */}
      <style>{`
        .thermal-ultra-black {
          color: #000000 !important;
          -webkit-text-stroke: 0.35px #000000;
          font-weight: 800 !important;
        }
        .thermal-ultra-black-title {
          color: #000000 !important;
          -webkit-text-stroke: 0.6px #000000;
          font-weight: 900 !important;
        }
        @media print {
          .thermal-ultra-black {
            color: #000000 !important;
            -webkit-text-stroke: 0.4px #000000 !important;
            font-weight: 900 !important;
          }
          .thermal-ultra-black-title {
            color: #000000 !important;
            -webkit-text-stroke: 0.7px #000000 !important;
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
              <span>Imprimir Comprobante SATI</span>
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              {activeThermalMeta.shortLabel} ({activeThermalContentMm}mm útil) · {thermalSettings.scalePct}% · {isUltraBlack ? "Negro Intenso ON" : "Estándar"}
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

        {/* Panel Colapsable de Calibración de Impresora Térmica */}
        {showThermalConfig && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-3 text-xs print:hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <span className="font-extrabold text-zinc-900 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-700" />
                Calibración de Impresora Térmica
              </span>
              <button
                type="button"
                onClick={() => setThermalSettings(resetThermalPrintSettings())}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Restablecer
              </button>
            </div>

            {/* Ancho de papel */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-zinc-700">
                Ancho del rollo / cabezal:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(THERMAL_PROFILE_META) as ThermalPaperProfile[]).map((key) => {
                  const active = thermalSettings.paperProfile === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateThermalSetting("paperProfile", key)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border text-center transition-colors cursor-pointer ${
                        active
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {THERMAL_PROFILE_META[key].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Formato y Márgenes */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-zinc-700">
                  Largo de corte:
                </label>
                <select
                  value={thermalSettings.lengthMode}
                  onChange={(e) =>
                    updateThermalSetting("lengthMode", e.target.value as ThermalLengthMode)
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-900 outline-none focus:border-zinc-900"
                >
                  <option value="auto">Rollo continuo (Auto)</option>
                  <option value="100mm">Etiqueta 100mm</option>
                  <option value="120mm">Etiqueta 120mm</option>
                  <option value="150mm">Etiqueta 150mm</option>
                  <option value="80mm">Etiqueta 80mm</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-zinc-700">
                  Márgenes:
                </label>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 4].map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => updateThermalSetting("marginMm", mm)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                        thermalSettings.marginMm === mm
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {mm}mm
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Escala y Centrado */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Escala / Tamaño:</span>
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
                  <span className="font-bold text-zinc-700">Centrado horizontal (X):</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {thermalSettings.offsetXMm > 0 ? `+${thermalSettings.offsetXMm}` : thermalSettings.offsetXMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={-4}
                  max={4}
                  step={0.5}
                  value={thermalSettings.offsetXMm}
                  onChange={(e) => updateThermalSetting("offsetXMm", Number(e.target.value))}
                  className="w-full accent-zinc-900 cursor-pointer"
                />
              </div>
            </div>

            {/* Opción Bien Negro / Alto Contraste */}
            <div className="pt-1 border-t border-zinc-200">
              <label className="flex items-start gap-2.5 text-[11px] font-medium text-zinc-800 cursor-pointer p-2 rounded-lg bg-white border border-zinc-200 hover:border-zinc-400 transition-colors">
                <input
                  type="checkbox"
                  checked={thermalSettings.highContrast}
                  onChange={(e) => updateThermalSetting("highContrast", e.target.checked)}
                  className="rounded border-zinc-300 accent-zinc-900 mt-0.5 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="font-bold text-zinc-900 block">
                    Negro Intenso (Ultra Black / Cabezal térmico nítido)
                  </span>
                  <span className="text-[10px] text-zinc-500 leading-tight block mt-0.5">
                    Aplica tinta negra pura (#000000), trazo engrosado y bordes sólidos de 2px para que la impresora térmica imprima bien oscuro y legible.
                  </span>
                </div>
              </label>
            </div>

            {/* Tip operativo */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Configuración óptima de impresión:</span>
              </div>
              <p className="text-[10.5px] leading-snug">
                En la ventana de impresión deje <strong>Márgenes: Ninguno</strong> y <strong>Escala: 100%</strong>. Los ajustes calibrados aquí se guardan automáticamente para futuras impresiones.
              </p>
            </div>
          </div>
        )}

        {/* Área del Comprobante Calibrada */}
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
            className={`w-full border ${isUltraBlack ? "border-2 border-black" : "border border-dashed border-zinc-300"} bg-white p-3.5 text-black print:w-full print:max-w-none print:border-0 print:p-[0.5mm] space-y-2.5 ${
              isUltraBlack ? "contrast-150" : ""
            }`}
            style={{
              zoom: thermalSettings.scalePct / 100,
            }}
          >
            {/* Encabezado */}
            <div className={`text-center ${isUltraBlack ? "border-b-[3px]" : "border-b-2"} border-black pb-2`}>
              <h1 className={`text-lg uppercase tracking-tight text-black ${isUltraBlack ? "thermal-ultra-black-title text-xl" : "font-black"}`}>
                Nissei Post-Venta
              </h1>
              <div className={`mt-1 inline-block px-2.5 py-0.5 font-mono text-[10px] uppercase text-black ${
                isUltraBlack
                  ? "border border-black font-black bg-zinc-100"
                  : "bg-zinc-100 font-bold"
              }`}>
                {data.subtitulo || "COMPROBANTE DEL SERVICIO POST - VENTA NISSEI"}
              </div>
            </div>

            {/* Datos Principales */}
            <div className="text-[11px] space-y-1.5 font-mono text-black">
              <div className="flex justify-between items-center gap-2">
                <span className={isUltraBlack ? "thermal-ultra-black uppercase" : "text-zinc-600 font-semibold"}>
                  Nº ORDEN:
                </span>
                <span className={`text-[13px] ${isUltraBlack ? "thermal-ultra-black text-[14px]" : "font-black"}`}>
                  #{data.idOrden}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className={isUltraBlack ? "thermal-ultra-black uppercase" : "text-zinc-600 font-semibold"}>
                  CÓDIGO PROD:
                </span>
                <span className={isUltraBlack ? "thermal-ultra-black" : "font-bold"}>
                  {data.codigoProducto || "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2 pt-0.5">
                <span className={isUltraBlack ? "thermal-ultra-black uppercase shrink-0" : "text-zinc-600 font-semibold shrink-0"}>
                  CLIENTE:
                </span>
                <span className={`text-right break-words leading-tight ${isUltraBlack ? "thermal-ultra-black" : "font-bold"}`}>
                  {data.cliente || "Cliente"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className={isUltraBlack ? "thermal-ultra-black uppercase shrink-0" : "text-zinc-600 font-semibold shrink-0"}>
                  EQUIPO:
                </span>
                <span className={`text-right break-words leading-tight ${isUltraBlack ? "thermal-ultra-black" : "font-semibold"}`}>
                  {data.equipo || "Equipo"}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className={isUltraBlack ? "thermal-ultra-black uppercase" : "text-zinc-600 font-semibold"}>
                  Nº SERIE:
                </span>
                <span className={isUltraBlack ? "thermal-ultra-black" : "font-bold"}>
                  {data.serial || "S/N"}
                </span>
              </div>

              {data.tecnico && (
                <div className="flex justify-between items-center gap-2">
                  <span className={isUltraBlack ? "thermal-ultra-black uppercase" : "text-zinc-600 font-semibold"}>
                    TÉCNICO:
                  </span>
                  <span className={isUltraBlack ? "thermal-ultra-black" : "font-semibold"}>
                    {data.tecnico}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center gap-2">
                <span className={isUltraBlack ? "thermal-ultra-black uppercase" : "text-zinc-600 font-semibold"}>
                  ESTADO:
                </span>
                <span className={`uppercase ${isUltraBlack ? "thermal-ultra-black border-b border-black pb-0.5" : "font-black"}`}>
                  {data.estado || "En Asignacion"}
                </span>
              </div>

              {data.accesorios && (
                <div className={`border-t ${isUltraBlack ? "border-black border-dashed" : "border-zinc-300 border-dashed"} pt-1.5 flex justify-between items-start gap-2`}>
                  <span className={isUltraBlack ? "thermal-ultra-black uppercase shrink-0" : "text-zinc-600 font-semibold shrink-0"}>
                    ACCESORIOS:
                  </span>
                  <span className={`text-right break-words text-[10.5px] leading-tight ${isUltraBlack ? "thermal-ultra-black" : "font-semibold"}`}>
                    {data.accesorios}
                  </span>
                </div>
              )}

              <div className={`border-t ${isUltraBlack ? "border-black border-dashed" : "border-zinc-300 border-dashed"} pt-1.5`}>
                <span className={`block mb-0.5 uppercase ${isUltraBlack ? "thermal-ultra-black" : "text-zinc-600 font-bold"}`}>
                  INFORME TÉCNICO:
                </span>
                <p className={`text-[10.5px] font-sans leading-snug whitespace-pre-wrap break-words ${
                  isUltraBlack ? "thermal-ultra-black font-bold" : "text-zinc-800"
                }`}>
                  {data.informeTecnico || "Sin observaciones."}
                </p>
              </div>
            </div>

            {/* Pie de comprobante */}
            <div className={`border-t ${isUltraBlack ? "border-black" : "border-zinc-300 border-dashed"} pt-1.5 text-center text-[9px] font-mono text-black uppercase`}>
              <span className={isUltraBlack ? "thermal-ultra-black" : "font-semibold text-zinc-600"}>
                Comprobante oficial · Nissei SATI
              </span>
            </div>

          </div>
        </div>

        {/* Botones de acción inferiores (ocultos al imprimir) */}
        <div className="pt-3 border-t border-zinc-200 flex justify-between items-center print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-200 hover:border-zinc-400 rounded-xl text-xs font-semibold text-zinc-600 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprobante ({activeThermalMeta.pageWidthMm}mm)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
