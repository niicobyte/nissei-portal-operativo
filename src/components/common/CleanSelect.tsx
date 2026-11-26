"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { useClampedPopover } from "@/lib/popoverPosition";

export interface CleanSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
  description?: string;
}

interface CleanSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CleanSelectOption[];
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  activeClassName?: string;
  dropdownWidth?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
  fullWidth?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function CleanSelect({
  value,
  onChange,
  options,
  icon,
  placeholder = "Seleccionar...",
  className = "",
  activeClassName = "",
  dropdownWidth,
  align = "left",
  size = "sm",
  fullWidth = false,
  searchable = false,
  searchPlaceholder = "Buscar...",
}: CleanSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const classTokens = className.trim().split(/\s+/).filter(Boolean);
  const hasWFull = classTokens.includes("w-full");
  const isResponsiveSmAuto = !fullWidth && hasWFull && classTokens.includes("sm:w-auto");
  const isResponsiveMdAuto = !fullWidth && hasWFull && classTokens.includes("md:w-auto");
  const isResponsiveLgAuto = !fullWidth && hasWFull && classTokens.includes("lg:w-auto");
  const isFull =
    fullWidth ||
    (hasWFull && !isResponsiveSmAuto && !isResponsiveMdAuto && !isResponsiveLgAuto);
  const wrapperWidthClass = isFull
    ? "w-full block"
    : isResponsiveSmAuto
    ? "w-full block sm:w-auto sm:inline-block"
    : isResponsiveMdAuto
    ? "w-full block md:w-auto md:inline-block"
    : isResponsiveLgAuto
    ? "w-full block lg:w-auto lg:inline-block"
    : "inline-block";
  const preferredPopoverWidth = dropdownWidth?.includes("80")
    ? 320
    : dropdownWidth?.includes("72")
    ? 288
    : 256;

  const { layout: popoverLayout, update: updatePopoverPosition } = useClampedPopover(
    containerRef,
    isOpen,
    {
      preferredWidth: preferredPopoverWidth,
      preferAlign: align,
      maxPreferredHeight: 288,
    }
  );

  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery("");
    }
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, searchable, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const pyClass = size === "sm" ? "py-1.5" : "py-2.5 min-h-[46px]";
  const pxClass = size === "sm" ? "px-2.5" : "px-3.5";
  const textClass = size === "sm" ? "text-xs" : "text-sm";
  const roundedClass = size === "sm" ? "rounded-lg" : "rounded-xl";

  return (
    <div ref={containerRef} className={`relative text-left ${wrapperWidthClass}`}>
      <button
        type="button"
        onClick={() => {
          if (!isOpen) updatePopoverPosition();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex items-center justify-between gap-2 ${pxClass} ${pyClass} ${textClass} font-bold ${roundedClass} border-2 border-black transition-all duration-150 cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none ${
          isFull ? "w-full" : ""
        } ${
          isOpen
            ? "border-black bg-[#FFFDF9] text-black"
            : selectedOption && selectedOption.value !== "TODOS" && selectedOption.value !== "NINGUNO" && activeClassName
            ? activeClassName
            : "bg-[#FFFDF9] hover:bg-[#FAF6EE] border-black text-black"
        } ${className}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0 text-black">{icon}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span
              className={`ml-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-black ${
                selectedOption.badgeColor || "bg-[#FFD23F] text-black"
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-black shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          style={
            popoverLayout
              ? isFull
                ? { maxHeight: `${popoverLayout.maxHeight}px` }
                : {
                    left: `${popoverLayout.left}px`,
                    width: `${popoverLayout.width}px`,
                    maxHeight: `${popoverLayout.maxHeight}px`,
                  }
              : undefined
          }
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-1.5 ${dropdownWidth || (isFull ? "w-full" : "w-64")} min-w-[180px] max-w-[calc(100vw-1.5rem)] max-h-[min(18rem,55dvh)] overflow-y-auto overscroll-contain bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {searchable && (
            <div className="p-1 border-b-2 border-black mb-1 sticky top-0 bg-[#FFFDF9] z-10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-neutral-600 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsOpen(false);
                    }
                    e.stopPropagation();
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#FAF6EE] border-2 border-black rounded-lg text-black placeholder-neutral-500 font-medium focus:outline-none focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-black hover:text-neutral-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-2 text-center text-xs text-neutral-500 font-medium">
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setSearchQuery("");
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-bold rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-black text-[#FFD23F] border border-black shadow-[2px_2px_0px_#000]"
                        : "text-black hover:bg-[#FAF6EE] hover:border hover:border-black"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && (
                        <span
                          className={`shrink-0 ${
                            isSelected ? "text-white" : "text-zinc-500"
                          }`}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {opt.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : opt.badgeColor ||
                                "bg-zinc-100 text-zinc-700 border border-zinc-200"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
