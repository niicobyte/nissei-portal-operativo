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

      {/* Estilos especiales para ultra negro y cabezales térmicos POS */}
      <style>{`
        /* Clase universal de negro puro y trazo nítido para impresión térmica */
        .thermal-pure-black {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
        .thermal-label {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          font-weight: 900 !important;
          opacity: 1 !important;
        }
        .thermal-value {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          font-weight: 900 !important;
          opacity: 1 !important;
        }
        .thermal-ultra-black {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          font-weight: 900 !important;
        }
        .thermal-ultra-black-title {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          font-weight: 900 !important;
        }
        .thermal-ultra-mode,
        .thermal-ultra-mode * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          font-weight: 900 !important;
        }
        @media print {
          /* En impresión térmica NADA debe usar tonos de gris ni filtros CSS (evita hojas en blanco) */
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
          .thermal-label {
            font-weight: 900 !important;
          }
          .thermal-value {
            font-weight: 900 !important;
          }
          .thermal-ultra-black {
            font-weight: 900 !important;
          }
          .thermal-ultra-black-title {
            font-weight: 900 !important;
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
                  Márgenes laterales (X):
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

            {/* Escala y Centrados X / Y */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-700">Escala:</span>
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
                  <span className="font-bold text-zinc-700">Posición (X):</span>
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
                />
              </div>

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
                  title="Desplaza el inicio verticalmente. Valores negativos (-15mm, -25mm) contrarrestan el avance en blanco de la impresora"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateThermalSetting("offsetYMm", -20)}
                    className="hover:text-zinc-900 underline cursor-pointer"
                  >
                    Subir -20mm
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

            {/* Tip operativo y solución para espacio arriba en 3nStar / POS-80 */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>¿Por qué la impresora deja espacio en blanco arriba? (Solución 3nStar / POS-80):</span>
              </div>
              <ul className="text-[10.5px] leading-relaxed list-disc list-inside space-y-1 text-amber-950">
                <li>
                  <strong>En la ventana de Chrome:</strong> Dejar <strong>Escala: 100%</strong> (si está en 85% se achica y deja margen vacío) y <strong>Márgenes: Ninguno</strong>.
                </li>
                <li>
                  <strong>Tamaño de papel en Chrome:</strong> Cambiar de <em>80(72.1) x 210 mm</em> a <strong>80 x Receipt</strong> o <strong>Continuous / Rollo</strong>. El tamaño <em>210 mm</em> es formato hoja fija y Windows le añade margen de cabecera obligatorio.
                </li>
                <li>
                  <strong>Compensar avance de cabezal:</strong> En impresoras 3nStar, la cuchilla física está 20mm arriba del cabezal. Podés usar <strong>Subir/Bajar (Y)</strong> en <strong>-15mm</strong> o <strong>-20mm</strong> para que el texto comience pegado al borde cortado.
                </li>
              </ul>
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
            className={`w-full border ${isUltraBlack ? "border-2 border-black" : "border border-dashed border-zinc-300"} bg-white p-3.5 text-black print:w-full print:max-w-none print:border-0 print:p-0 print:pt-0 print:m-0 print:mt-0 space-y-2.5 print:space-y-1.5 ${
              isUltraBlack ? "thermal-ultra-mode font-black" : ""
            }`}
            style={{
              zoom: thermalSettings.scalePct / 100,
            }}
          >
            {/* Encabezado */}
            <div className={`text-center ${isUltraBlack ? "border-b-[3px]" : "border-b-2"} border-black pb-2 print:pb-1 print:pt-0 print:mt-0`}>
              <h1 className={`text-lg uppercase tracking-tight text-black thermal-ultra-black-title print:pt-0 print:mt-0 print:leading-none ${isUltraBlack ? "text-xl font-black" : "font-black"}`}>
                Nissei Post-Venta
              </h1>
              <div className="mt-1 inline-block px-2.5 py-0.5 font-mono text-[10.5px] uppercase text-black font-black border border-black bg-white">
                {data.subtitulo || "COMPROBANTE DEL SERVICIO POST - VENTA NISSEI"}
              </div>
            </div>

            {/* Datos Principales */}
            <div className="text-[11.5px] space-y-2 font-mono text-black">
              <div className="flex justify-between items-center gap-2">
                <span className="thermal-label uppercase font-black">
                  Nº ORDEN:
                </span>
                <span className="text-[14px] thermal-ultra-black font-black">
                  #{data.idOrden}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="thermal-label uppercase font-black">
                  CÓDIGO PROD:
                </span>
                <span className="thermal-value font-black">
                  {data.codigoProducto || "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2 pt-0.5">
                <span className="thermal-label uppercase font-black shrink-0">
                  CLIENTE:
                </span>
                <span className="text-right break-words leading-tight thermal-value font-black">
                  {data.cliente || "Cliente"}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="thermal-label uppercase font-black shrink-0">
                  EQUIPO:
                </span>
                <span className="text-right break-words leading-tight thermal-value font-black">
                  {data.equipo || "Equipo"}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="thermal-label uppercase font-black">
                  Nº SERIE:
                </span>
                <span className="thermal-value font-black">
                  {data.serial || "S/N"}
                </span>
              </div>

              {data.tecnico && (
                <div className="flex justify-between items-center gap-2">
                  <span className="thermal-label uppercase font-black">
                    TÉCNICO:
                  </span>
                  <span className="thermal-value font-black">
                    {data.tecnico}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center gap-2">
                <span className="thermal-label uppercase font-black">
                  ESTADO:
                </span>
                <span className="uppercase thermal-ultra-black border-b-2 border-black pb-0.5 font-black">
                  {data.estado || "En Asignacion"}
                </span>
              </div>

              {data.accesorios && (
                <div className="border-t-2 border-black border-dashed pt-1.5 flex justify-between items-start gap-2">
                  <span className="thermal-label uppercase font-black shrink-0">
                    ACCESORIOS:
                  </span>
                  <span className="text-right break-words text-[11px] leading-tight thermal-value font-black">
                    {data.accesorios}
                  </span>
                </div>
              )}

              <div className="border-t-2 border-black border-dashed pt-1.5">
                <span className="block mb-1 uppercase thermal-label font-black">
                  INFORME TÉCNICO:
                </span>
                <p className="text-[11px] font-mono leading-snug whitespace-pre-wrap break-words thermal-value font-black">
                  {data.informeTecnico || "Sin observaciones."}
                </p>
              </div>
            </div>

            {/* Pie de comprobante */}
            <div className="border-t-2 border-black pt-1.5 text-center text-[9.5px] font-mono text-black uppercase">
              <span className="thermal-label font-black">
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
