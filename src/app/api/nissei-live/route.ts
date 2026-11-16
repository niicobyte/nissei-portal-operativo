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
  { id: "2302", categoria: "REFRIGERACION" },
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

function isRelevantHardwareItem(categoria: NisseiHardwareCategory, name: string): boolean {
  const upper = name.toUpperCase();
  if (categoria === "PROCESADOR") {
    if (upper.includes("ULTIMATTE") || upper.includes("BLACKMAGIC")) return false;
  }
  if (categoria === "GABINETE") {
    if (
      (upper.includes("SOPORTE") || upper.includes("CARRITO") || upper.includes("BANDEJA")) &&
      !upper.includes("GABINETE")
    ) {
      return false;
    }
  }
  return true;
}

function normalizeCleanSku(rawSku: string): string {
  return String(rawSku || "").trim().replace(/^PC-/i, "");
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
    if (!isRelevantHardwareItem(categoria, String(item.name))) continue;

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

    const rawSku = String(item.sku).trim();
    const cleanSku = normalizeCleanSku(rawSku);

    const mainEntry: NisseiLiveItem = {
      sku: cleanSku,
      nombre: String(item.name).trim(),
      categoria,
      precioPyg: finalVal,
      precioRegularPyg: Math.max(regVal, finalVal),
      stockStatus,
      urlWeb,
    };
    parsed.push(mainEntry);

    if (rawSku !== cleanSku) {
      parsed.push({
        ...mainEntry,
        sku: rawSku,
      });
    }

    // Si es un producto configurable, extraer también cada variante simple
    if (Array.isArray(item.variants)) {
      for (const v of item.variants) {
        const prod = v?.product;
        if (!prod || !prod.sku) continue;
        const vFinal = Math.round(
          Number(prod?.price_range?.minimum_price?.final_price?.value || finalVal)
        );
        const vReg = Math.round(
          Number(prod?.price_range?.minimum_price?.regular_price?.value || vFinal)
        );
        const vStock: "IN_STOCK" | "OUT_OF_STOCK" =
          prod.stock_status === "IN_STOCK" && vFinal > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
        const vSku = normalizeCleanSku(String(prod.sku));
        parsed.push({
          sku: vSku,
          nombre: String(prod.name || item.name).trim(),
          categoria,
          precioPyg: vFinal,
          precioRegularPyg: Math.max(vReg, vFinal),
          stockStatus: vStock,
          urlWeb,
        });
      }
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
      }
      // Para la lista maestra, usar solo el SKU limpio sin prefijo PC- duplicado
      const cleanSku = normalizeCleanSku(item.sku);
      if (item.sku === cleanSku && item.stockStatus === "IN_STOCK" && item.precioPyg > 0) {
        uniqueItemsMap.set(cleanSku, item);
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
          .map((s) => String(s || "").trim())
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
      const cleanSku = normalizeCleanSku(String(item.sku));

      const entry: NisseiLiveItem = {
        sku: cleanSku,
        nombre: String(item.name || "").trim(),
        categoria: "PROCESADOR",
        precioPyg: finalVal,
        precioRegularPyg: Math.max(regVal, finalVal),
        stockStatus,
        urlWeb,
      };
      foundBySku[cleanSku] = entry;
      foundBySku[String(item.sku).trim()] = entry;

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
