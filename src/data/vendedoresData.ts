// Catálogo y Persistencia de Vendedores Comerciales (Ventas Corp y Ventas Tienda)
// Módulo ligero y aislado sin datos de clientes ni órdenes internas para uso seguro en rutas públicas (/armar-pc)

export type AreaVendedor = "Ventas Tienda" | "Ventas Corp";

export interface VendedorItem {
  nombre: string;
  area: AreaVendedor;
}

export const LISTA_VENDEDORES_REALES = [
  "Helen Rivarola",
  "Diego Vera",
  "Fabiola Patiño",
  "Sabrina Bogarin",
  "Emilio Lopez",
  "Kamila Guarie",
  "Camila Fleytas",
  "Guillermo Perez",
  "Ruth Rolon",
  "Matias Fleitas",
  "Jose Gomez",
  "Sebastian Alcaraz",
  "Patricia Martinez",
  "Monica Perez"
];

// Subcategorías oficiales estrictas de la gerencia comercial NISSEI
export const VENDEDORES_CORP_BASE: string[] = [
  "Diego Vera",
  "Sabrina Bogarin",
  "Ruth Rolon",
  "Matias Fleitas",
  "Monica Perez"
];

export const VENDEDORES_TIENDA_BASE: string[] = [
  "Helen Rivarola",
  "Fabiola Patiño",
  "Emilio Lopez",
  "Kamila Guarie",
  "Camila Fleytas",
  "Guillermo Perez",
  "Jose Gomez",
  "Sebastian Alcaraz",
  "Patricia Martinez"
];

export const VENDEDORES_STORAGE_KEY = "nissei_vendedores_montajes_v1";
export const VENDEDORES_CON_AREA_STORAGE_KEY = "nissei_vendedores_categorizados_v2";

function isGenericOrExcludedSeller(name: string): boolean {
  const low = name.trim().toLowerCase();
  return (
    low.startsWith("salón de ventas") ||
    low.startsWith("salon de ventas") ||
    low === "ecommerce - web" ||
    low === "ecommerce"
  );
}

function sanitizeSellerName(raw: string): string {
  return String(raw || "")
    .replace(/[<>'"`;\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

/**
 * Obtiene la lista completa de vendedores categorizados por área ("Ventas Tienda" o "Ventas Corp").
 * Combina la base oficial con los vendedores agregados dinámicamente con persistencia en localStorage.
 */
export function getStoredVendedoresConArea(): VendedorItem[] {
  const baseList: VendedorItem[] = [
    ...VENDEDORES_CORP_BASE.map((nombre) => ({ nombre, area: "Ventas Corp" as AreaVendedor })),
    ...VENDEDORES_TIENDA_BASE.map((nombre) => ({ nombre, area: "Ventas Tienda" as AreaVendedor }))
  ];

  if (typeof window === "undefined") return baseList;

  try {
    const raw = localStorage.getItem(VENDEDORES_CON_AREA_STORAGE_KEY);
    let customList: VendedorItem[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        customList = parsed
          .filter(
            (item) =>
              item &&
              typeof item.nombre === "string" &&
              !isGenericOrExcludedSeller(item.nombre) &&
              (item.area === "Ventas Tienda" || item.area === "Ventas Corp")
          )
          .map((item) => ({
            nombre: sanitizeSellerName(item.nombre),
            area: item.area as AreaVendedor,
          }))
          .filter((item) => Boolean(item.nombre));
      }
    }

    // Compatibilidad con registros legacy de localStorage
    const legacyRaw = localStorage.getItem(VENDEDORES_STORAGE_KEY);
    if (legacyRaw) {
      const legacyList = JSON.parse(legacyRaw);
      if (Array.isArray(legacyList)) {
        legacyList.forEach((legacyName) => {
          const clean = sanitizeSellerName(String(legacyName));
          if (
            clean &&
            !isGenericOrExcludedSeller(clean) &&
            !baseList.some((b) => b.nombre.toLowerCase() === clean.toLowerCase()) &&
            !customList.some((c) => c.nombre.toLowerCase() === clean.toLowerCase())
          ) {
            const isCorp = VENDEDORES_CORP_BASE.some(
              (c) => c.toLowerCase() === clean.toLowerCase()
            );
            customList.push({
              nombre: clean,
              area: isCorp ? "Ventas Corp" : "Ventas Tienda"
            });
          }
        });
      }
    }

    // Mapa único por nombre (insensible a mayúsculas/minúsculas)
    const map = new Map<string, VendedorItem>();
    [...baseList, ...customList].forEach((item) => {
      const key = item.nombre.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, { nombre: item.nombre.trim(), area: item.area });
      }
    });

    return Array.from(map.values());
  } catch (e) {
    console.warn("Error leyendo vendedores con área de localStorage:", e);
    return baseList;
  }
}

/**
 * Registra un nuevo vendedor comercial con nombre y apellido y área obligatoria.
 */
export function addCustomVendedorConArea(nombre: string, area: AreaVendedor): VendedorItem[] {
  const cleanNombre = sanitizeSellerName(nombre);
  if (!cleanNombre || cleanNombre.toUpperCase() === "OTRO" || isGenericOrExcludedSeller(cleanNombre)) {
    return getStoredVendedoresConArea();
  }

  const validArea: AreaVendedor = area === "Ventas Corp" ? "Ventas Corp" : "Ventas Tienda";
  const current = getStoredVendedoresConArea();
  const existingIdx = current.findIndex(
    (v) => v.nombre.toLowerCase() === cleanNombre.toLowerCase()
  );

  let updated: VendedorItem[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { nombre: cleanNombre, area: validArea };
  } else {
    updated = [...current, { nombre: cleanNombre, area: validArea }];
  }

  if (typeof window !== "undefined") {
    try {
      const customOnly = updated
        .filter(
          (v) =>
            !VENDEDORES_CORP_BASE.includes(v.nombre) &&
            !VENDEDORES_TIENDA_BASE.includes(v.nombre)
        )
        .slice(0, 150);
      localStorage.setItem(VENDEDORES_CON_AREA_STORAGE_KEY, JSON.stringify(customOnly));
      localStorage.setItem(VENDEDORES_STORAGE_KEY, JSON.stringify(updated.map((v) => v.nombre)));
    } catch (e) {
      console.warn("Error guardando nuevo vendedor con área:", e);
    }
  }

  return updated;
}

export function getStoredVendedores(): string[] {
  return getStoredVendedoresConArea().map((v) => v.nombre);
}

export function addCustomVendedor(nuevoVendedor: string): string[] {
  const clean = sanitizeSellerName(nuevoVendedor);
  const isCorp = VENDEDORES_CORP_BASE.some(
    (c) => c.toLowerCase() === clean.toLowerCase()
  );
  return addCustomVendedorConArea(
    clean,
    isCorp ? "Ventas Corp" : "Ventas Tienda"
  ).map((v) => v.nombre);
}
