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
        <span className="text-black font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-black" />
          Ubicación del Producto (Estantes / Muebles)
        </span>
        <div className="flex items-center gap-2">
          {parsed.formatted ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-[#FFD23F] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                <MapPin className="w-3 h-3 text-black shrink-0" />
                <span>{parsed.formatted}</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={handleClear}
                className="text-xs font-heading font-bold text-[#E76F51] hover:underline cursor-pointer"
              >
                Quitar ubicación
              </button>
            </>
          ) : (
            <span className="text-[11px] font-mono text-neutral-600 font-semibold italic">
              Sin ubicación asignada (pase el cursor o toque para desplegar)
            </span>
          )}
        </div>
      </div>

      <div
        className="p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]"
        onMouseLeave={() => {
          if (parsed.main) {
            setActiveMain(parsed.main);
            setActiveSub(parsed.sub);
          }
        }}
      >
        {/* Contenedor Tipo Cascada en 3 Columnas Perfectamente Alineadas */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
          {/* NIVEL 1: OPCIONES PRINCIPALES (Estantes / Muebles) */}
          <div className="sm:col-span-4 flex flex-col">
            <div className="h-5 flex items-center mb-1.5 px-1">
              <span className="block text-xs font-mono font-bold uppercase tracking-wider text-black truncate whitespace-nowrap">
                1. Sector Principal
              </span>
            </div>
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
                className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-heading font-extrabold border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                  activeMain === "ESTANTE"
                    ? "bg-black text-[#FFD23F]"
                    : parsed.main === "ESTANTE"
                    ? "bg-[#2A9D8F] text-white"
                    : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Estantes</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    activeMain === "ESTANTE" ? "translate-x-0.5 text-[#FFD23F]" : "text-black"
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
                className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-heading font-extrabold border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                  activeMain === "MUEBLE"
                    ? "bg-black text-[#FFD23F]"
                    : parsed.main === "MUEBLE"
                    ? "bg-[#2A9D8F] text-white"
                    : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>Muebles</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    activeMain === "MUEBLE" ? "translate-x-0.5 text-[#FFD23F]" : "text-black"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* NIVEL 2: SUB-OPCIONES EN CASCADA */}
          <div className="sm:col-span-4 flex flex-col sm:border-l-2 sm:border-black sm:pl-3">
            <div className="h-5 flex items-center mb-1.5 px-1">
              <span className="block text-xs font-mono font-bold uppercase tracking-wider text-black truncate whitespace-nowrap">
                {activeMain === "ESTANTE"
                  ? "2. Columna / Sección"
                  : activeMain === "MUEBLE"
                  ? "2. Nº de Mueble"
                  : "2. Sub-nivel"}
              </span>
            </div>

            {!activeMain ? (
              <div className="h-[78px] flex items-center justify-center rounded-lg border-2 border-dashed border-black bg-[#FFFDF9] px-3 text-center">
                <span className="text-xs font-mono font-bold text-neutral-700">
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
                      className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-heading font-extrabold border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                        isHoveredOrActive
                          ? "bg-black text-[#FFD23F]"
                          : isSavedCol
                          ? "bg-[#2A9D8F] text-white"
                          : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                      }`}
                    >
                      <span className="truncate">Estante {col}</span>
                      <span className="flex items-center gap-1 text-[10px] font-mono opacity-85 shrink-0">
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
                      className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-heading font-extrabold border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                        isSelected
                          ? "bg-[#2A9D8F] text-white"
                          : isHovered
                          ? "bg-black text-[#FFD23F]"
                          : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                      }`}
                    >
                      <span className="truncate">Sin reparo</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono opacity-75 shrink-0">
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
                      className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-heading font-extrabold border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                        isHoveredOrActive
                          ? "bg-black text-[#FFD23F]"
                          : isSavedMueble
                          ? "bg-[#2A9D8F] text-white"
                          : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
                      }`}
                    >
                      <span className="truncate">Mueble {num}</span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* NIVEL 3: DESPLIEGUE FINAL DE UBICACIÓN */}
          <div className="sm:col-span-4 flex flex-col sm:border-l-2 sm:border-black sm:pl-3">
            <div className="h-5 flex items-center mb-1.5 px-1">
              <span className="block text-xs font-mono font-bold uppercase tracking-wider text-black truncate whitespace-nowrap">
                {activeMain === "ESTANTE" && (activeSub === "A" || activeSub === "B")
                  ? `3. Nivel Estante ${activeSub}`
                  : activeMain === "MUEBLE" && activeSub
                  ? `3. Sector Mueble ${activeSub}`
                  : "3. Posición / Sector"}
              </span>
            </div>

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
                        className={`h-9 px-2 rounded-lg text-xs font-mono font-extrabold border-2 border-black transition-all cursor-pointer flex items-center justify-center gap-0.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                          isSelected
                            ? "bg-[#2A9D8F] text-white"
                            : "bg-[#FFFDF9] hover:bg-[#FFD23F] text-black"
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
              <div className="h-[78px] flex flex-col items-center justify-center rounded-lg border-2 border-black bg-[#2A9D8F]/15 px-3 text-center shadow-[2px_2px_0px_#000]">
                <span className="text-xs font-heading font-extrabold text-black">
                  Estante · Sin reparo
                </span>
                <span className="text-[10px] font-mono font-bold text-neutral-800">
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
                      className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-heading font-extrabold border-2 border-black transition-all cursor-pointer text-left shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                        isSelected
                          ? "bg-[#2A9D8F] text-white"
                          : "bg-[#FFFDF9] hover:bg-[#FFD23F] text-black"
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-[78px] flex items-center justify-center rounded-lg border-2 border-dashed border-black bg-[#FFFDF9] px-3 text-center">
                <span className="text-xs font-mono font-bold text-neutral-700">
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
