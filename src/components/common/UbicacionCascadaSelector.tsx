"use client";

import React, { useState, useEffect } from "react";
import { MapPin, ChevronRight, Check, Archive, Layers } from "lucide-react";

export type UbicacionMainType = "ESTANTE" | "MUEBLE";

export interface UbicacionParsed {
  main: UbicacionMainType | null;
  sub: string | null;
  leaf: string | null;
  formatted: string;
}

const ESTANTE_A_NUMBERS = ["1", "2", "3", "4", "5", "6", "7"];
const ESTANTE_B_NUMBERS = ["1", "2", "3", "4", "5", "6"];

const MUEBLE_OPTIONS: Record<"1" | "2" | "3", string[]> = {
  "1": ["Celulares", "Reparado", "Productos sin caja"],
  "2": ["Camaras & Lentes", "Cambio por nuevo", "Sin reparo"],
  "3": ["Otros"],
};

export function parseUbicacionProducto(raw?: string | null): UbicacionParsed {
  if (!raw) {
    return { main: null, sub: null, leaf: null, formatted: "" };
  }
  const clean = raw
    .replace(/^\|\|\s*/, "")
    .replace(/\s*\|\|$/, "")
    .trim();

  if (!clean) {
    return { main: null, sub: null, leaf: null, formatted: "" };
  }

  // Caso 1: Estante | Sin reparo
  if (/^Estantes?\s*\|\s*Sin\s*reparo$/i.test(clean)) {
    return {
      main: "ESTANTE",
      sub: "SIN_REPARO",
      leaf: null,
      formatted: "Estante | Sin reparo",
    };
  }

  // Caso 2: Estante | A1..A7 o Estante | B1..B6
  const estanteMatch = clean.match(/^Estantes?\s*\|\s*([AB])\s*-?\s*([1-7])$/i);
  if (estanteMatch) {
    const letter = estanteMatch[1].toUpperCase();
    const num = estanteMatch[2];
    return {
      main: "ESTANTE",
      sub: letter,
      leaf: num,
      formatted: `Estante | ${letter}${num}`,
    };
  }

  // Caso 3: Mueble 1 | Celulares, Mueble 2 | Camaras & Lentes, Mueble 3 | Otros
  const muebleMatch = clean.match(/^Muebles?\s*([123])\s*\|\s*(.+)$/i);
  if (muebleMatch) {
    const num = muebleMatch[1] as "1" | "2" | "3";
    const rawLeaf = muebleMatch[2].trim();
    const canonicalLeaf =
      MUEBLE_OPTIONS[num]?.find(
        (opt) => opt.toLowerCase() === rawLeaf.toLowerCase()
      ) || rawLeaf;
    return {
      main: "MUEBLE",
      sub: num,
      leaf: canonicalLeaf,
      formatted: `Mueble ${num} | ${canonicalLeaf}`,
    };
  }

  return {
    main: null,
    sub: null,
    leaf: null,
    formatted: clean,
  };
}

export function extractUbicacionFromText(mensaje?: string | null): string {
  if (!mensaje) return "";
  const match = mensaje.match(
    /\|\|\s*((?:Estantes?|Muebles?)\s*[^|]+\|[^|]+)\s*\|\|/i
  );
  if (match && match[1]) {
    return parseUbicacionProducto(match[1]).formatted;
  }
  return "";
}

interface UbicacionCascadaSelectorProps {
  value?: string;
  onChange: (newUbicacion: string) => void;
  disabled?: boolean;
}

export function UbicacionCascadaSelector({
  value = "",
  onChange,
  disabled = false,
}: UbicacionCascadaSelectorProps) {
  const parsed = parseUbicacionProducto(value);

  const [activeMain, setActiveMain] = useState<UbicacionMainType | null>(
    parsed.main
  );
  const [activeSub, setActiveSub] = useState<string | null>(parsed.sub);

  useEffect(() => {
    const next = parseUbicacionProducto(value);
    setActiveMain(next.main);
    setActiveSub(next.sub);
  }, [value]);

  const handleSelectEstanteLeaf = (letter: "A" | "B", num: string) => {
    if (disabled) return;
    const nextVal = `Estante | ${letter}${num}`;
    onChange(nextVal);
  };

  const handleSelectEstanteSinReparo = () => {
    if (disabled) return;
    setActiveMain("ESTANTE");
    setActiveSub("SIN_REPARO");
    onChange("Estante | Sin reparo");
  };

  const handleSelectMuebleLeaf = (muebleNum: "1" | "2" | "3", option: string) => {
    if (disabled) return;
    const nextVal = `Mueble ${muebleNum} | ${option}`;
    onChange(nextVal);
  };

  const handleClear = () => {
    if (disabled) return;
    setActiveMain(null);
    setActiveSub(null);
    onChange("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
        <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-zinc-600" />
          Ubicación del Producto (Estantes / Muebles)
        </span>
        <div className="flex items-center gap-2">
          {parsed.formatted ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs">
                <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>{parsed.formatted}</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={handleClear}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                Quitar ubicación
              </button>
            </>
          ) : (
            <span className="text-[11px] text-zinc-400 italic">
              Sin ubicación asignada (pase el cursor o toque para desplegar)
            </span>
          )}
        </div>
      </div>

      <div
        className="p-3.5 bg-white border border-slate-300 rounded-xl shadow-sm space-y-3"
        onMouseLeave={() => {
          if (parsed.main) {
            setActiveMain(parsed.main);
            setActiveSub(parsed.sub);
          }
        }}
      >
        {/* Contenedor Tipo Cascada en 3 Niveles */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
          {/* NIVEL 1: OPCIONES PRINCIPALES (Estantes / Muebles) */}
          <div className="sm:col-span-4 space-y-1.5">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 px-1">
              1. Sector Principal
            </span>
            <div className="space-y-1.5">
              {/* Opción Principal 1: Estantes */}
              <button
                type="button"
                disabled={disabled}
                onMouseEnter={() => {
                  if (disabled) return;
                  setActiveMain("ESTANTE");
                  if (activeMain !== "ESTANTE") {
                    setActiveSub(parsed.main === "ESTANTE" ? parsed.sub : "A");
                  }
                }}
                onClick={() => {
                  if (disabled) return;
                  setActiveMain("ESTANTE");
                  setActiveSub(
                    activeMain === "ESTANTE" && activeSub
                      ? activeSub
                      : parsed.main === "ESTANTE" && parsed.sub
                      ? parsed.sub
                      : "A"
                  );
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  activeMain === "ESTANTE"
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                    : parsed.main === "ESTANTE"
                    ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                    : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Estantes</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    activeMain === "ESTANTE" ? "translate-x-0.5 text-white" : "text-zinc-400"
                  }`}
                />
              </button>

              {/* Opción Principal 2: Muebles */}
              <button
                type="button"
                disabled={disabled}
                onMouseEnter={() => {
                  if (disabled) return;
                  setActiveMain("MUEBLE");
                  if (activeMain !== "MUEBLE") {
                    setActiveSub(parsed.main === "MUEBLE" ? parsed.sub : "1");
                  }
                }}
                onClick={() => {
                  if (disabled) return;
                  setActiveMain("MUEBLE");
                  setActiveSub(
                    activeMain === "MUEBLE" && activeSub
                      ? activeSub
                      : parsed.main === "MUEBLE" && parsed.sub
                      ? parsed.sub
                      : "1"
                  );
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  activeMain === "MUEBLE"
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                    : parsed.main === "MUEBLE"
                    ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                    : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>Muebles</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    activeMain === "MUEBLE" ? "translate-x-0.5 text-white" : "text-zinc-400"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* NIVEL 2: SUB-OPCIONES EN CASCADA */}
          <div className="sm:col-span-4 space-y-1.5 sm:border-l sm:border-zinc-200 sm:pl-2.5 min-h-[84px]">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 px-1">
              {activeMain === "ESTANTE"
                ? "2. Columna / Sección"
                : activeMain === "MUEBLE"
                ? "2. Nº de Mueble (1 al 3)"
                : "2. Sub-nivel"}
            </span>

            {!activeMain ? (
              <div className="h-[68px] flex items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-3 text-center">
                <span className="text-[11px] text-zinc-400">
                  Pase sobre <strong>Estantes</strong> o <strong>Muebles</strong>
                </span>
              </div>
            ) : activeMain === "ESTANTE" ? (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                {(["A", "B"] as const).map((col) => {
                  const isHoveredOrActive = activeSub === col;
                  const isSavedCol = parsed.main === "ESTANTE" && parsed.sub === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      disabled={disabled}
                      onMouseEnter={() => !disabled && setActiveSub(col)}
                      onClick={() => !disabled && setActiveSub(col)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isHoveredOrActive
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : isSavedCol
                          ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                          : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                      }`}
                    >
                      <span>Estante {col}</span>
                      <span className="flex items-center gap-1 text-[10px] font-mono opacity-85">
                        <span>1-{col === "A" ? "7" : "6"}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}

                {/* Sin reparo (sin tercer nivel) */}
                {(() => {
                  const isSelected =
                    parsed.main === "ESTANTE" && parsed.sub === "SIN_REPARO";
                  const isHovered = activeSub === "SIN_REPARO";
                  return (
                    <button
                      type="button"
                      disabled={disabled}
                      onMouseEnter={() => !disabled && setActiveSub("SIN_REPARO")}
                      onClick={handleSelectEstanteSinReparo}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : isHovered
                          ? "bg-zinc-800 text-white border-zinc-800"
                          : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                      }`}
                    >
                      <span>Sin reparo</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span className="text-[10px] font-mono opacity-75">
                          Directo
                        </span>
                      )}
                    </button>
                  );
                })()}
              </div>
            ) : (
              /* activeMain === "MUEBLE" -> Números del 1 al 3 */
              <div className="space-y-1.5 animate-in fade-in duration-150">
                {(["1", "2", "3"] as const).map((num) => {
                  const isHoveredOrActive = activeSub === num;
                  const isSavedMueble = parsed.main === "MUEBLE" && parsed.sub === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={disabled}
                      onMouseEnter={() => !disabled && setActiveSub(num)}
                      onClick={() => !disabled && setActiveSub(num)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isHoveredOrActive
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : isSavedMueble
                          ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                          : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                      }`}
                    >
                      <span>Mueble {num}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* NIVEL 3: DESPLIEGUE FINAL DE UBICACIÓN */}
          <div className="sm:col-span-4 space-y-1.5 sm:border-l sm:border-zinc-200 sm:pl-2.5 min-h-[84px]">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 px-1">
              {activeMain === "ESTANTE" && (activeSub === "A" || activeSub === "B")
                ? `3. Nivel de Estante ${activeSub} (1 al ${activeSub === "A" ? "7" : "6"})`
                : activeMain === "MUEBLE" && activeSub
                ? `3. Sector de Mueble ${activeSub}`
                : "3. Posición / Sector"}
            </span>

            {activeMain === "ESTANTE" && (activeSub === "A" || activeSub === "B") ? (
              <div className="grid grid-cols-4 gap-1.5 animate-in fade-in duration-150">
                {(activeSub === "A" ? ESTANTE_A_NUMBERS : ESTANTE_B_NUMBERS).map(
                  (num) => {
                    const isSelected =
                      parsed.main === "ESTANTE" &&
                      parsed.sub === activeSub &&
                      parsed.leaf === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          handleSelectEstanteLeaf(activeSub as "A" | "B", num)
                        }
                        className={`py-2 px-2 rounded-lg text-xs font-mono font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200"
                            : "bg-zinc-50 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300 text-zinc-800 border-zinc-200"
                        }`}
                        title={`Asignar Estante ${activeSub}${num}`}
                      >
                        <span>
                          {activeSub}
                          {num}
                        </span>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    );
                  }
                )}
              </div>
            ) : activeMain === "ESTANTE" && activeSub === "SIN_REPARO" ? (
              <div className="h-[68px] flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 text-center">
                <span className="text-xs font-bold text-emerald-900">
                  Estante · Sin reparo
                </span>
                <span className="text-[10px] text-emerald-700">
                  Sin numeración adicional (clic en &quot;Sin reparo&quot; para asignar)
                </span>
              </div>
            ) : activeMain === "MUEBLE" &&
              (activeSub === "1" || activeSub === "2" || activeSub === "3") ? (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                {MUEBLE_OPTIONS[activeSub].map((opt) => {
                  const isSelected =
                    parsed.main === "MUEBLE" &&
                    parsed.sub === activeSub &&
                    parsed.leaf?.toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        handleSelectMuebleLeaf(activeSub as "1" | "2" | "3", opt)
                      }
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-200"
                          : "bg-zinc-50 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300 text-zinc-800 border-zinc-200"
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-[68px] flex items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-3 text-center">
                <span className="text-[11px] text-zinc-400">
                  Seleccione una opción del paso 2
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
