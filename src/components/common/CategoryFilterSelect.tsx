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
  const mainSearchInputRef = useRef<HTMLInputElement>(null);
  const subSearchInputRef = useRef<HTMLInputElement>(null);

  // Cerrar desplegables al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
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
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
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

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-wrap items-center gap-2 ${className}`}
    >
      {/* 1. DESPLEGABLE PRINCIPAL CON BUSCADOR Y ACORDEÓN DE RUBROS */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMainOpen((prev) => !prev);
            setSubOpen(false);
          }}
          aria-expanded={mainOpen}
          className={`flex items-center justify-between gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all outline-none shadow-[0_1px_2px_rgba(0,0,0,0.03)] max-w-[270px] sm:max-w-[300px] ${
            isFiltering
              ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
              : mainOpen
              ? "border-slate-400 bg-white text-slate-900 ring-4 ring-slate-100"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {mainTriggerContent.icon ? (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${
                  isFiltering
                    ? "bg-white/15 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {mainTriggerContent.icon}
              </span>
            ) : (
              <Layers
                className={`h-3.5 w-3.5 shrink-0 ${
                  isFiltering ? "text-slate-300" : "text-slate-400"
                }`}
              />
            )}
            <span className="truncate font-semibold">{mainTriggerContent.label}</span>
            {mainTriggerContent.badge !== undefined && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  isFiltering
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
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
                className="rounded-full p-0.5 text-white/75 hover:bg-white/20 hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                mainOpen ? "rotate-180" : ""
              } ${isFiltering ? "text-slate-300" : "text-slate-400"}`}
            />
          </span>
        </button>

        {/* PANEL DESPLEGABLE PRINCIPAL */}
        {mainOpen && (
          <div className="absolute left-0 top-full mt-2 w-[360px] sm:w-[420px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Buscador fijo en la parte superior */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={mainSearchInputRef}
                  type="text"
                  value={mainSearch}
                  onChange={(e) => setMainSearch(e.target.value)}
                  placeholder="Buscar rubro o categoría (ej. SSD, Café, Celular)..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                />
                {mainSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMainSearch("");
                      mainSearchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Borrar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-500">
                <span>
                  {familyGroups.length} rubros · {categories.length} categorías
                </span>
                <span>Marcá una o varias casillas</span>
              </div>
            </div>

            {/* Opción rápida: Todas las categorías */}
            {!mainSearch && (
              <div className="px-2 pt-2 pb-1 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => handleClearAll()}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    !isFiltering
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-700 hover:bg-slate-100 font-medium"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    Todas las categorías
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      !isFiltering
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {totalCount}
                  </span>
                </button>
              </div>
            )}

            {/* Lista con rubros desplegables */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
              {filteredGroups.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <p className="text-xs font-semibold text-slate-700">
                    Sin coincidencias para &ldquo;{mainSearch}&rdquo;
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
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
                      className={`rounded-xl border transition-colors ${
                        isThisFamilySelected || checkedInThisGroup > 0
                          ? "border-slate-300 bg-slate-50/80"
                          : "border-transparent hover:border-slate-100"
                      }`}
                    >
                      {/* Cabecera del Rubro */}
                      <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFamilyExpand(group.family.id)}
                          className="flex flex-1 items-center gap-2 text-left min-w-0 rounded-lg px-1 py-0.5 hover:bg-slate-100/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          )}
                          <span className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-700">
                            {group.family.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-bold text-slate-900">
                                {group.family.name}
                              </span>
                              {checkedInThisGroup > 0 && (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-700">
                                  {checkedInThisGroup} sel.
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[10px] text-slate-400">
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
                          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                            isThisFamilySelected
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white"
                          }`}
                        >
                          Todo ({group.totalCount})
                        </button>
                      </div>

                      {/* Subdesplegable interno con las subcategorías del Rubro */}
                      {isExpanded && (
                        <div className="ml-5 mr-2 mb-2 pl-2.5 border-l border-slate-200 space-y-0.5">
                          {visibleItems.map((item) => {
                            const isChecked = normalizedSelectedSet.has(
                              item.normalized
                            );
                            return (
                              <div
                                key={item.normalized}
                                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                                  isChecked
                                    ? "bg-emerald-50 text-emerald-950 font-semibold"
                                    : "text-slate-700 hover:bg-slate-100"
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
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                      isChecked
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-slate-300 bg-white hover:border-slate-500"
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
                                    className="truncate text-left flex-1 hover:underline"
                                    title={`Filtrar solo ${item.label}`}
                                  >
                                    {item.label}
                                  </button>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                    isChecked
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-500"
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
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleClearAll()}
                  className="font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Limpiar selección
                </button>
                <button
                  type="button"
                  onClick={() => setMainOpen(false)}
                  className="rounded-lg bg-slate-900 px-3 py-1 font-semibold text-white hover:bg-slate-800 transition-colors"
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
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setSubOpen((prev) => !prev);
              setMainOpen(false);
            }}
            aria-expanded={subOpen}
            className={`flex items-center justify-between gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all outline-none shadow-[0_1px_2px_rgba(0,0,0,0.03)] max-w-[250px] ${
              selectedInActiveFamilyCount > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
                : subOpen
                ? "border-slate-400 bg-white text-slate-900 ring-4 ring-slate-100"
                : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Tag
                className={`h-3.5 w-3.5 shrink-0 ${
                  selectedInActiveFamilyCount > 0
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              />
              <span className="truncate font-semibold">
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
                  ? "text-emerald-600"
                  : "text-slate-400"
              }`}
            />
          </button>

          {subOpen && (
            <div className="absolute left-0 top-full mt-2 w-[320px] sm:w-[350px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-bold text-slate-800 truncate">
                    {activeFamilyGroup.family.icon} · {activeFamilyGroup.family.name}
                  </span>
                  {selectedInActiveFamilyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange(activeFamilyGroup.family.id, [])}
                      className="text-[10px] font-semibold text-emerald-700 hover:underline shrink-0"
                    >
                      Ver todas ({activeFamilyGroup.items.length})
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    ref={subSearchInputRef}
                    type="text"
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    placeholder={`Buscar en ${activeFamilyGroup.family.name}...`}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-8 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                  />
                  {subSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubSearch("");
                        subSearchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-0.5">
                {!subSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(activeFamilyGroup.family.id, []);
                      setSubOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                      selectedInActiveFamilyCount === 0
                        ? "bg-slate-900 text-white font-semibold"
                        : "text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span>Todas en este rubro</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        selectedInActiveFamilyCount === 0
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {activeFamilyGroup.totalCount}
                    </span>
                  </button>
                )}

                {filteredSubItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Sin subcategorías que coincidan con &ldquo;{subSearch}&rdquo;
                  </p>
                ) : (
                  filteredSubItems.map((item) => {
                    const isChecked = normalizedSelectedSet.has(item.normalized);
                    return (
                      <div
                        key={item.normalized}
                        className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                          isChecked
                            ? "bg-emerald-50 text-emerald-950 font-semibold"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            onClick={() => handleToggleCheckboxSub(item.normalized)}
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              isChecked
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 bg-white hover:border-slate-500"
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
                            className="truncate text-left flex-1 hover:underline"
                          >
                            {item.label}
                          </button>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                            isChecked
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
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
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                  <span className="font-medium text-slate-500">
                    {selectedInActiveFamilyCount}{" "}
                    {selectedInActiveFamilyCount === 1 ? "seleccionada" : "seleccionadas"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubOpen(false)}
                    className="rounded-lg bg-slate-900 px-3 py-1 font-semibold text-white hover:bg-slate-800"
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
