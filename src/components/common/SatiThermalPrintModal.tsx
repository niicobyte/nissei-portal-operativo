import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  SlidersHorizontal,
  RotateCcw,
  X,
  Info,
} from "lucide-react";
import { ThermalBarcode128 } from "@/components/common/ThermalBarcode128";
import { ThermalLengthSelect } from "@/components/common/ThermalLengthSelect";
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
import { isTicketDanesa } from "@/data/recepcionCdeData";

export interface SatiComprobanteData {
  idOrden: string;
  codigoProducto?: string;
  cliente?: string;
  equipo?: string;
  serial?: string;
  estado?: string;
  accesorios?: string;
  ubicacion?: string;
  informeTecnico?: string;
  tecnico?: string;
  subtitulo?: string;
  piePagina?: string;
  fechaIngreso?: string;
  fechaRecepcionReparacion?: string;
  recibidoListoRetiro?: boolean;
  esDanesa?: boolean;
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
  autoPrint?: boolean;
}

export function SatiThermalPrintModal({
  data,
  onClose,
  autoPrint,
}: SatiThermalPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const [thermalSettings, setThermalSettings] = useState<ThermalPrintSettings>(
    DEFAULT_THERMAL_PRINT_SETTINGS
  );
  const [showThermalConfig, setShowThermalConfig] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Atajo de teclado: Enter imprime de inmediato, Escape cierra
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
          e.preventDefault();
          window.print();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Si se solicita autoPrint (impresión directa en 1 toque), disparar window.print()
  useEffect(() => {
    if (autoPrint && mounted) {
      const t = setTimeout(() => {
        window.print();
      }, 120);
      return () => clearTimeout(t);
    }
  }, [autoPrint, mounted]);

  const isDanesa = Boolean(
    data.esDanesa ?? (data.cliente ? isTicketDanesa(data.cliente) : false)
  );

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

  if (!mounted) return null;

  const modalContent = (
    <div
      id="sati-thermal-print-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 print:static print:inset-auto print:bg-transparent print:p-0 print:block animate-in fade-in"
    >
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

      <div
        id="sati-thermal-modal-card"
        className="bg-[#FFFDF9] rounded-xl w-full max-w-lg p-5 border-3 border-black shadow-[6px_6px_0px_#000000] space-y-4 max-h-[92dvh] overflow-y-auto overscroll-contain print:w-auto print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0 print:border-0 print:shadow-none print:rounded-none print:bg-white"
      >
        
        {/* Cabecera del modal (oculta al imprimir) */}
        <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-3 print:hidden">
          <div className="min-w-0">
            <h2 className="text-base font-heading font-extrabold text-black flex items-center gap-2">
              <span className="p-1.5 bg-[#FFD23F] border border-black rounded shadow-[2px_2px_0px_#000]">
                <Printer className="w-4 h-4 text-black" />
              </span>
              <span>COMPROBANTE TÉRMICO SATI</span>
            </h2>
            <p className="text-[11px] text-zinc-700 font-mono mt-1 font-bold">
              {activeThermalMeta.shortLabel} ({activeThermalContentMm}mm útil) · Escala {thermalSettings.scalePct}% · Barcode CODE128
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

        {/* Panel Colapsable de Calibración de Impresora Térmica (Neo-Brutalismo Retro) */}
        {showThermalConfig && (
          <div className="rounded-xl border-2 border-black bg-[#FAF6EE] p-4 space-y-3.5 text-xs shadow-[3px_3px_0px_#000] print:hidden animate-in fade-in">
            <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
              <span className="font-heading font-extrabold text-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
                Calibración de Impresora Térmica
              </span>
              <button
                type="button"
                onClick={() => setThermalSettings(resetThermalPrintSettings())}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-black bg-[#FFFDF9] hover:bg-[#FFD23F] border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
              >
                <RotateCcw className="w-3 h-3 text-black" />
                Restablecer
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
                <ThermalLengthSelect
                  value={thermalSettings.lengthMode}
                  onChange={(val) => updateThermalSetting("lengthMode", val)}
                />
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
                  checked={thermalSettings.highContrast}
                  onChange={(e) => updateThermalSetting("highContrast", e.target.checked)}
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
            {/* CÓDIGO DE BARRAS REAL CODE128 SUPERIOR (Exclusivo Recepción) */}
            <div className="text-center pt-0.5 pb-2 border-b-2 border-black bg-white print:border-b-2 print:border-black">
              <ThermalBarcode128 value={data.idOrden} height={40} width={1.8} displayValue={false} />
            </div>

            {/* Encabezado Térmico Limpio (Fondo Blanco, Borde Negro 2px - Previene Sobrecalentamiento Térmico) */}
            <div className={`text-center ${isUltraBlack ? "border-b-[3px]" : "border-b-2"} border-black pb-2 print:pb-1.5 print:pt-1 space-y-1`}>
              <div className="border-2 border-black bg-white text-black px-2 py-1 font-heading text-[13px] font-black uppercase tracking-wider block w-full print:border-2 print:border-black print:bg-white print:text-black">
                NISSEI · POST-VENTA CDE
              </div>
              <div className="inline-block px-2 py-0.5 font-mono text-[10px] uppercase text-black font-black border border-black bg-white">
                {data.subtitulo || "ORDEN DE SERVICIO TÉCNICO SATI"}
              </div>
            </div>

            {/* Datos Principales */}
            <div className="text-[11.5px] space-y-2 font-mono text-black">
              <div className="leading-snug">
                <span className="thermal-label uppercase font-black">
                  Nº ORDEN:
                </span>{" "}
                <strong className="text-[14px] thermal-ultra-black font-black">
                  #{data.idOrden}
                </strong>
              </div>

              <div className="leading-snug">
                <span className="thermal-label uppercase font-black">
                  CÓDIGO PROD:
                </span>{" "}
                <span className="thermal-value font-black">
                  {data.codigoProducto || "N/A"}
                </span>
              </div>

              {!isDanesa && (
                <div className="leading-snug break-words">
                  <span className="thermal-label uppercase font-black">
                    CLIENTE:
                  </span>{" "}
                  <span className="thermal-value font-black">
                    {data.cliente || "Cliente"}
                  </span>
                </div>
              )}

              <div className="leading-snug break-words">
                <span className="thermal-label uppercase font-black">
                  EQUIPO:
                </span>{" "}
                <span className="thermal-value font-black">
                  {data.equipo || "Equipo"}
                </span>
              </div>

              <div className="leading-snug">
                <span className="thermal-label uppercase font-black">
                  Nº SERIE:
                </span>{" "}
                <span className="thermal-value font-black">
                  {data.serial || "S/N"}
                </span>
              </div>

              {data.tecnico && (
                <div className="leading-snug">
                  <span className="thermal-label uppercase font-black">
                    TÉCNICO:
                  </span>{" "}
                  <span className="thermal-value font-black">
                    {data.tecnico}
                  </span>
                </div>
              )}

              {!isDanesa && (
                <div className="leading-snug">
                  <span className="thermal-label uppercase font-black">
                    ESTADO:
                  </span>{" "}
                  <span className="uppercase thermal-ultra-black border-b-2 border-black pb-0.5 font-black">
                    {data.estado || "En Asignacion"}
                  </span>
                </div>
              )}

              {data.accesorios && (
                <div className="border-t-2 border-black border-dashed pt-1.5">
                  <span className="block mb-1 uppercase thermal-label font-black">
                    ACCESORIOS:
                  </span>
                  <p className="text-[11px] font-mono leading-snug whitespace-pre-wrap break-words thermal-value font-black">
                    {data.accesorios}
                  </p>
                </div>
              )}

              {data.ubicacion && (
                <div className="border-t-2 border-black border-dashed pt-1.5 leading-snug">
                  <span className="thermal-label uppercase font-black">
                    UBICACIÓN:
                  </span>{" "}
                  <span className="thermal-value font-black">
                    {data.ubicacion}
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

              {/* Control de Permanencia & Plazo de 90 Días para Depósito (Solo Clientes Particulares) */}
              {!isDanesa && (
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
              )}
            </div>

            {/* Pie de comprobante (Solo Clientes Particulares) */}
            {!isDanesa && (
              <div className="border-t-2 border-black pt-1.5 text-center text-[9.5px] font-mono text-black uppercase">
                <span className="thermal-label font-black tracking-wide">
                  {data.piePagina || "|| COMPROBANTE DE RECEPCION ||"}
                </span>
              </div>
            )}


          </div>
        </div>

        {/* Botones de acción inferiores (ocultos al imprimir) */}
        <div className="pt-3 border-t-2 border-black flex justify-between items-center print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border-2 border-black rounded-lg text-xs font-bold text-black bg-[#FAF6EE] hover:bg-[#F4EFE6] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-[#FFD23F] hover:bg-[#FACC15] text-black border-2 border-black rounded-lg text-xs font-heading font-extrabold flex items-center gap-2 shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-black" />
            <span>Imprimir Comprobante ({activeThermalMeta.pageWidthMm}mm)</span>
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
