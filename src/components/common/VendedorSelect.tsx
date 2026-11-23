"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Check,
  Search,
  X,
  Plus,
  Building2,
  ShoppingBag,
  User,
  AlertCircle
} from "lucide-react";
import {
  AreaVendedor,
  VendedorItem,
  getStoredVendedoresConArea,
  addCustomVendedorConArea
} from "@/data/vendedoresData";

interface VendedorSelectProps {
  value: string;
  onChange: (vendedorNombre: string, area?: AreaVendedor) => void;
  className?: string;
  placeholder?: string;
  align?: "left" | "right";
}

export function VendedorSelect({
  value,
  onChange,
  className = "",
  placeholder = "Seleccionar vendedor...",
  align = "left",
}: VendedorSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendedoresList, setVendedoresList] = useState<VendedorItem[]>([]);
  
  // Modal / Formulario para agregar nuevo vendedor
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaArea, setNuevaArea] = useState<AreaVendedor | "">("");
  const [formError, setFormError] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Carga inicial y reactiva de vendedores
  const reloadVendedores = () => {
    setVendedoresList(getStoredVendedoresConArea());
  };

  useEffect(() => {
    reloadVendedores();
  }, []);

  // Foco automático en el buscador al abrir el menú
  useEffect(() => {
    if (isOpen) {
      reloadVendedores();
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery("");
      setIsAddingModalOpen(false);
      setFormError("");
    }
  }, [isOpen]);

  // Cierre al hacer click afuera
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

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isAddingModalOpen) {
          setIsAddingModalOpen(false);
        } else {
          setIsOpen(false);
        }
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isAddingModalOpen]);

  // Vendedor actual seleccionado
  const currentItem = useMemo(() => {
    const clean = (value || "").trim();
    if (
      !clean ||
      clean.toLowerCase().startsWith("salón de ventas") ||
      clean.toLowerCase().startsWith("salon de ventas") ||
      clean.toLowerCase().startsWith("seleccionar")
    ) {
      return null;
    }
    return (
      vendedoresList.find(
        (v) => v.nombre.toLowerCase() === clean.toLowerCase()
      ) || {
        nombre: clean,
        area: (clean.toLowerCase().includes("corp") ? "Ventas Corp" : "Ventas Tienda") as AreaVendedor,
      }
    );
  }, [value, vendedoresList]);

  // Filtrado por buscador para subcategorías
  const { corpItems, tiendaItems } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? vendedoresList.filter((v) => v.nombre.toLowerCase().includes(q))
      : vendedoresList;

    const corp = filtered.filter((v) => v.area === "Ventas Corp");
    const tienda = filtered.filter((v) => v.area === "Ventas Tienda");

    return { corpItems: corp, tiendaItems: tienda };
  }, [vendedoresList, searchQuery]);

  // Manejar creación de nuevo vendedor con nombre, apellido y área obligatoria
  const handleGuardarNuevoVendedor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError("");

    const cleanNombre = nuevoNombre.trim();
    if (!cleanNombre) {
      setFormError("Por favor ingrese Nombre y Apellido.");
      return;
    }

    if (cleanNombre.split(/\s+/).length < 2) {
      setFormError("Debe incluir al menos un nombre y un apellido.");
      return;
    }

    if (!nuevaArea) {
      setFormError("Debe seleccionar obligatoriamente el área operativa.");
      return;
    }

    const updated = addCustomVendedorConArea(cleanNombre, nuevaArea);
    setVendedoresList(updated);
    onChange(cleanNombre, nuevaArea);

    // Limpiar estado
    setNuevoNombre("");
    setNuevaArea("");
    setIsAddingModalOpen(false);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full text-left">
      {/* Botón Trigger Selector */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full inline-flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-heading font-extrabold rounded-xl border-2 border-black transition-all duration-150 cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] select-none min-h-[46px] ${
          isOpen
            ? "border-black bg-[#FFFDF9] text-black"
            : "bg-[#FFFDF9] hover:bg-[#FAF6EE] border-black text-black"
        } ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          {!currentItem ? (
            <User className="w-4 h-4 text-black shrink-0" />
          ) : currentItem.area === "Ventas Corp" ? (
            <Building2 className="w-4 h-4 text-black shrink-0" />
          ) : (
            <ShoppingBag className="w-4 h-4 text-black shrink-0" />
          )}

          <span className={`truncate ${currentItem ? "text-black" : "text-neutral-500 font-medium"}`}>
            {currentItem ? currentItem.nombre : placeholder}
          </span>

          {currentItem && (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 border border-black shadow-[1px_1px_0px_#000] ${
                currentItem.area === "Ventas Corp"
                  ? "bg-[#2A9D8F] text-white"
                  : "bg-[#FFD23F] text-black"
              }`}
            >
              {currentItem.area === "Ventas Corp" ? "Corp" : "Tienda"}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-black shrink-0 transition-transform duration-200 stroke-[2.5] ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menú Desplegable con Estilo Moderno Neo-Brutalismo */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-full min-w-[260px] max-w-[calc(100vw-1.5rem)] sm:max-w-md bg-[#FFFDF9] rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* 1. Buscador Superior Fijo */}
          <div className="p-2.5 border-b-2 border-black bg-[#FAF6EE] shrink-0">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                maxLength={70}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsOpen(false);
                  e.stopPropagation();
                }}
                placeholder="Buscar por nombre de vendedor..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border-2 border-black rounded-lg text-black placeholder-neutral-500 outline-none font-bold shadow-[1px_1px_0px_#000]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 text-neutral-600 hover:text-black p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="p-2 max-h-[min(18rem,55dvh)] overflow-y-auto overscroll-contain">

          {/* Formulario Inline para Agregar Nuevo Vendedor */}
          {isAddingModalOpen ? (
            <div className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-3 shadow-[2px_2px_0px_#000] animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-extrabold text-black flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-black" />
                  Agregar Nuevo Vendedor
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="text-neutral-600 hover:text-black p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="flex items-center gap-1.5 text-[11px] text-white bg-[#E76F51] p-2 rounded-lg border-2 border-black font-bold shadow-[1px_1px_0px_#000]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-heading font-extrabold text-black block mb-1">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  autoFocus
                  maxLength={70}
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Marcos Ramírez"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border-2 border-black rounded-lg text-black font-bold outline-none shadow-[1px_1px_0px_#000]"
                />
              </div>

              <div>
                <label className="text-[11px] font-heading font-extrabold text-black block mb-1.5">
                  Área Operativa Obligatoria *
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNuevaArea("Ventas Tienda")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 border-black text-center transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${
                      nuevaArea === "Ventas Tienda"
                        ? "bg-[#FFD23F] text-black"
                        : "bg-white text-black hover:bg-[#FAF6EE]"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 mb-1 text-black" />
                    <span className="text-[11px] font-heading font-extrabold">Ventas Tienda</span>
                    <span className="text-[9px] font-mono text-neutral-700">
                      Tienda Física
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNuevaArea("Ventas Corp")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 border-black text-center transition-all cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${
                      nuevaArea === "Ventas Corp"
                        ? "bg-[#2A9D8F] text-white"
                        : "bg-white text-black hover:bg-[#FAF6EE]"
                    }`}
                  >
                    <Building2 className="w-4 h-4 mb-1 text-black" />
                    <span className="text-[11px] font-heading font-extrabold">Ventas Corp</span>
                    <span className="text-[9px] font-mono opacity-90">
                      Corporativo &amp; Empresas
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="px-2.5 py-1.5 text-xs font-mono font-bold text-neutral-700 hover:text-black cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarNuevoVendedor()}
                  className="px-3 py-1.5 text-xs font-heading font-extrabold bg-[#FFD23F] hover:bg-[#FACC15] text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Guardar y Asignar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 2. Subcategoría: VENTAS CORP */}
              {corpItems.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono font-bold text-black uppercase tracking-wider select-none">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-black" />
                      <span>Ventas Corp ({corpItems.length})</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-white bg-[#2A9D8F] px-1.5 py-0.2 rounded border border-black shadow-[1px_1px_0px_#000]">
                      Corporativo
                    </span>
                  </div>

                  <div className="space-y-1 mt-1">
                    {corpItems.map((item) => {
                      const isSelected =
                        item.nombre.toLowerCase() === value.trim().toLowerCase();
                      return (
                        <button
                          key={item.nombre}
                          type="button"
                          onClick={() => {
                            onChange(item.nombre, item.area);
                            setSearchQuery("");
                            setIsOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 text-xs sm:text-sm font-heading font-extrabold rounded-lg text-left border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-black text-[#FFD23F] border-black shadow-[1px_1px_0px_#000]"
                              : "border-transparent text-black hover:border-black hover:bg-[#FAF6EE]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{item.nombre}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#FFD23F] shrink-0 stroke-[3]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Subcategoría: VENTAS TIENDA */}
              {tiendaItems.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono font-bold text-black tracking-wider uppercase select-none mt-1 pt-1 border-t-2 border-black border-dashed">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-black" />
                      <span>Ventas Tienda ({tiendaItems.length})</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-black bg-[#FFD23F] px-1.5 py-0.2 rounded border border-black shadow-[1px_1px_0px_#000]">
                      Tienda
                    </span>
                  </div>

                  <div className="space-y-1 mt-1">
                    {tiendaItems.map((item) => {
                      const isSelected =
                        item.nombre.toLowerCase() === value.trim().toLowerCase();
                      return (
                        <button
                          key={item.nombre}
                          type="button"
                          onClick={() => {
                            onChange(item.nombre, item.area);
                            setSearchQuery("");
                            setIsOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 text-xs sm:text-sm font-heading font-extrabold rounded-lg text-left border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-black text-[#FFD23F] border-black shadow-[1px_1px_0px_#000]"
                              : "border-transparent text-black hover:border-black hover:bg-[#FAF6EE]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{item.nombre}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#FFD23F] shrink-0 stroke-[3]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Si no hay resultados de búsqueda */}
              {corpItems.length === 0 && tiendaItems.length === 0 && (
                <div className="py-4 px-3 text-center space-y-2">
                  <p className="text-xs text-neutral-600 font-medium">
                    No se encontró a &quot;{searchQuery}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoNombre(searchQuery);
                      setIsAddingModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-extrabold bg-[#FFD23F] hover:bg-[#FACC15] text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar a &quot;{searchQuery}&quot;
                  </button>
                </div>
              )}

              {/* Botón Inferior: Agregar Vendedor con Área Obligatoria */}
              <div className="pt-2 mt-2 border-t-2 border-black border-dashed">
                <button
                  type="button"
                  onClick={() => {
                    setNuevoNombre(searchQuery);
                    setIsAddingModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-heading font-extrabold text-black hover:bg-[#FFD23F] bg-[#FAF6EE] rounded-lg transition-all border-2 border-black border-dashed cursor-pointer shadow-[1px_1px_0px_#000]"
                >
                  <Plus className="w-4 h-4 text-black" />
                  <span>+ Agregar nuevo vendedor con área</span>
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
