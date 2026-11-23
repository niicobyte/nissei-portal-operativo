"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { ThermalLengthMode } from "@/lib/thermalPrintConfig";

export interface ThermalLengthOption {
  value: ThermalLengthMode;
  label: string;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

const THERMAL_LENGTH_OPTIONS: ThermalLengthOption[] = [
  {
    value: "auto",
    label: "Rollo continuo (Auto)",
    badge: "Recomendado",
    badgeColor: "bg-[#FFD23F] text-black border-black",
    description: "Corte dinámico según el comprobante",
  },
  {
    value: "120mm",
    label: "Etiqueta 120mm",
    badge: "Sticker",
    badgeColor: "bg-[#FAF6EE] text-black border-black",
    description: "Para rollos precortados de 120mm",
  },
  {
    value: "150mm",
    label: "Etiqueta 150mm",
    badge: "Sticker",
    badgeColor: "bg-[#FAF6EE] text-black border-black",
    description: "Para rollos precortados de 150mm",
  },
  {
    value: "200mm",
    label: "Etiqueta 200mm",
    badge: "Sticker",
    badgeColor: "bg-[#FAF6EE] text-black border-black",
    description: "Para rollos precortados de 200mm",
  },
];

interface ThermalLengthSelectProps {
  value: ThermalLengthMode;
  onChange: (value: ThermalLengthMode) => void;
  className?: string;
}

export function ThermalLengthSelect({
  value,
  onChange,
  className = "",
}: ThermalLengthSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption =
    THERMAL_LENGTH_OPTIONS.find((opt) => opt.value === value) ||
    THERMAL_LENGTH_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 rounded-lg border-2 border-black bg-[#FFFDF9] px-2.5 py-1.5 text-xs font-heading font-extrabold text-black outline-none shadow-[2px_2px_0px_#000] hover:bg-[#FAF6EE] transition-all cursor-pointer select-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
          isOpen ? "bg-[#FAF6EE]" : ""
        } ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-black shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[260px] sm:w-[290px] max-w-[calc(100vw-2rem)] rounded-xl border-2 border-black bg-[#FFFDF9] p-1.5 shadow-[4px_4px_0px_#000] space-y-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {THERMAL_LENGTH_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer select-none border ${
                  isSelected
                    ? "bg-black text-[#FFD23F] border-black shadow-[2px_2px_0px_#000]"
                    : "border-transparent text-black hover:bg-[#FFD23F] hover:border-black"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-heading font-extrabold truncate ${
                        isSelected ? "text-[#FFD23F]" : "text-black"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span
                        className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded border ${
                          isSelected
                            ? "bg-[#FFD23F] text-black border-black"
                            : `${opt.badgeColor}`
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p
                      className={`text-[10px] font-sans mt-0.5 truncate ${
                        isSelected ? "text-zinc-300 font-medium" : "text-zinc-600 font-bold"
                      }`}
                    >
                      {opt.description}
                    </p>
                  )}
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-[#FFD23F] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
