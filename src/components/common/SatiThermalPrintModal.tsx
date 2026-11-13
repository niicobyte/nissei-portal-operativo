import React, { useState, useEffect, useMemo } from "react";
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
  piePagina?: string;
  fechaIngreso?: string;
  fechaRecepcionReparacion?: string;
  recibidoListoRetiro?: boolean;
}

function parseSatiDate(rawDate?: string | null): Date | null {
  if (!rawDate) return null;
  const clean = rawDate.trim();

  // Formato DD/MM/YYYY o DD/MM/YYYY HH:mm
  const dmyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const d = new Date(year, month, day, hours, minutes);
    if (!isNaN(d.getTime())) return d;
  }

  // Formato ISO YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day, 12, 0);
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatToDmy(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function compute90DaysPolicy(params: {
  rawFechaIngreso?: string | null;
  rawFechaRecepcion?: string | null;
  recibidoListoRetiro?: boolean;
}): {
  fechaIngresoStr: string;
  fechaRetornoStr: string | null;
  fechaLimiteStr: string;
  diasTranscurridos: number;
  diasRestantes: number;
  estaVencido: boolean;
  esRetornoReparacion: boolean;
  mensajeInteligente: string;
} {
  const ingresoDate = parseSatiDate(params.rawFechaIngreso) || new Date();
  const retornoDate = parseSatiDate(params.rawFechaRecepcion);

  // Un equipo se considera retorno de taller si tiene fecha de retorno válida o marca de recibidoListoRetiro
  const esRetornoReparacion = Boolean(
    params.recibidoListoRetiro ||
    (retornoDate && retornoDate.getTime() > ingresoDate.getTime() + 24 * 60 * 60 * 1000)
  );

  // La fecha de referencia para el cliente rige desde que el equipo retornó disponible a la sucursal
  const fechaReferencia = esRetornoReparacion && retornoDate ? retornoDate : ingresoDate;
  const limiteDate = new Date(fechaReferencia.getTime() + 90 * 24 * 60 * 60 * 1000);

  const hoy = new Date();
  const diffTime = hoy.getTime() - fechaReferencia.getTime();
  const diasTranscurridos = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const diasRestantes = 90 - diasTranscurridos;
  const estaVencido = diasRestantes <= 0;

  let mensajeInteligente = "";
  if (esRetornoReparacion && retornoDate) {
    if (estaVencido) {
      mensajeInteligente = `⚠️ Plazo de 90 días vencido desde el retorno de taller (${formatToDmy(retornoDate)}). Remitir a depósito.`;
    } else {
      mensajeInteligente = `* El equipo estuvo en taller/repuesto. El plazo de 90 días para retiro rige desde su retorno listo (${formatToDmy(retornoDate)} · restan ${diasRestantes}d).`;
    }
  } else {
    if (estaVencido) {
      mensajeInteligente = `⚠️ Plazo de 90 días vencido desde ingreso (${formatToDmy(ingresoDate)}). Remitir a depósito.`;
    } else {
      mensajeInteligente = `* Plazo de guarda en ASU: 90 días (restan ${diasRestantes}d). Cumplido el plazo se remite al depósito.`;
    }
  }

  return {
    fechaIngresoStr: formatToDmy(ingresoDate),
    fechaRetornoStr: retornoDate ? formatToDmy(retornoDate) : null,
    fechaLimiteStr: formatToDmy(limiteDate),
    diasTranscurridos,
    diasRestantes,
    estaVencido,
    esRetornoReparacion,
    mensajeInteligente,
  };
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

  const policy = useMemo(
    () =>
      compute90DaysPolicy({
        rawFechaIngreso: data.fechaIngreso,
        rawFechaRecepcion: data.fechaRecepcionReparacion,
        recibidoListoRetiro: data.recibidoListoRetiro,
      }),
    [data.fechaIngreso, data.fechaRecepcionReparacion, data.recibidoListoRetiro]
  );

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
                  <option value="auto">Rollo continuo (Recomendado - Auto)</option>
                  <option value="120mm">Etiqueta 120mm (Stickers precortados)</option>
                  <option value="150mm">Etiqueta 150mm (Stickers precortados)</option>
                  <option value="200mm">Etiqueta 200mm (Stickers precortados)</option>
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

            {/* Tip operativo y solución para espacio arriba y saltos en 3nStar / POS-80 */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Solución a saltos en blanco y espacio arriba (3nStar / POS-80):</span>
              </div>
              <ul className="text-[10.5px] leading-relaxed list-disc list-inside space-y-1 text-amber-950">
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

              {/* Control de Permanencia & Plazo de 90 Días para Depósito */}
              <div className="border-t-2 border-black border-dashed pt-1.5 space-y-1">
                <div className="flex justify-between items-center text-[10.5px] font-mono">
                  <span className="thermal-label uppercase font-black shrink-0">
                    INGRESO ASU:
                  </span>
                  <span className="thermal-value font-black text-right">
                    {policy.fechaIngresoStr}
                  </span>
                </div>

                {policy.esRetornoReparacion && policy.fechaRetornoStr && (
                  <div className="flex justify-between items-center text-[10.5px] font-mono">
                    <span className="thermal-label uppercase font-black shrink-0">
                      RETORNO TALLER (ASU):
                    </span>
                    <span className="thermal-value font-black text-right border-b border-black">
                      {policy.fechaRetornoStr}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-[10.5px] font-mono">
                  <span className="thermal-label uppercase font-black shrink-0">
                    {policy.esRetornoReparacion
                      ? "LÍMITE DEPÓSITO (+90D RETORNO):"
                      : "LÍMITE DEPÓSITO (90 DÍAS):"}
                  </span>
                  <strong className="thermal-value font-black text-right border-b-2 border-black">
                    {policy.fechaLimiteStr}
                  </strong>
                </div>

                <div className="text-[9px] font-mono leading-tight text-center pt-0.5 text-black">
                  {policy.estaVencido ? (
                    <div className="border-2 border-black py-0.5 px-1 font-black">
                      ⚠️ PLAZO 90 DÍAS VENCIDO · REMITIR A DEPÓSITO
                    </div>
                  ) : (
                    <span className="thermal-label font-bold">
                      {policy.mensajeInteligente}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pie de comprobante */}
            <div className="border-t-2 border-black pt-1.5 text-center text-[9.5px] font-mono text-black uppercase">
              <span className="thermal-label font-black tracking-wide">
                {data.piePagina || "|| COMPROBANTE DE RECEPCION ||"}
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
