"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Search,
  Tag,
  X,
} from "lucide-react";
import {
  CATEGORY_FAMILIES,
  CategoryFamily,
  OTHER_CATEGORY_FAMILY,
  findCategoryFamily,
  normalizeCategoryText,
  normalizeComponentName,
} from "@/data/recepcionCategories";
import { useClampedPopover } from "@/lib/popoverPosition";

export interface CategoryCountItem {
  category: string;
  count: number;
}

export interface CategoryFilterSelectProps {
  categories: CategoryCountItem[];
  totalCount: number;
  selectedFamily: string;
  selectedCategories: string[];
  onChange: (familyId: string, selectedCategories: string[]) => void;
  className?: string;
}

interface NormalizedCategoryEntry {
  normalized: string;
  label: string;
  count: number;
  family: CategoryFamily;
}

interface FamilyGroup {
  family: CategoryFamily;
  totalCount: number;
  items: NormalizedCategoryEntry[];
}

export default function CategoryFilterSelect({
  categories,
  totalCount,
  selectedFamily,
  selectedCategories,
  onChange,
  className = "",
}: CategoryFilterSelectProps) {
  const [mainOpen, setMainOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [mainSearch, setMainSearch] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const mainAnchorRef = useRef<HTMLDivElement>(null);
  const subAnchorRef = useRef<HTMLDivElement>(null);
  const mainSearchInputRef = useRef<HTMLInputElement>(null);
  const subSearchInputRef = useRef<HTMLInputElement>(null);

  const { layout: mainLayout, update: updateMainPosition } = useClampedPopover(mainAnchorRef, mainOpen, {
    preferredWidth: 420,
    preferAlign: "left",
    maxPreferredHeight: 500,
  });

  const { layout: subLayout, update: updateSubPosition } = useClampedPopover(subAnchorRef, subOpen, {
    preferredWidth: 350,
    preferAlign: "left",
    maxPreferredHeight: 420,
  });

  // Cerrar desplegables al hacer clic/tocar fuera o presionar Escape
  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMainOpen(false);
        setSubOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMainOpen(false);
        setSubOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Enfocar automáticamente el buscador al abrir cada desplegable
  useEffect(() => {
    if (mainOpen) {
      setMainSearch("");
      if (selectedFamily !== "TODOS") {
        setExpandedFamilies((prev) => ({ ...prev, [selectedFamily]: true }));
      }
      const timer = setTimeout(() => mainSearchInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [mainOpen, selectedFamily]);

  useEffect(() => {
    if (subOpen) {
      setSubSearch("");
      const timer = setTimeout(() => subSearchInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [subOpen]);

  // Agrupar categorías normalizadas dentro de cada Rubro padre
  const { familyGroups, categoryToFamilyMap } = useMemo(() => {
    const mergedMap = new Map<string, NormalizedCategoryEntry>();

    for (const rawItem of categories) {
      const normalized = normalizeComponentName(rawItem.category);
      if (!normalized) continue;
      const existing = mergedMap.get(normalized);
      if (existing) {
        existing.count += rawItem.count;
      } else {
        mergedMap.set(normalized, {
          normalized,
          label: normalized,
          count: rawItem.count,
          family: findCategoryFamily(normalized),
        });
      }
    }

    const byFamilyId = new Map<string, NormalizedCategoryEntry[]>();
    const catToFam = new Map<string, string>();

    mergedMap.forEach((entry) => {
      catToFam.set(entry.normalized, entry.family.id);
      const list = byFamilyId.get(entry.family.id) || [];
      list.push(entry);
      byFamilyId.set(entry.family.id, list);
    });

    const orderedFamilies = [...CATEGORY_FAMILIES, OTHER_CATEGORY_FAMILY];
    const groups: FamilyGroup[] = [];

    for (const fam of orderedFamilies) {
      const items = byFamilyId.get(fam.id);
      if (!items || items.length === 0) continue;
      items.sort((a, b) => a.label.localeCompare(b.label, "es"));
      const famTotal = items.reduce((acc, item) => acc + item.count, 0);
      groups.push({
        family: fam,
        totalCount: famTotal,
        items,
      });
    }

    return { familyGroups: groups, categoryToFamilyMap: catToFam };
  }, [categories]);

  const normalizedSelectedSet = useMemo(() => {
    return new Set(selectedCategories.map((c) => normalizeComponentName(c)));
  }, [selectedCategories]);

  // Filtrado por texto en el desplegable principal (soporta múltiples palabras sin tildes)
  const filteredGroups = useMemo(() => {
    const normQuery = normalizeCategoryText(mainSearch);
    if (!normQuery) {
      return familyGroups.map((g) => ({
        group: g,
        visibleItems: g.items,
        familyMatched: false,
      }));
    }

    const tokens = normQuery.split(" ").filter(Boolean);
    const results: {
      group: FamilyGroup;
      visibleItems: NormalizedCategoryEntry[];
      familyMatched: boolean;
    }[] = [];

    for (const group of familyGroups) {
      const famSearchText = normalizeCategoryText(
        `${group.family.name} ${group.family.description}`
      );
      const famMatched = tokens.every((tk) => famSearchText.includes(tk));
      const matchedItems = group.items.filter((item) => {
        const combined = normalizeCategoryText(`${item.label} ${group.family.name}`);
        return tokens.every((tk) => combined.includes(tk));
      });

      if (famMatched && matchedItems.length === 0) {
        results.push({
          group,
          visibleItems: group.items,
          familyMatched: true,
        });
      } else if (matchedItems.length > 0) {
        results.push({
          group,
          visibleItems: matchedItems,
          familyMatched: famMatched,
        });
      }
    }

    return results;
  }, [familyGroups, mainSearch]);

  // Determinar qué familia activa mostrar en el segundo desplegable (subcategorías en cascada)
  const activeFamilyGroup = useMemo(() => {
    if (selectedFamily !== "TODOS") {
      return familyGroups.find((g) => g.family.id === selectedFamily) || null;
    }
    if (normalizedSelectedSet.size > 0) {
      const famIds = new Set<string>();
      normalizedSelectedSet.forEach((cat) => {
        const fid = categoryToFamilyMap.get(cat);
        if (fid) famIds.add(fid);
      });
      if (famIds.size === 1) {
        const singleId = Array.from(famIds)[0];
        return familyGroups.find((g) => g.family.id === singleId) || null;
      }
    }
    return null;
  }, [selectedFamily, normalizedSelectedSet, familyGroups, categoryToFamilyMap]);

  // Opciones filtradas dentro del segundo desplegable de subcategorías
  const filteredSubItems = useMemo(() => {
    if (!activeFamilyGroup) return [];
    const normQuery = normalizeCategoryText(subSearch);
    if (!normQuery) return activeFamilyGroup.items;
    const tokens = normQuery.split(" ").filter(Boolean);
    return activeFamilyGroup.items.filter((item) => {
      const text = normalizeCategoryText(item.label);
      return tokens.every((tk) => text.includes(tk));
    });
  }, [activeFamilyGroup, subSearch]);

  const isFiltering = selectedFamily !== "TODOS" || normalizedSelectedSet.size > 0;

  // Texto visible en el botón principal
  const mainTriggerContent = useMemo(() => {
    if (!isFiltering) {
      return {
        icon: null as string | null,
        label: "Todas las categorías",
        badge: totalCount,
      };
    }

    if (normalizedSelectedSet.size === 1) {
      const single = Array.from(normalizedSelectedSet)[0];
      const fam = findCategoryFamily(single);
      const countInGroup =
        familyGroups
          .find((g) => g.family.id === fam.id)
          ?.items.find((i) => i.normalized === single)?.count ?? undefined;
      return {
        icon: fam.icon,
        label: single,
        badge: countInGroup,
      };
    }

    if (normalizedSelectedSet.size > 1) {
      if (activeFamilyGroup) {
        const countSum = activeFamilyGroup.items
          .filter((i) => normalizedSelectedSet.has(i.normalized))
          .reduce((acc, i) => acc + i.count, 0);
        return {
          icon: activeFamilyGroup.family.icon,
          label: `${activeFamilyGroup.family.name} (${normalizedSelectedSet.size} subcat.)`,
          badge: countSum,
        };
      }
      return {
        icon: "MULTI",
        label: `${normalizedSelectedSet.size} categorías`,
        badge: undefined,
      };
    }

    if (activeFamilyGroup) {
      return {
        icon: activeFamilyGroup.family.icon,
        label: activeFamilyGroup.family.name,
        badge: activeFamilyGroup.totalCount,
      };
    }

    return {
      icon: null,
      label: selectedFamily,
      badge: undefined,
    };
  }, [
    isFiltering,
    totalCount,
    normalizedSelectedSet,
    familyGroups,
    activeFamilyGroup,
    selectedFamily,
  ]);

  // Helpers de actualización
  const toggleFamilyExpand = (familyId: string) => {
    setExpandedFamilies((prev) => ({ ...prev, [familyId]: !prev[familyId] }));
  };

  const handleSelectEntireFamily = (familyId: string) => {
    onChange(familyId, []);
    setExpandedFamilies((prev) => ({ ...prev, [familyId]: true }));
    setMainOpen(false);
  };

  const handleSingleSubCategoryClick = (familyId: string, catNormalized: string) => {
    onChange(familyId, [catNormalized]);
    setMainOpen(false);
    setSubOpen(false);
  };

  const resolveNextFamilyId = (nextCats: string[], fallbackFamilyId: string): string => {
    if (nextCats.length === 0) {
      return fallbackFamilyId;
    }
    const famIds = new Set<string>();
    for (const c of nextCats) {
      const fid = categoryToFamilyMap.get(c);
      if (fid) famIds.add(fid);
    }
    return famIds.size === 1 ? Array.from(famIds)[0] : "TODOS";
  };

  const handleToggleCheckboxMain = (catNormalized: string, familyId: string) => {
    const next = new Set(normalizedSelectedSet);
    if (next.has(catNormalized)) {
      next.delete(catNormalized);
    } else {
      next.add(catNormalized);
    }
    const nextArray = Array.from(next);
    if (nextArray.length === 0) {
      onChange("TODOS", []);
      return;
    }
    const resolvedFamily = resolveNextFamilyId(nextArray, familyId);
    onChange(resolvedFamily, nextArray);
  };

  const handleToggleCheckboxSub = (catNormalized: string) => {
    if (!activeFamilyGroup) return;
    const next = new Set(normalizedSelectedSet);
    if (next.has(catNormalized)) {
      next.delete(catNormalized);
    } else {
      next.add(catNormalized);
    }
    const nextArray = Array.from(next);
    // Si se desmarca la última dentro del subdesplegable, vuelve a mostrar todo el rubro activo
    onChange(activeFamilyGroup.family.id, nextArray);
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange("TODOS", []);
    setMainOpen(false);
    setSubOpen(false);
  };

  // Cantidad de subcategorías seleccionadas dentro de la familia activa
  const selectedInActiveFamilyCount = useMemo(() => {
    if (!activeFamilyGroup || normalizedSelectedSet.size === 0) return 0;
    return activeFamilyGroup.items.filter((i) =>
      normalizedSelectedSet.has(i.normalized)
    ).length;
  }, [activeFamilyGroup, normalizedSelectedSet]);

  const isResponsiveMobileFull =
    className.includes("w-full") && className.includes("sm:w-auto");

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-wrap items-center gap-2 ${className}`}
    >
      {/* 1. DESPLEGABLE PRINCIPAL CON BUSCADOR Y ACORDEÓN DE RUBROS */}
      <div
        ref={mainAnchorRef}
        className={`relative ${isResponsiveMobileFull ? "w-full sm:w-auto" : ""}`}
      >
        <button
          type="button"
          onClick={() => {
            if (!mainOpen) updateMainPosition();
            setMainOpen((prev) => !prev);
            setSubOpen(false);
          }}
          aria-expanded={mainOpen}
          className={`inline-flex items-center justify-between gap-2 rounded-lg border-2 border-black px-2.5 py-1.5 text-xs font-bold transition-all duration-150 outline-none shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer select-none ${
            isResponsiveMobileFull
              ? "w-full sm:w-auto sm:max-w-[250px]"
              : "max-w-[230px] sm:max-w-[250px]"
          } ${
            isFiltering
              ? "bg-black text-[#FFD23F]"
              : mainOpen
              ? "bg-[#FFFDF9] text-black"
              : "bg-[#FFFDF9] hover:bg-[#FAF6EE] text-black"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {mainTriggerContent.icon ? (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider border border-black ${
                  isFiltering
                    ? "bg-[#FFD23F] text-black"
                    : "bg-[#FAF6EE] text-black"
                }`}
              >
                {mainTriggerContent.icon}
              </span>
            ) : (
              <Layers
                className={`h-3.5 w-3.5 shrink-0 ${
                  isFiltering ? "text-[#FFD23F]" : "text-black"
                }`}
              />
            )}
            <span className="truncate font-bold">{mainTriggerContent.label}</span>
            {mainTriggerContent.badge !== undefined && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold border border-black ${
                  isFiltering
                    ? "bg-[#FFD23F] text-black"
                    : "bg-[#FAF6EE] text-black"
                }`}
              >
                {mainTriggerContent.badge}
              </span>
            )}
          </span>

          <span className="flex items-center gap-1 shrink-0">
            {isFiltering && (
              <span
                role="button"
                tabIndex={-1}
                title="Quitar filtro de categoría"
                onClick={handleClearAll}
                className="rounded-full p-0.5 text-black hover:bg-neutral-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                mainOpen ? "rotate-180" : ""
              } ${isFiltering ? "text-[#FFD23F]" : "text-black"}`}
            />
          </span>
        </button>

        {/* PANEL DESPLEGABLE PRINCIPAL */}
        {mainOpen && (
          <div
            style={
              mainLayout
                ? { left: `${mainLayout.left}px`, width: `${mainLayout.width}px` }
                : undefined
            }
            className="absolute left-0 top-full mt-2 w-[360px] sm:w-[420px] max-w-[calc(100vw-1.5rem)] rounded-xl border-2 border-black bg-[#FFFDF9] shadow-[4px_4px_0px_#000] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Buscador fijo en la parte superior */}
            <div className="p-2.5 border-b-2 border-black bg-[#FAF6EE]">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                <input
                  ref={mainSearchInputRef}
                  type="text"
                  value={mainSearch}
                  onChange={(e) => setMainSearch(e.target.value)}
                  placeholder="Buscar rubro o categoría (ej. SSD, Café, Celular)..."
                  className="w-full rounded-lg border-2 border-black bg-white pl-8 pr-8 py-1.5 text-xs font-bold text-black placeholder:text-neutral-500 shadow-[1px_1px_0px_#000] outline-none"
                />
                {mainSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMainSearch("");
                      mainSearchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 rounded-full p-0.5 text-neutral-600 hover:bg-neutral-200"
                    title="Borrar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-neutral-700 font-mono font-bold">
                <span>
                  {familyGroups.length} rubros · {categories.length} categorías
                </span>
                <span>Marcá una o varias casillas</span>
              </div>
            </div>

            {/* Opción rápida: Todas las categorías */}
            {!mainSearch && (
              <div className="px-2 pt-2 pb-1 border-b-2 border-black border-dashed">
                <button
                  type="button"
                  onClick={() => handleClearAll()}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs border-2 border-black transition-all cursor-pointer ${
                    !isFiltering
                      ? "bg-black text-[#FFD23F] font-bold shadow-[2px_2px_0px_#000]"
                      : "bg-[#FFFDF9] text-black hover:bg-[#FAF6EE] font-bold shadow-[1px_1px_0px_#000]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    Todas las categorías
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold border border-black ${
                      !isFiltering
                        ? "bg-[#FFD23F] text-black"
                        : "bg-[#FAF6EE] text-black"
                    }`}
                  >
                    {totalCount}
                  </span>
                </button>
              </div>
            )}

            {/* Lista con rubros desplegables */}
            <div
              style={
                mainLayout
                  ? { maxHeight: `${Math.max(150, mainLayout.maxHeight - 135)}px` }
                  : undefined
              }
              className="max-h-[min(380px,52dvh)] overflow-y-auto overscroll-contain p-2 space-y-1"
            >
              {filteredGroups.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <p className="text-xs font-heading font-extrabold text-black">
                    Sin coincidencias para &ldquo;{mainSearch}&rdquo;
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-600 font-medium">
                    Probá con otro término como Monitor, SSD, Cafetera, Celular o Mouse.
                  </p>
                </div>
              ) : (
                filteredGroups.map(({ group, visibleItems }) => {
                  const isSearchActive = Boolean(mainSearch.trim());
                  const isExpanded =
                    isSearchActive || Boolean(expandedFamilies[group.family.id]);
                  const isThisFamilySelected =
                    selectedFamily === group.family.id &&
                    normalizedSelectedSet.size === 0;
                  const checkedInThisGroup = group.items.filter((i) =>
                    normalizedSelectedSet.has(i.normalized)
                  ).length;

                  return (
                    <div
                      key={group.family.id}
                      className={`rounded-lg border-2 transition-all mb-1.5 ${
                        isThisFamilySelected || checkedInThisGroup > 0
                          ? "border-black bg-[#FFFDF9] shadow-[2px_2px_0px_#000]"
                          : "border-black/20 hover:border-black bg-white hover:bg-[#FAF6EE]"
                      }`}
                    >
                      {/* Cabecera del Rubro */}
                      <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFamilyExpand(group.family.id)}
                          className="flex flex-1 items-center gap-2 text-left min-w-0 rounded-md px-1 py-1 hover:bg-[#FAF6EE] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-black stroke-[2.5]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-black stroke-[2.5]" />
                          )}
                          <span className="shrink-0 rounded bg-black text-[#FFD23F] px-1.5 py-0.5 font-mono text-[9px] font-extrabold border border-black shadow-[1px_1px_0px_#000]">
                            {group.family.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-heading font-extrabold text-black">
                                {group.family.name}
                              </span>
                              {checkedInThisGroup > 0 && (
                                <span className="shrink-0 rounded-full bg-[#2A9D8F] text-white px-1.5 py-0.2 font-mono text-[9px] font-bold border border-black">
                                  {checkedInThisGroup} sel.
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[10px] text-neutral-600 font-medium">
                              {group.items.length}{" "}
                              {group.items.length === 1 ? "categoría" : "categorías"} ·{" "}
                              {group.family.description}
                            </p>
                          </div>
                        </button>

                        {/* Botón rápido: filtrar todo este rubro */}
                        <button
                          type="button"
                          onClick={() => handleSelectEntireFamily(group.family.id)}
                          title={`Ver todas las órdenes de ${group.family.name}`}
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-mono font-bold border-2 border-black transition-all cursor-pointer ${
                            isThisFamilySelected
                              ? "bg-black text-[#FFD23F] shadow-[1px_1px_0px_#000]"
                              : "bg-[#FFFDF9] text-black shadow-[1px_1px_0px_#000] hover:bg-[#FFD23F]"
                          }`}
                        >
                          Todo ({group.totalCount})
                        </button>
                      </div>

                      {/* Subdesplegable interno con las subcategorías del Rubro */}
                      {isExpanded && (
                        <div className="ml-4 mr-1.5 mb-2 pl-2.5 border-l-2 border-black border-dashed space-y-1">
                          {visibleItems.map((item) => {
                            const isChecked = normalizedSelectedSet.has(
                              item.normalized
                            );
                            return (
                              <div
                                key={item.normalized}
                                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs border transition-all ${
                                  isChecked
                                    ? "bg-[#2A9D8F]/15 border-black text-black font-bold shadow-[1px_1px_0px_#000]"
                                    : "border-transparent text-neutral-800 hover:border-black/40 hover:bg-[#FAF6EE] font-medium"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isChecked}
                                    onClick={() =>
                                      handleToggleCheckboxMain(
                                        item.normalized,
                                        group.family.id
                                      )
                                    }
                                    title="Marcar/desmarcar para selección múltiple"
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-black transition-all cursor-pointer ${
                                      isChecked
                                        ? "bg-[#2A9D8F] text-white shadow-[1px_1px_0px_#000]"
                                        : "bg-white hover:bg-[#FAF6EE]"
                                    }`}
                                  >
                                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSingleSubCategoryClick(
                                        group.family.id,
                                        item.normalized
                                      )
                                    }
                                    className="truncate text-left flex-1 hover:underline cursor-pointer"
                                    title={`Filtrar solo ${item.label}`}
                                  >
                                    {item.label}
                                  </button>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold border border-black ${
                                    isChecked
                                      ? "bg-[#2A9D8F] text-white"
                                      : "bg-[#FAF6EE] text-black"
                                  }`}
                                >
                                  {item.count}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie contextual cuando hay filtros activos */}
            {isFiltering && (
              <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-[#FAF6EE] px-3 py-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleClearAll()}
                  className="font-mono font-bold text-black hover:text-[#E76F51] underline decoration-2 cursor-pointer transition-colors"
                >
                  Limpiar selección
                </button>
                <button
                  type="button"
                  onClick={() => setMainOpen(false)}
                  className="rounded-lg bg-[#FFD23F] hover:bg-[#FACC15] px-3 py-1 font-heading font-extrabold text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Aplicar ({normalizedSelectedSet.size > 0 ? normalizedSelectedSet.size : "Rubro"})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. SEGUNDO DESPLEGABLE EN CASCADA (SUBCATEGORÍAS DEL RUBRO ACTIVO) */}
      {activeFamilyGroup && activeFamilyGroup.items.length >= 2 && (
        <div ref={subAnchorRef} className="relative">
          <button
            type="button"
            onClick={() => {
              if (!subOpen) updateSubPosition();
              setSubOpen((prev) => !prev);
              setMainOpen(false);
            }}
            aria-expanded={subOpen}
            className={`inline-flex items-center justify-between gap-2 rounded-lg border-2 border-black px-2.5 py-1.5 text-xs font-bold transition-all duration-150 outline-none shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer select-none max-w-[220px] ${
              selectedInActiveFamilyCount > 0
                ? "bg-[#2A9D8F] text-white"
                : subOpen
                ? "bg-[#FFFDF9] text-black"
                : "bg-[#FAF6EE] text-black hover:bg-[#FFFDF9]"
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Tag
                className={`h-3.5 w-3.5 shrink-0 ${
                  selectedInActiveFamilyCount > 0
                    ? "text-white"
                    : "text-black"
                }`}
              />
              <span className="truncate font-bold">
                {selectedInActiveFamilyCount === 0
                  ? `Subcategorías (${activeFamilyGroup.items.length})`
                  : selectedInActiveFamilyCount === 1
                  ? activeFamilyGroup.items.find((i) =>
                      normalizedSelectedSet.has(i.normalized)
                    )?.label || "1 subcategoría"
                  : `${selectedInActiveFamilyCount} de ${activeFamilyGroup.items.length} subcat.`}
              </span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                subOpen ? "rotate-180" : ""
              } ${
                selectedInActiveFamilyCount > 0
                  ? "text-white"
                  : "text-black"
              }`}
            />
          </button>

          {subOpen && (
            <div
              style={
                subLayout
                  ? { left: `${subLayout.left}px`, width: `${subLayout.width}px` }
                  : undefined
              }
              className="absolute left-0 top-full mt-2 w-[320px] sm:w-[350px] max-w-[calc(100vw-1.5rem)] rounded-xl border-2 border-black bg-[#FFFDF9] shadow-[4px_4px_0px_#000] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="p-2.5 border-b-2 border-black bg-[#FAF6EE] space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-heading font-extrabold text-black truncate">
                    {activeFamilyGroup.family.icon} · {activeFamilyGroup.family.name}
                  </span>
                  {selectedInActiveFamilyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange(activeFamilyGroup.family.id, [])}
                      className="text-[10px] font-mono font-bold text-[#2A9D8F] hover:underline shrink-0"
                    >
                      Ver todas ({activeFamilyGroup.items.length})
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    ref={subSearchInputRef}
                    type="text"
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    placeholder={`Buscar en ${activeFamilyGroup.family.name}...`}
                    className="w-full rounded-lg border-2 border-black bg-white pl-8 pr-8 py-1.5 text-xs font-bold text-black placeholder:text-neutral-500 shadow-[1px_1px_0px_#000] outline-none"
                  />
                  {subSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubSearch("");
                        subSearchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 rounded-full p-0.5 text-neutral-600 hover:bg-neutral-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div
                style={
                  subLayout
                    ? { maxHeight: `${Math.max(140, subLayout.maxHeight - 105)}px` }
                    : undefined
                }
                className="max-h-[min(300px,46dvh)] overflow-y-auto overscroll-contain p-1.5 space-y-0.5"
              >
                {!subSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(activeFamilyGroup.family.id, []);
                      setSubOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs border-2 border-black transition-all cursor-pointer ${
                      selectedInActiveFamilyCount === 0
                        ? "bg-black text-[#FFD23F] font-bold shadow-[2px_2px_0px_#000]"
                        : "bg-[#FFFDF9] text-black hover:bg-[#FAF6EE] font-bold shadow-[1px_1px_0px_#000]"
                    }`}
                  >
                    <span>Todas en este rubro</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold border border-black ${
                        selectedInActiveFamilyCount === 0
                          ? "bg-[#FFD23F] text-black"
                          : "bg-[#FAF6EE] text-black"
                      }`}
                    >
                      {activeFamilyGroup.totalCount}
                    </span>
                  </button>
                )}

                {filteredSubItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-neutral-600 font-medium">
                    Sin subcategorías que coincidan con &ldquo;{subSearch}&rdquo;
                  </p>
                ) : (
                  filteredSubItems.map((item) => {
                    const isChecked = normalizedSelectedSet.has(item.normalized);
                    return (
                      <div
                        key={item.normalized}
                        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs border transition-all ${
                          isChecked
                            ? "bg-[#2A9D8F]/15 border-black text-black font-bold shadow-[1px_1px_0px_#000]"
                            : "border-transparent text-neutral-800 hover:border-black/40 hover:bg-[#FAF6EE] font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            onClick={() => handleToggleCheckboxSub(item.normalized)}
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-black transition-all cursor-pointer ${
                              isChecked
                                ? "bg-[#2A9D8F] text-white shadow-[1px_1px_0px_#000]"
                                : "bg-white hover:bg-[#FAF6EE]"
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSingleSubCategoryClick(
                                activeFamilyGroup.family.id,
                                item.normalized
                              )
                            }
                            className="truncate text-left flex-1 hover:underline cursor-pointer"
                          >
                            {item.label}
                          </button>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold border border-black ${
                            isChecked
                              ? "bg-[#2A9D8F] text-white"
                              : "bg-[#FAF6EE] text-black"
                          }`}
                        >
                          {item.count}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedInActiveFamilyCount > 0 && (
                <div className="flex items-center justify-between border-t-2 border-black bg-[#FAF6EE] px-3 py-2 text-[11px]">
                  <span className="font-mono font-bold text-neutral-800">
                    {selectedInActiveFamilyCount}{" "}
                    {selectedInActiveFamilyCount === 1 ? "seleccionada" : "seleccionadas"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubOpen(false)}
                    className="rounded-lg bg-[#FFD23F] hover:bg-[#FACC15] px-3 py-1 font-heading font-extrabold text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
