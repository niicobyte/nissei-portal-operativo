"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

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
  const isFull = fullWidth || className.includes("w-full");

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
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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

  const pyClass = size === "sm" ? "py-1.5" : "py-2";
  const pxClass = size === "sm" ? "px-2.5" : "px-3";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div ref={containerRef} className={`relative text-left ${isFull ? "w-full block" : "inline-block"}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2 ${pxClass} ${pyClass} ${textClass} font-semibold rounded-xl border transition-all duration-150 cursor-pointer shadow-sm select-none ${
          isFull ? "w-full" : ""
        } ${
          isOpen
            ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-white text-zinc-900"
            : selectedOption && selectedOption.value !== "TODOS" && selectedOption.value !== "NINGUNO" && activeClassName
            ? activeClassName
            : className || "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-800 hover:border-zinc-300"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span
              className={`ml-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                selectedOption.badgeColor || "bg-zinc-100 text-zinc-700 border border-zinc-200"
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-zinc-800" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-1.5 ${dropdownWidth || (isFull ? "w-full" : "w-64")} min-w-[200px] max-h-72 overflow-y-auto bg-white rounded-xl border border-zinc-200 shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {searchable && (
            <div className="p-1 border-b border-zinc-100 mb-1 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
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
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-zinc-400 hover:text-zinc-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-2 text-center text-xs text-zinc-400 font-medium">
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
                    className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white shadow-sm font-bold"
                        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
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
