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
} from "@/data/montajesData";

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
        className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all duration-150 cursor-pointer shadow-xs select-none ${
          isOpen
            ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-white text-zinc-900"
            : "bg-zinc-50 hover:bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300"
        } ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          {!currentItem ? (
            <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          ) : currentItem.area === "Ventas Corp" ? (
            <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          ) : (
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          )}

          <span className={`truncate font-medium ${currentItem ? "text-zinc-900" : "text-zinc-500"}`}>
            {currentItem ? currentItem.nombre : placeholder}
          </span>

          {currentItem && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${
                currentItem.area === "Ventas Corp"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {currentItem.area === "Ventas Corp" ? "Corp" : "Tienda"}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-zinc-800" : ""
          }`}
        />
      </button>

      {/* Menú Desplegable con Estilo Moderno */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-1.5 w-full min-w-[240px] max-w-[calc(100vw-1.5rem)] sm:max-w-md bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* 1. Buscador Superior Fijo */}
          <div className="p-2 border-b border-zinc-100 bg-white shrink-0">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsOpen(false);
                  e.stopPropagation();
                }}
                placeholder="Buscar por nombre de vendedor..."
                className="w-full pl-8 pr-7 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-900 focus:bg-white transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 text-zinc-400 hover:text-zinc-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="p-2 max-h-[min(18rem,55dvh)] overflow-y-auto overscroll-contain">

          {/* Formulario Inline para Agregar Nuevo Vendedor */}
          {isAddingModalOpen ? (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-700" />
                  Agregar Nuevo Vendedor
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Marcos Ramírez"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1.5">
                  Área Operativa Obligatoria *
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNuevaArea("Ventas Tienda")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      nuevaArea === "Ventas Tienda"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <ShoppingBag className={`w-4 h-4 mb-1 ${nuevaArea === "Ventas Tienda" ? "text-emerald-400" : "text-emerald-600"}`} />
                    <span className="text-[11px] font-bold">Ventas Tienda</span>
                    <span className={`text-[9px] ${nuevaArea === "Ventas Tienda" ? "text-zinc-300" : "text-zinc-400"}`}>
                      Tienda Física
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNuevaArea("Ventas Corp")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      nuevaArea === "Ventas Corp"
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <Building2 className={`w-4 h-4 mb-1 ${nuevaArea === "Ventas Corp" ? "text-purple-400" : "text-purple-600"}`} />
                    <span className="text-[11px] font-bold">Ventas Corp</span>
                    <span className={`text-[9px] ${nuevaArea === "Ventas Corp" ? "text-zinc-300" : "text-zinc-400"}`}>
                      Corporativo & Empresas
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarNuevoVendedor()}
                  className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-black text-white rounded-lg shadow-sm transition-all cursor-pointer"
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
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold text-zinc-400 tracking-wider uppercase select-none">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Ventas Corp ({corpItems.length})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                      Corporativo
                    </span>
                  </div>

                  <div className="space-y-0.5 mt-1">
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
                          className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-zinc-900 text-white shadow-sm font-bold"
                              : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{item.nombre}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />
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
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold text-zinc-400 tracking-wider uppercase select-none mt-1 pt-1 border-t border-zinc-100">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ventas Tienda ({tiendaItems.length})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Tienda
                    </span>
                  </div>

                  <div className="space-y-0.5 mt-1">
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
                          className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-zinc-900 text-white shadow-sm font-bold"
                              : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{item.nombre}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />
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
                  <p className="text-xs text-zinc-500 font-medium">
                    No se encontró a &quot;{searchQuery}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoNombre(searchQuery);
                      setIsAddingModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-black text-white rounded-lg shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar a &quot;{searchQuery}&quot;
                  </button>
                </div>
              )}

              {/* Botón Inferior: Agregar Vendedor con Área Obligatoria */}
              <div className="pt-2 mt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setNuevoNombre(searchQuery);
                    setIsAddingModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-zinc-800 hover:text-black bg-zinc-50 hover:bg-zinc-100 rounded-xl transition-all border border-dashed border-zinc-300 hover:border-zinc-400 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-zinc-600" />
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
