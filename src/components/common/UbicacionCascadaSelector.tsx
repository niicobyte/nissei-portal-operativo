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
    onChange(`Estante | ${letter}${num}`);
  };

  const handleSelectEstanteSinReparo = () => {
    if (disabled) return;
    setActiveMain("ESTANTE");
    setActiveSub("SIN_REPARO");
    onChange("Estante | Sin reparo");
  };

  const handleSelectMuebleLeaf = (muebleNum: "1" | "2" | "3", option: string) => {
    if (disabled) return;
    onChange(`Mueble ${muebleNum} | ${option}`);
  };

  const handleClear = () => {
    if (disabled) return;
    setActiveMain(null);
    setActiveSub(null);
    onChange("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-zinc-600" />
          Ubicación del Producto (Estantes / Muebles)
        </span>
        <div className="flex items-center gap-2">
          {parsed.formatted ? (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>{parsed.formatted}</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={handleClear}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                Quitar
              </button>
            </>
          ) : (
            <span className="text-[11px] text-zinc-400 italic">
              Sin ubicación (pase el cursor o toque para desplegar)
            </span>
          )}
        </div>
      </div>

      <div
        className="p-2.5 bg-white border border-slate-300 rounded-xl shadow-2xs space-y-2"
        onMouseLeave={() => {
          if (parsed.main) {
            setActiveMain(parsed.main);
            setActiveSub(parsed.sub);
          }
        }}
      >
        {/* NIVEL 1 + NIVEL 2 EN FLUJO HORIZONTAL COMPACTO */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Nivel 1: Estantes / Muebles */}
          <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeMain === "ESTANTE"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : parsed.main === "ESTANTE"
                  ? "bg-indigo-100 text-indigo-900"
                  : "text-zinc-700 hover:bg-zinc-200/70"
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Estantes</span>
              <ChevronRight className="w-3 h-3 opacity-75" />
            </button>

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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeMain === "MUEBLE"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : parsed.main === "MUEBLE"
                  ? "bg-indigo-100 text-indigo-900"
                  : "text-zinc-700 hover:bg-zinc-200/70"
              }`}
            >
              <Archive className="w-3.5 h-3.5 shrink-0" />
              <span>Muebles</span>
              <ChevronRight className="w-3 h-3 opacity-75" />
            </button>
          </div>

          {/* Nivel 2: Se despliega horizontalmente al lado */}
          {activeMain === "ESTANTE" && (
            <div className="inline-flex flex-wrap items-center gap-1 pl-1 border-l-2 border-zinc-200 animate-in fade-in duration-150">
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isHoveredOrActive
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : isSavedCol
                        ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                    }`}
                  >
                    <span>Estante {col}</span>
                    <ChevronRight className="w-3 h-3 opacity-80" />
                  </button>
                );
              })}

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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : isHovered
                        ? "bg-zinc-800 text-white border-zinc-800"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                    }`}
                  >
                    <span>Sin reparo</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })()}
            </div>
          )}

          {activeMain === "MUEBLE" && (
            <div className="inline-flex flex-wrap items-center gap-1 pl-1 border-l-2 border-zinc-200 animate-in fade-in duration-150">
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isHoveredOrActive
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : isSavedMueble
                        ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                    }`}
                  >
                    <span>Mueble {num}</span>
                    <ChevronRight className="w-3 h-3 opacity-80" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* NIVEL 3: OPCIONES FINALES EN UNA SOLA FILA HORIZONTAL */}
        {activeMain === "ESTANTE" && (activeSub === "A" || activeSub === "B") && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-dashed border-zinc-200 animate-in fade-in duration-150">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase mr-1">
              Nivel {activeSub}:
            </span>
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-200"
                        : "bg-zinc-50 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300 text-zinc-800 border-zinc-200"
                    }`}
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
        )}

        {activeMain === "MUEBLE" &&
          (activeSub === "1" || activeSub === "2" || activeSub === "3") && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-dashed border-zinc-200 animate-in fade-in duration-150">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase mr-1">
                Mueble {activeSub}:
              </span>
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
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-200"
                        : "bg-zinc-50 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300 text-zinc-800 border-zinc-200"
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
