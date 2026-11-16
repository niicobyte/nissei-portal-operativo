import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type NisseiHardwareCategory =
  | "PROCESADOR"
  | "PLACA_MADRE"
  | "RAM"
  | "GPU"
  | "ALMACENAMIENTO"
  | "FUENTE"
  | "GABINETE"
  | "REFRIGERACION";

export interface NisseiLiveItem {
  sku: string;
  nombre: string;
  categoria: NisseiHardwareCategory;
  precioPyg: number;
  precioRegularPyg: number;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK";
  urlWeb: string;
}

const NISSEI_GRAPHQL_URL = "https://nissei.com/graphql";
const NISSEI_PY_BASE_URL = "https://nissei.com/py";

const CATEGORY_MAP: Array<{ id: string; categoria: NisseiHardwareCategory }> = [
  { id: "180", categoria: "PROCESADOR" },
  { id: "179", categoria: "PLACA_MADRE" },
  { id: "175", categoria: "RAM" },
  { id: "183", categoria: "GPU" },
  { id: "1499", categoria: "ALMACENAMIENTO" },
  { id: "1498", categoria: "ALMACENAMIENTO" },
  { id: "173", categoria: "FUENTE" },
  { id: "174", categoria: "GABINETE" },
  { id: "1012", categoria: "REFRIGERACION" },
];

const CATEGORY_PRODUCTS_QUERY = `
  query GetCategoryHardware($categoryId: String!, $pageSize: Int!, $currentPage: Int!) {
    products(
      filter: { category_id: { eq: $categoryId } }
      pageSize: $pageSize
      currentPage: $currentPage
    ) {
      total_count
      page_info {
        current_page
        total_pages
      }
      items {
        sku
        name
        stock_status
        url_key
        price_range {
          minimum_price {
            final_price {
              value
              currency
            }
            regular_price {
              value
              currency
            }
          }
        }
        ... on ConfigurableProduct {
          variants {
            product {
              sku
              name
              stock_status
              price_range {
                minimum_price {
                  final_price {
                    value
                    currency
                  }
                  regular_price {
                    value
                    currency
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const SKU_BATCH_QUERY = `
  query GetProductsBySku($skus: [String!]!) {
    products(filter: { sku: { in: $skus } }, pageSize: 100) {
      items {
        sku
        name
        stock_status
        url_key
        price_range {
          minimum_price {
            final_price {
              value
              currency
            }
            regular_price {
              value
              currency
            }
          }
        }
        ... on ConfigurableProduct {
          variants {
            product {
              sku
              name
              stock_status
              price_range {
                minimum_price {
                  final_price {
                    value
                    currency
                  }
                  regular_price {
                    value
                    currency
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface CacheState {
  timestamp: number;
  bySku: Record<string, NisseiLiveItem>;
  items: NisseiLiveItem[];
}

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos
let cachedCatalog: CacheState | null = null;
let inflightPromise: Promise<CacheState> | null = null;

/**
 * Decodifica entidades HTML devueltas por Magento GraphQL (ej. 2.5&quot; -> 2.5")
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&#0*34;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae y normaliza inteligentemente el SKU numérico de PC de Nissei.
 * Acepta SKUs numéricos puros ("67488", "154022") o con prefijo de informática ("PC-124882" -> "124882").
 * Rechaza prefijos de otros rubros (ej. "FX-53037", "ELE-128657", "PET-TR17152").
 */
function normalizeCleanSku(rawSku: string): string {
  const trimmed = String(rawSku || "").trim();
  if (/^\d{4,7}$/.test(trimmed)) {
    return trimmed;
  }
  const pcMatch = trimmed.match(/^PC-(\d{4,7})$/i);
  if (pcMatch) {
    return pcMatch[1];
  }
  return "";
}

/**
 * Filtro experto para garantizar que solo entren componentes reales de PC de Escritorio
 * y descartar fuentes externas de routers, memorias de notebook SODIMM, soportes o accesorios.
 */
function isValidDesktopHardware(
  categoria: NisseiHardwareCategory,
  name: string,
  precioPyg: number
): boolean {
  const upper = name.toUpperCase();

  if (precioPyg <= 0) return false;

  if (categoria === "PROCESADOR") {
    if (
      upper.includes("ULTIMATTE") ||
      upper.includes("BLACKMAGIC") ||
      upper.includes("MINI PC") ||
      upper.includes("NOTEBOOK") ||
      upper.includes("ALL IN ONE")
    ) {
      return false;
    }
    return (
      upper.includes("RYZEN") ||
      upper.includes("INTEL") ||
      upper.includes("CORE") ||
      upper.includes("ATHLON") ||
      upper.includes("THREADRIPPER") ||
      upper.includes("PENTIUM") ||
      upper.includes("PROCESADOR")
    );
  }

  if (categoria === "PLACA_MADRE") {
    if (
      upper.includes("CABLE") ||
      upper.includes("ADAPTADOR") ||
      upper.includes("SOPORTE") ||
      upper.includes("ANTENA") ||
      upper.includes("CONTROLADOR")
    ) {
      return false;
    }
    return (
      upper.includes("PLACA MADRE") ||
      upper.includes("MOTHERBOARD") ||
      upper.includes("MAINBOARD") ||
      /\b(H310|H410|H510|B460|B560|H610|B660|B760|Z690|Z790|H810|B860|Z890|A320|A520|B450|B550|X570|A620|B650|B840|B850|X670|X870)\b/i.test(
        upper
      )
    );
  }

  if (categoria === "RAM") {
    // Excluir memorias de Notebook (SODIMM), memorias antiguas DDR2/DDR3 o accesorios
    if (
      upper.includes("SODIMM") ||
      upper.includes("SO-DIMM") ||
      upper.includes("NOTEBOOK") ||
      upper.includes("LAPTOP") ||
      upper.includes("MACBOOK") ||
      upper.includes("DDR3") ||
      upper.includes("DDR2") ||
      upper.includes("PC3") ||
      upper.includes("PC2") ||
      upper.includes("DISIPADOR PARA") ||
      upper.includes("DUMMY")
    ) {
      return false;
    }
    return /\b(DDR4|DDR5)\b/i.test(upper) && precioPyg >= 85000;
  }

  if (categoria === "GPU") {
    if (
      upper.includes("SOPORTE") ||
      upper.includes("CABLE") ||
      upper.includes("RISER") ||
      upper.includes("ADAPTADOR") ||
      upper.includes("EXTENSOR") ||
      upper.includes("CAJA EXTERNA")
    ) {
      return false;
    }
    return (
      /\b(RTX|GTX|RADEON|RX\s*\d{3,4}|ARC\s*[AB]\d{3}|GEFORCE|GT\s*(710|730|1030))\b/i.test(
        upper
      ) && precioPyg >= 280000
    );
  }

  if (categoria === "ALMACENAMIENTO") {
    if (
      upper.includes("EXTERNO") ||
      upper.includes("PORTATIL") ||
      upper.includes("PORTÁTIL") ||
      upper.includes("CARCASA") ||
      upper.includes("CASE PARA") ||
      upper.includes("COFRE") ||
      upper.includes("ADAPTADOR") ||
      upper.includes("CADDY") ||
      upper.includes("DOCK") ||
      upper.includes("PENDRIVE") ||
      upper.includes("MICROSD") ||
      upper.includes("SDXC")
    ) {
      return false;
    }
    return (
      (upper.includes("SSD") ||
        upper.includes("DISCO DURO") ||
        upper.includes("M.2") ||
        upper.includes("NVME")) &&
      precioPyg >= 100000
    );
  }

  if (categoria === "FUENTE") {
    // Excluir estrictamente fuentes externas (ej. LanPro Media Converters), cargadores, UPS o adaptadores 12V/24V
    if (
      upper.includes("EXTERNA") ||
      upper.includes("EXTERNO") ||
      upper.includes("MEDIA CONVERTER") ||
      upper.includes("LANPRO") ||
      upper.includes("CARGADOR") ||
      upper.includes("NOTEBOOK") ||
      upper.includes("LAPTOP") ||
      upper.includes("CCTV") ||
      upper.includes("POE") ||
      upper.includes("IMPRESORA") ||
      upper.includes("MONITOR") ||
      upper.includes("TIRA LED") ||
      upper.includes("ADAPTADOR") ||
      upper.includes("UPS") ||
      upper.includes("ESTABILIZADOR") ||
      upper.includes("CABLE") ||
      /\b(12V|24V|48V|9V|5V)\b/i.test(upper)
    ) {
      return false;
    }
    // Debe tener potencia real de fuente de PC entre 400W y 1600W y precio de fuente ATX/SFX
    const hasRealPsuWatts =
      /\b(400|450|500|550|600|650|700|750|800|850|900|1000|1050|1200|1300|1600)\s*W\b/i.test(
        upper
      );
    return hasRealPsuWatts && precioPyg >= 150000;
  }

  if (categoria === "GABINETE") {
    if (
      upper.includes("SOPORTE") ||
      upper.includes("CARRITO") ||
      upper.includes("BANDEJA") ||
      upper.includes("RACK") ||
      upper.includes("PEDESTAL") ||
      upper.includes("BRAZO")
    ) {
      return false;
    }
    return upper.includes("GABINETE") && precioPyg >= 150000;
  }

  if (categoria === "REFRIGERACION") {
    if (
      upper.includes("NOTEBOOK") ||
      upper.includes("LAPTOP") ||
      upper.includes("BASE COOLER") ||
      upper.includes("SOPORTE") ||
      upper.includes("CELULAR") ||
      upper.includes("TELEFONO") ||
      upper.includes("TELÉFONO") ||
      upper.includes("SMARTPHONE") ||
      upper.includes("MAGSAFE") ||
      upper.includes("TABLET")
    ) {
      return false;
    }
    return (
      (upper.includes("COOLER") ||
        upper.includes("VENTILADOR") ||
        upper.includes("WATER") ||
        upper.includes("LIQUIDO") ||
        upper.includes("LÍQUIDO")) &&
      precioPyg >= 45000
    );
  }

  return true;
}

async function fetchCategoryPage(
  categoryId: string,
  currentPage: number,
  pageSize = 80
): Promise<{
  totalPages: number;
  rawItems: any[];
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(NISSEI_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Store: "py",
      },
      body: JSON.stringify({
        query: CATEGORY_PRODUCTS_QUERY,
        variables: { categoryId, pageSize, currentPage },
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { totalPages: 1, rawItems: [] };
    const json = await res.json().catch(() => null);
    const products = json?.data?.products;
    return {
      totalPages: Number(products?.page_info?.total_pages || 1),
      rawItems: Array.isArray(products?.items) ? products.items : [],
    };
  } catch {
    clearTimeout(timer);
    return { totalPages: 1, rawItems: [] };
  }
}

async function fetchAllCategoryItems(
  categoryId: string,
  categoria: NisseiHardwareCategory
): Promise<NisseiLiveItem[]> {
  const firstPage = await fetchCategoryPage(categoryId, 1, 80);
  let allRaw = [...firstPage.rawItems];

  if (firstPage.totalPages > 1) {
    const extraPages: Promise<{ totalPages: number; rawItems: any[] }>[] = [];
    const maxPages = Math.min(firstPage.totalPages, 4);
    for (let p = 2; p <= maxPages; p++) {
      extraPages.push(fetchCategoryPage(categoryId, p, 80));
    }
    const results = await Promise.all(extraPages);
    for (const r of results) {
      allRaw = allRaw.concat(r.rawItems);
    }
  }

  const parsed: NisseiLiveItem[] = [];

  for (const item of allRaw) {
    if (!item || !item.sku || !item.name) continue;

    const cleanName = decodeHtmlEntities(String(item.name));
    const finalVal = Math.round(
      Number(item?.price_range?.minimum_price?.final_price?.value || 0)
    );
    const regVal = Math.round(
      Number(item?.price_range?.minimum_price?.regular_price?.value || finalVal)
    );

    if (!isValidDesktopHardware(categoria, cleanName, finalVal)) continue;

    const stockStatus: "IN_STOCK" | "OUT_OF_STOCK" =
      item.stock_status === "IN_STOCK" && finalVal > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
    const urlKey = String(item.url_key || "").trim();
    const urlWeb = urlKey ? `${NISSEI_PY_BASE_URL}/${urlKey}` : NISSEI_PY_BASE_URL;

    // Si es un producto configurable con variantes, extraer cada variante con su propio SKU numérico limpio
    if (Array.isArray(item.variants) && item.variants.length > 0) {
      for (const v of item.variants) {
        const prod = v?.product;
        if (!prod || !prod.sku) continue;
        const vSku = normalizeCleanSku(String(prod.sku));
        if (!vSku) continue;
        const vName = decodeHtmlEntities(String(prod.name || cleanName));
        const vFinal = Math.round(
          Number(prod?.price_range?.minimum_price?.final_price?.value || finalVal)
        );
        const vReg = Math.round(
          Number(prod?.price_range?.minimum_price?.regular_price?.value || vFinal)
        );
        if (!isValidDesktopHardware(categoria, vName, vFinal)) continue;
        const vStock: "IN_STOCK" | "OUT_OF_STOCK" =
          prod.stock_status === "IN_STOCK" && vFinal > 0 ? "IN_STOCK" : "OUT_OF_STOCK";

        parsed.push({
          sku: vSku,
          nombre: vName,
          categoria,
          precioPyg: vFinal,
          precioRegularPyg: Math.max(vReg, vFinal),
          stockStatus: vStock,
          urlWeb,
        });
      }
    }

    const cleanSku = normalizeCleanSku(String(item.sku));
    if (cleanSku) {
      parsed.push({
        sku: cleanSku,
        nombre: cleanName,
        categoria,
        precioPyg: finalVal,
        precioRegularPyg: Math.max(regVal, finalVal),
        stockStatus,
        urlWeb,
      });
    }
  }

  return parsed;
}

async function syncFullNisseiCatalog(): Promise<CacheState> {
  const categoryResults = await Promise.all(
    CATEGORY_MAP.map((c) => fetchAllCategoryItems(c.id, c.categoria))
  );

  const bySku: Record<string, NisseiLiveItem> = {};
  const uniqueItemsMap = new Map<string, NisseiLiveItem>();

  for (const list of categoryResults) {
    for (const item of list) {
      if (!item.sku) continue;
      const existing = bySku[item.sku];
      if (!existing || (existing.stockStatus !== "IN_STOCK" && item.stockStatus === "IN_STOCK")) {
        bySku[item.sku] = item;
        bySku[`PC-${item.sku}`] = item;
      }
      if (item.stockStatus === "IN_STOCK" && item.precioPyg > 0) {
        uniqueItemsMap.set(item.sku, item);
      }
    }
  }

  const state: CacheState = {
    timestamp: Date.now(),
    bySku,
    items: Array.from(uniqueItemsMap.values()),
  };

  if (state.items.length > 0) {
    cachedCatalog = state;
  }
  return state;
}

async function getOrFetchCatalog(forceRefresh = false): Promise<CacheState> {
  if (
    !forceRefresh &&
    cachedCatalog &&
    Date.now() - cachedCatalog.timestamp < CACHE_TTL_MS
  ) {
    return cachedCatalog;
  }

  if (!forceRefresh && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = syncFullNisseiCatalog().finally(() => {
    inflightPromise = null;
  });

  return inflightPromise;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const state = await getOrFetchCatalog(forceRefresh);

    return NextResponse.json(
      {
        ok: true,
        source: "https://nissei.com/py/",
        currency: "PYG",
        updatedAt: new Date(state.timestamp).toISOString(),
        totalInStockWeb: state.items.length,
        bySku: state.bySku,
        items: state.items,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    console.error("[NISSEI LIVE SYNC ERROR]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo conectar en vivo con https://nissei.com/py/.",
        bySku: cachedCatalog?.bySku || {},
        items: cachedCatalog?.items || [],
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawSkus: string[] = Array.isArray(body?.skus) ? body.skus : [];
    const cleanSkus = Array.from(
      new Set(
        rawSkus
          .map((s) => normalizeCleanSku(String(s || "")))
          .filter(Boolean)
          .slice(0, 40)
          .flatMap((s) => [s, `PC-${s}`])
      )
    );

    if (cleanSkus.length === 0) {
      return NextResponse.json({ ok: true, bySku: {} });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(NISSEI_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Store: "py",
      },
      body: JSON.stringify({
        query: SKU_BATCH_QUERY,
        variables: { skus: cleanSkus },
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json().catch(() => null);
    const rawItems = Array.isArray(json?.data?.products?.items)
      ? json.data.products.items
      : [];

    const foundBySku: Record<string, NisseiLiveItem> = {};
    for (const item of rawItems) {
      if (!item || !item.sku) continue;
      const cleanSku = normalizeCleanSku(String(item.sku));
      if (!cleanSku) continue;

      const finalVal = Math.round(
        Number(item?.price_range?.minimum_price?.final_price?.value || 0)
      );
      const regVal = Math.round(
        Number(item?.price_range?.minimum_price?.regular_price?.value || finalVal)
      );
      const stockStatus: "IN_STOCK" | "OUT_OF_STOCK" =
        item.stock_status === "IN_STOCK" && finalVal > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
      const urlKey = String(item.url_key || "").trim();
      const urlWeb = urlKey ? `${NISSEI_PY_BASE_URL}/${urlKey}` : NISSEI_PY_BASE_URL;
      const cleanName = decodeHtmlEntities(String(item.name || ""));

      const entry: NisseiLiveItem = {
        sku: cleanSku,
        nombre: cleanName,
        categoria: "PROCESADOR",
        precioPyg: finalVal,
        precioRegularPyg: Math.max(regVal, finalVal),
        stockStatus,
        urlWeb,
      };
      foundBySku[cleanSku] = entry;
      foundBySku[`PC-${cleanSku}`] = entry;

      if (cachedCatalog) {
        cachedCatalog.bySku[cleanSku] = entry;
      }
    }

    return NextResponse.json({
      ok: true,
      bySku: foundBySku,
    });
  } catch {
    return NextResponse.json({ ok: false, bySku: {} }, { status: 500 });
  }
}
