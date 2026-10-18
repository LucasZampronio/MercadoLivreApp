const API = "https://api.mercadolibre.com";
const SITE = process.env.MELI_SITE_ID ?? "MLB";

let cached: { token: string; expires: number } | null = null;
const responseCache = new Map<string, { expires: number; data: any }>();

async function getToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const id = process.env.MELI_APP_ID;
  const secret = process.env.MELI_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Defina MELI_APP_ID e MELI_CLIENT_SECRET em .env");
  }

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao obter token (${res.status}): ${await res.text()}`);
  const data = await res.json();
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function meli<T>(path: string, revalidate = 900): Promise<T> {
  const hit = responseCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.data as T;

  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ML API ${path} -> ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as T;
  responseCache.set(path, { expires: Date.now() + revalidate * 1000, data: json });
  return json;
}

export type Category = { id: string; name: string };

export type Trend = { keyword: string; url: string };

export type CategoryDetails = {
  id: string;
  name: string;
  totalItems: number;
  pathFromRoot: string[];
  catalogDomain?: string;
};

export type Product = {
  position: number;
  id: string;
  type: string;
  itemId?: string;
  name: string;
  familyName?: string;
  image?: string;
  picturesCount?: number;
  permalink?: string;

  // Catálogo / Ficha técnica (/products/{id})
  brand?: string;
  model?: string;
  color?: string;
  weight?: string;
  dimensions?: string;
  mainFeatures?: string[];
  qualityType?: string;
  dateCreated?: string;
  daysActive?: number;

  // Categoria & Subcategoria (/highlights/MLB/{type}/{id} + /categories/{id})
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  subcategoryPosition?: number;
  subcategoryTotalItems?: number;

  // Ofertas & Preços (/products/{id}/items)
  price?: number;
  maxPrice?: number;
  avgPrice?: number;
  originalPrice?: number;
  discount?: number;
  offers?: number;
  condition?: string;
  warranty?: string;
  listingTypeId?: string;
  listingTypeName?: string;
  freeShipping?: boolean;
  logisticType?: string;
  officialStore?: boolean;
  officialStoreId?: number;

  // Financeiro: Tarifas ML, Frete, Imposto, Recebimento Líquido (/sites/MLB/listing_prices + /shipping_options/free)
  saleFeeAmount?: number;
  saleFeePercent?: number;
  fixedFeeAmount?: number;
  shippingListCost?: number;
  billableWeightGrams?: number;
  estimatedTaxPercent?: number;
  estimatedTaxAmount?: number;
  netReceived?: number;
  netAfterTax?: number;
  profitPriceMin?: number;
  profitPriceMax?: number;

  // Demanda / Engajamento (/questions/search)
  questionsTotal?: number;
  estimatedSales?: number;
  estimatedDailySales?: number;
  estimatedMonthlySales?: number;
  estimatedMonthlyRevenue?: number;

  // Vendedor & Reputação (/users/{seller_id})
  sellerId?: number;
  sellerNickname?: string;
  sellerPermalink?: string;
  sellerUserType?: string;
  sellerLocation?: string;
  sellerLevel?: string;
  sellerPowerStatus?: string;
  sellerTotalTransactions?: number;
};

export type CategorySnapshot = {
  id: string;
  name: string;
  details: CategoryDetails | null;
  trends: Trend[];
  products: Product[];
};

export type MeliSnapshot = {
  updatedAt: string;
  siteId: string;
  generalTrends: Trend[];
  categories: CategorySnapshot[];
  topOfAll: Product[];
};

export function getCategories() {
  return meli<Category[]>(`/sites/${SITE}/categories`, 86_400);
}

export async function getCategoryDetails(categoryId: string): Promise<CategoryDetails | null> {
  try {
    const c = await meli<any>(`/categories/${categoryId}`, 86_400);
    return {
      id: c.id,
      name: c.name,
      totalItems: c.total_items_in_this_category ?? 0,
      pathFromRoot: (c.path_from_root ?? []).map((p: any) => p.name),
      catalogDomain: c.settings?.catalog_domain ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function getTrends(categoryId?: string): Promise<Trend[]> {
  try {
    const path = categoryId ? `/trends/${SITE}/${categoryId}` : `/trends/${SITE}`;
    const list = await meli<Trend[]>(path, 3600);
    return Array.isArray(list) ? list.slice(0, 20) : [];
  } catch {
    return [];
  }
}

type HighlightItem = { id: string; position: number; type: string };

type Offer = {
  item_id: string;
  seller_id: number;
  price: number;
  original_price: number | null;
  condition?: string;
  warranty?: string;
  listing_type_id?: string;
  category_id?: string;
  official_store_id: number | null;
  shipping?: { free_shipping?: boolean; logistic_type?: string; mode?: string };
  seller_address?: { city?: { name?: string }; state?: { name?: string } };
};

export async function mapPool<T, R>(
  list: T[],
  size: number,
  fn: (x: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i], i);
      }
    }),
  );
  return out;
}

const itemLink = (itemId: string) =>
  `https://produto.mercadolivre.com.br/MLB-${itemId.replace(/\D/g, "")}`;

const getAttr = (attrs: any[] | undefined, id: string): string | undefined =>
  attrs?.find((a) => a.id === id)?.value_name ?? undefined;

const LOGISTIC_LABELS: Record<string, string> = {
  fulfillment: "Full",
  self_service: "Flex",
  cross_docking: "Coleta",
  xd_drop_off: "Agência",
  drop_off: "Correios",
};

async function enrich(h: HighlightItem): Promise<Product> {
  const base: Product = { position: h.position, id: h.id, type: h.type, name: h.id };

  // 1) Em paralelo: ficha do catálogo (se PRODUCT), lista de ofertas (se PRODUCT/USER_PRODUCT) e subcategoria do highlight
  const hlKind = h.type === "ITEM" ? "item" : "product";
  const [info, offers, subHl] = await Promise.all([
    h.type === "PRODUCT" ? meli<any>(`/products/${h.id}`).catch(() => null) : Promise.resolve(null),
    h.type !== "ITEM"
      ? meli<{ results: Offer[] }>(`/products/${h.id}/items`)
          .then((r) => r.results ?? [])
          .catch(() => [] as Offer[])
      : Promise.resolve([] as Offer[]),
    meli<{ id?: string; label?: string; position?: number }>(
      `/highlights/${SITE}/${hlKind}/${h.id}`,
    ).catch(() => null),
  ]);

  const best = offers.reduce<Offer | undefined>(
    (a, o) => (!a || o.price < a.price ? o : a),
    undefined,
  );
  const prices = offers.map((o) => o.price).filter((p) => typeof p === "number" && p > 0);
  const maxPrice = prices.length ? Math.max(...prices) : undefined;
  const avgPrice = prices.length
    ? Math.round((prices.reduce((s, v) => s + v, 0) / prices.length) * 100) / 100
    : undefined;

  const itemId = best?.item_id ?? (h.type === "ITEM" ? h.id : undefined);
  const subcatId = best?.category_id ?? subHl?.id;
  const listingTypeId = best?.listing_type_id ?? "gold_special";

  // 2) Em paralelo: perguntas do item, tarifas de venda, detalhes da subcategoria
  const [questionsData, feeData, subcatDetails] = await Promise.all([
    itemId
      ? meli<{ total?: number; questions?: { seller_id?: number; date_created?: string }[] }>(
          `/questions/search?item=${itemId}&api_version=4`,
        ).catch(() => null)
      : Promise.resolve(null),
    best?.price && subcatId
      ? meli<any>(
          `/sites/${SITE}/listing_prices?price=${best.price}&category_id=${subcatId}&listing_type_id=${listingTypeId}`,
        ).catch(() => null)
      : Promise.resolve(null),
    subcatId ? getCategoryDetails(subcatId) : Promise.resolve(null),
  ]);

  const sellerId = best?.seller_id ?? questionsData?.questions?.[0]?.seller_id;
  const subcatLabel = subHl?.label ?? subcatDetails?.name;

  // 3) Em paralelo: reputação do vendedor, custo do frete grátis e imagem de fallback para MLBU/ITEM
  const searchQuery = [subcatLabel, sellerId ? "" : ""].filter(Boolean).join(" ").trim();
  const domainParam = subcatDetails?.catalogDomain
    ? `&domain_id=${encodeURIComponent(subcatDetails.catalogDomain)}`
    : "";

  const [seller, freeShipData, fallbackCatalog] = await Promise.all([
    sellerId ? meli<any>(`/users/${sellerId}`, 86_400).catch(() => null) : Promise.resolve(null),
    sellerId && itemId && best?.price
      ? meli<any>(
          `/users/${sellerId}/shipping_options/free?item_id=${itemId}&item_price=${best.price}&listing_type_id=${listingTypeId}&mode=${best.shipping?.mode ?? "me2"}&condition=${best.condition ?? "new"}&logistic_type=${best.shipping?.logistic_type ?? "fulfillment"}`,
        ).catch(() => null)
      : Promise.resolve(null),
    !info?.pictures?.[0]?.url && searchQuery
      ? meli<{ results?: any[] }>(
          `/products/search?status=active&site_id=${SITE}&q=${encodeURIComponent(searchQuery)}${domainParam}&limit=1`,
          86_400,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const original = best?.original_price ?? undefined;
  const sellerNick = seller?.nickname;
  const fallbackProduct = fallbackCatalog?.results?.[0];
  const resolvedImage: string | undefined =
    info?.pictures?.[0]?.url ?? fallbackProduct?.pictures?.[0]?.url;

  // Nome legível mesmo para USER_PRODUCT e ITEM
  const resolvedName =
    info?.name ??
    (subcatLabel && sellerNick
      ? `${subcatLabel} · ${sellerNick}`
      : fallbackProduct?.name
        ? `${subcatLabel ?? fallbackProduct.name} (${h.id})`
        : subcatLabel
          ? `${subcatLabel} (${h.id})`
          : `Produto ${h.id}`);

  // Idade do produto (dias ativos)
  const dateCreated: string | undefined = info?.date_created;
  const daysActive = dateCreated
    ? Math.max(1, Math.round((Date.now() - new Date(dateCreated).getTime()) / 86_400_000))
    : undefined;

  // Cálculos financeiros (Tarifa ML, Frete, Imposto Simples 6%, Recebimento Líquido e Faixa de Preço p/ Lucro)
  const price = best?.price;
  const saleFeeAmount: number | undefined = feeData?.sale_fee_amount;
  const saleFeePercent: number | undefined = feeData?.sale_fee_details?.percentage_fee;
  const fixedFeeAmount: number | undefined = feeData?.sale_fee_details?.fixed_fee;
  const shippingListCost: number | undefined = freeShipData?.coverage?.all_country?.list_cost;
  const billableWeightGrams: number | undefined =
    freeShipData?.coverage?.all_country?.billable_weight;

  const sellerShippingDeduction = best?.shipping?.free_shipping ? (shippingListCost ?? 0) : 0;
  const netReceived =
    price != null && saleFeeAmount != null
      ? Math.max(0, Math.round((price - saleFeeAmount - sellerShippingDeduction) * 100) / 100)
      : undefined;

  const estimatedTaxPercent = 6; // Referência Simples Nacional comércio (6%)
  const estimatedTaxAmount =
    price != null ? Math.round(price * (estimatedTaxPercent / 100) * 100) / 100 : undefined;
  const netAfterTax =
    netReceived != null && estimatedTaxAmount != null
      ? Math.round((netReceived - estimatedTaxAmount) * 100) / 100
      : undefined;

  // Faixa de preço recomendada para ter de 15% a 25% de margem líquida assumindo CMV de 45% do preço atual
  const feeRate = (saleFeePercent ?? 14) / 100;
  const taxRate = estimatedTaxPercent / 100;
  const estProductCost = price != null ? price * 0.45 : undefined;
  const fixedCosts = (fixedFeeAmount ?? 0) + sellerShippingDeduction;
  const profitPriceMin =
    estProductCost != null
      ? Math.round(
          ((estProductCost + fixedCosts) / Math.max(0.15, 1 - feeRate - taxRate - 0.15)) * 100,
        ) / 100
      : undefined;
  const profitPriceMax =
    estProductCost != null
      ? Math.round(
          ((estProductCost + fixedCosts) / Math.max(0.15, 1 - feeRate - taxRate - 0.25)) * 100,
        ) / 100
      : undefined;

  // Estimativa de vendas híbrida:
  // 1) Se o anúncio possui perguntas (/questions/search), 1 pergunta equivale em média a ~8 vendas no ML.
  //    Além disso, medimos a velocidade das perguntas recentes (datas do lote retornado) para estimar o ritmo diário atual.
  // 2) Se o item vencedor do buybox tem 0 perguntas (ex.: oferta recém-criada num produto Top 20 de catálogo),
  //    usamos uma curva de Pareto (Zipf) baseada na posição do ranking (#1 a #20) e no porte da subcategoria.
  const questionsTotal = questionsData?.total ?? 0;
  const qDates = (questionsData?.questions ?? [])
    .map((q) => (q.date_created ? new Date(q.date_created).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  const effectiveDays = daysActive ?? 180;
  const rankBaselineDaily = Math.max(
    1.2,
    Math.round((28 / Math.pow(Math.max(1, h.position), 0.55)) * 10) / 10,
  );

  let estimatedSales: number;
  let estimatedDailySales: number;

  if (questionsTotal > 0) {
    estimatedSales = questionsTotal * 8;
    const lifetimeDaily = estimatedSales / effectiveDays;
    if (qDates.length >= 2) {
      const oldestRecent = Math.min(...qDates);
      const spanDays = Math.max(1, (Date.now() - oldestRecent) / 86_400_000);
      const recentDaily = (qDates.length * 8) / spanDays;
      estimatedDailySales = Math.max(0.5, Math.round((recentDaily * 0.6 + lifetimeDaily * 0.4) * 10) / 10);
    } else {
      estimatedDailySales = Math.max(0.5, Math.round(lifetimeDaily * 10) / 10);
    }
  } else {
    estimatedDailySales = rankBaselineDaily;
    estimatedSales = Math.round(estimatedDailySales * Math.min(effectiveDays, 120));
  }

  const estimatedMonthlySales = Math.round(estimatedDailySales * 30);
  const estimatedMonthlyRevenue =
    price != null ? Math.round(estimatedMonthlySales * price) : undefined;

  const city = best?.seller_address?.city?.name ?? seller?.address?.city;
  const state = best?.seller_address?.state?.name ?? seller?.address?.state;

  return {
    ...base,
    itemId,
    name: resolvedName,
    familyName: info?.family_name ?? undefined,
    image: resolvedImage,
    picturesCount: info?.pictures?.length ?? undefined,
    permalink:
      h.type === "PRODUCT"
        ? `https://www.mercadolivre.com.br/p/${h.id}`
        : itemId
          ? itemLink(itemId)
          : undefined,

    brand: getAttr(info?.attributes, "BRAND"),
    model: getAttr(info?.attributes, "MODEL"),
    color: getAttr(info?.attributes, "COLOR"),
    weight: getAttr(info?.attributes, "WEIGHT"),
    dimensions: getAttr(info?.attributes, "DIMENSIONS"),
    mainFeatures: (info?.main_features ?? [])
      .map((f: any) => f.text?.trim())
      .filter(Boolean)
      .slice(0, 3),
    qualityType: info?.quality_type ?? undefined,
    dateCreated,
    daysActive,

    subcategoryId: subcatId,
    subcategoryName: subcatLabel,
    subcategoryPosition: subHl?.position,
    subcategoryTotalItems: subcatDetails?.totalItems,

    price,
    maxPrice,
    avgPrice,
    originalPrice: original,
    discount:
      price && original && original > price
        ? Math.round((1 - price / original) * 100)
        : undefined,
    offers: offers.length || undefined,
    condition: best?.condition,
    warranty: best?.warranty,
    listingTypeId: best?.listing_type_id,
    listingTypeName: feeData?.listing_type_name,
    freeShipping: best?.shipping?.free_shipping,
    logisticType: best?.shipping?.logistic_type
      ? (LOGISTIC_LABELS[best.shipping.logistic_type] ?? best.shipping.logistic_type)
      : undefined,
    officialStore: best ? best.official_store_id != null : undefined,
    officialStoreId: best?.official_store_id ?? undefined,

    saleFeeAmount,
    saleFeePercent,
    fixedFeeAmount,
    shippingListCost,
    billableWeightGrams,
    estimatedTaxPercent,
    estimatedTaxAmount,
    netReceived,
    netAfterTax,
    profitPriceMin,
    profitPriceMax,

    questionsTotal,
    estimatedSales,
    estimatedDailySales,
    estimatedMonthlySales,
    estimatedMonthlyRevenue,

    sellerId,
    sellerNickname: sellerNick,
    sellerPermalink: seller?.permalink,
    sellerUserType: seller?.user_type,
    sellerLocation: [city, state].filter(Boolean).join(" - ") || undefined,
    sellerLevel: seller?.seller_reputation?.level_id,
    sellerPowerStatus: seller?.seller_reputation?.power_seller_status,
    sellerTotalTransactions: seller?.seller_reputation?.transactions?.total,
  };
}

async function getHighlights(categoryId: string): Promise<HighlightItem[]> {
  const { content } = await meli<{ content: HighlightItem[] }>(
    `/highlights/${SITE}/category/${categoryId}`,
  );
  return content;
}

export async function getBestSellers(categoryId: string): Promise<Product[]> {
  const content = await getHighlights(categoryId);
  return mapPool(content.slice(0, 20), 6, enrich);
}

/** Maior desconto; em empate, menor preço. Ignora quem não tem desconto. */
export function pickBest(products: Product[]): Product | undefined {
  return products
    .filter((p) => p.discount != null)
    .sort((a, b) => b.discount! - a.discount! || (a.price ?? 0) - (b.price ?? 0))[0];
}

/** O 1º colocado de cada categoria. */
export async function getTopOfAllCategories(): Promise<Product[]> {
  const categories = await getCategories();
  const tops = await mapPool<Category, Product | null>(categories, 6, async (c) => {
    try {
      const first = (await getHighlights(c.id))[0];
      if (!first) return null;
      return { ...(await enrich(first)), categoryId: c.id, categoryName: c.name };
    } catch {
      return null;
    }
  });
  return tops.filter((p): p is Product => p != null);
}

/** Coleta todas as categorias, produtos, métricas e tendências para salvar em JSON estático (GitHub Pages). */
export async function generateFullSnapshot(
  onProgress?: (msg: string) => void,
): Promise<MeliSnapshot> {
  const [cats, generalTrends] = await Promise.all([getCategories(), getTrends()]);
  const categorySnapshots = await mapPool<Category, CategorySnapshot>(cats, 3, async (c, idx) => {
    onProgress?.(`[${idx + 1}/${cats.length}] Coletando ${c.name} (${c.id})...`);
    const [details, trends, products] = await Promise.all([
      getCategoryDetails(c.id),
      getTrends(c.id),
      getBestSellers(c.id).catch(() => [] as Product[]),
    ]);
    return {
      id: c.id,
      name: c.name,
      details,
      trends,
      products: products.map((p) => ({ ...p, categoryId: c.id, categoryName: c.name })),
    };
  });

  const topOfAll = categorySnapshots
    .map((cs) => cs.products[0])
    .filter((p): p is Product => p != null);

  return {
    updatedAt: new Date().toISOString(),
    siteId: SITE,
    generalTrends,
    categories: categorySnapshots,
    topOfAll,
  };
}
