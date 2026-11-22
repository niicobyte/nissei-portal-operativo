"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RotateCcw } from "lucide-react";
import { useClampedPopover } from "@/lib/popoverPosition";

interface CleanDatePickerProps {
  value: string; // "YYYY-MM-DD" o "DD/MM/YYYY" o ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  fullWidth?: boolean;
  align?: "left" | "right";
  format?: "YYYY-MM-DD" | "DD/MM/YYYY";
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function parseInputDate(str?: string): { year: number; month: number; day: number } | null {
  if (!str || !str.trim()) return null;
  const clean = str.trim();

  // Caso YYYY-MM-DD
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
    }
  }

  // Caso DD/MM/YYYY o DD / MM / YYYY
  if (clean.includes("/")) {
    const parts = clean.split("/").map((p) => p.trim());
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
    }
  }

  return null;
}

function formatDateString(
  year: number,
  month: number,
  day: number,
  targetFormat: "YYYY-MM-DD" | "DD/MM/YYYY"
): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  if (targetFormat === "DD/MM/YYYY") {
    return `${dd}/${mm}/${year}`;
  }
  return `${year}-${mm}-${dd}`;
}

export function CleanDatePicker({
  value,
  onChange,
  placeholder = "DD / MM / AAAA",
  className = "",
  fullWidth = true,
  align = "left",
  format = "YYYY-MM-DD",
}: CleanDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { layout: popoverLayout, update: updatePopoverPosition } = useClampedPopover(
    containerRef,
    isOpen,
    {
      preferredWidth: 320,
      preferAlign: align,
      maxPreferredHeight: 380,
    }
  );

  const parsed = useMemo(() => parseInputDate(value), [value]);

  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, []);

  // Mes y año en vista activa en el calendario
  const [viewYear, setViewYear] = useState<number>(parsed?.year || today.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed?.month ?? today.month);

  // Sincronizar vista si cambia el valor externo
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [parsed?.year, parsed?.month]);

  // Click outside y tecla ESC
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  // Navegación de meses
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Matriz de días del mes
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Días del mes anterior
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({
        day: d,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        isToday: today.year === prevYear && today.month === prevMonth && today.day === d,
        isSelected: Boolean(parsed && parsed.year === prevYear && parsed.month === prevMonth && parsed.day === d),
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        isToday: today.year === viewYear && today.month === viewMonth && today.day === d,
        isSelected: Boolean(parsed && parsed.year === viewYear && parsed.month === viewMonth && parsed.day === d),
      });
    }

    // Días del siguiente mes para completar la grilla a múltiplos de 7 (35 o 42 días)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        isToday: today.year === nextYear && today.month === nextMonth && today.day === d,
        isSelected: Boolean(parsed && parsed.year === nextYear && parsed.month === nextMonth && parsed.day === d),
      });
    }

    return cells;
  }, [viewYear, viewMonth, parsed, today]);

  const handleSelectDay = (cell: { year: number; month: number; day: number }) => {
    const formatted = formatDateString(cell.year, cell.month, cell.day, format);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear(today.year);
    setViewMonth(today.month);
    const formatted = formatDateString(today.year, today.month, today.day, format);
    onChange(formatted);
    setIsOpen(false);
  };

  // Texto visual de la fecha elegida (ej: "10 / 11 / 2026")
  const displayLabel = useMemo(() => {
    if (!parsed) return "";
    const dd = String(parsed.day).padStart(2, "0");
    const mm = String(parsed.month + 1).padStart(2, "0");
    return `${dd} / ${mm} / ${parsed.year}`;
  }, [parsed]);

  return (
    <div
      ref={containerRef}
      className={`relative text-left ${fullWidth ? "w-full block" : "inline-block"}`}
    >
      {/* Botón Disparador estilizado Neo-Brutalismo */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) updatePopoverPosition();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm font-bold rounded-lg border-2 border-black transition-all duration-150 cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none ${
          fullWidth ? "w-full" : ""
        } ${
          isOpen
            ? "border-black bg-[#FFFDF9] text-black"
            : "bg-[#FFFDF9] hover:bg-[#FAF6EE] border-black text-black"
        } ${className}`}
      >
        <span className={`font-mono ${displayLabel ? "text-black font-bold" : "text-neutral-500 font-normal"}`}>
          {displayLabel || placeholder}
        </span>
        <CalendarIcon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isOpen ? "text-black" : "text-neutral-700 hover:text-black"
          }`}
        />
      </button>

      {/* Popover Flotante de Calendario estilo Neo-Brutalismo Retro */}
      {isOpen && (
        <div
          style={
            popoverLayout
              ? { left: `${popoverLayout.left}px`, width: `${popoverLayout.width}px` }
              : undefined
          }
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-[min(20rem,calc(100vw-1.5rem))] bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 select-none`}
        >
          {/* Cabecera: Flechas y Mes/Año */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b-2 border-black">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4 text-black" />
            </button>

            <div className="flex items-center gap-1.5 bg-[#FAF6EE] px-3 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000]">
              <span className="text-xs font-heading font-extrabold text-black capitalize">
                {MONTH_NAMES[viewMonth]} de {viewYear}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] text-black hover:bg-[#FFD23F] shadow-[1px_1px_0px_#000] transition-colors cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4 text-black" />
            </button>
          </div>

          {/* Días de la Semana: dom, lun, mar, mié, jue, vie, sáb */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAY_NAMES.map((name, idx) => (
              <span
                key={name}
                className={`text-[11px] font-mono font-bold uppercase ${
                  idx === 0 || idx === 6 ? "text-[#E76F51]" : "text-black"
                }`}
              >
                {name}
              </span>
            ))}
          </div>

          {/* Grilla de Días del Mes */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                  type="button"
                  onClick={() => handleSelectDay(cell)}
                  className={`h-8 sm:h-9 w-full flex items-center justify-center text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                    cell.isSelected
                      ? "bg-[#FFD23F] text-black font-extrabold border-2 border-black shadow-[2px_2px_0px_#000]"
                      : cell.isToday
                      ? "bg-[#FAF6EE] border-2 border-dashed border-black text-black font-extrabold"
                      : cell.isCurrentMonth
                      ? isWeekend
                        ? "text-[#E76F51] hover:bg-[#FFD23F]/20 hover:border hover:border-black"
                        : "text-black hover:bg-[#FAF6EE] hover:border hover:border-black"
                      : "text-neutral-300 hover:text-neutral-500"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Barra Inferior: Limpiar y Hoy */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t-2 border-black text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-black hover:bg-[#E76F51] hover:text-white rounded-lg border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>

            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1 bg-black text-[#FFD23F] hover:bg-neutral-800 rounded-lg text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-[#FFD23F]" />
              <span>Hoy</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
