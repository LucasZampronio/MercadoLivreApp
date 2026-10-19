import { mapPool, meli, SITE } from "./client.ts";
import {
  calculateFinancialBreakdown,
  calculateSalesEstimates,
  estimateItemDateFromMlbId,
} from "./formulas.ts";
import type {
  Category,
  CategoryDetails,
  CategorySnapshot,
  HighlightItem,
  MeliSnapshot,
  Offer,
  Product,
  SubcategorySummary,
  Trend,
} from "./types.ts";

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

const enrichedByIdCache = new Map<string, Promise<Product>>();

export function getCategories() {
  return meli<Category[]>(`/sites/${SITE}/categories`, 86_400);
}

export async function getCategoryDetails(categoryId: string): Promise<CategoryDetails | null> {
  try {
    const c = await meli<any>(`/categories/${categoryId}`, 86_400);
    const childrenCategories: SubcategorySummary[] = Array.isArray(c.children_categories)
      ? c.children_categories
          .map((ch: any) => ({
            id: String(ch.id),
            name: String(ch.name),
            totalItems: Number(ch.total_items_in_this_category ?? 0),
          }))
          .sort((a: SubcategorySummary, b: SubcategorySummary) => b.totalItems - a.totalItems)
      : [];

    return {
      id: c.id,
      name: c.name,
      totalItems: c.total_items_in_this_category ?? 0,
      pathFromRoot: (c.path_from_root ?? []).map((p: any) => p.name),
      catalogDomain: c.settings?.catalog_domain ?? undefined,
      childrenCategories,
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

type EnrichCandidate = HighlightItem & {
  presetSubcat?: SubcategorySummary & { position: number };
};

async function enrichRaw(h: EnrichCandidate): Promise<Product> {
  const base: Product = { position: h.position, id: h.id, type: h.type, name: h.id };

  const hlKind = h.type === "ITEM" ? "item" : "product";
  const [info, offers, subHl] = await Promise.all([
    h.type === "PRODUCT"
      ? meli<any>(`/products/${h.id}`, 86_400).catch(() => null)
      : Promise.resolve(null),
    h.type !== "ITEM"
      ? meli<{ results: Offer[] }>(`/products/${h.id}/items`, 3600)
          .then((r) => r.results ?? [])
          .catch(() => [] as Offer[])
      : Promise.resolve([] as Offer[]),
    h.presetSubcat
      ? Promise.resolve({
          id: h.presetSubcat.id,
          label: h.presetSubcat.name,
          position: h.presetSubcat.position,
        })
      : meli<{ id?: string; label?: string; position?: number }>(
          `/highlights/${SITE}/${hlKind}/${h.id}`,
          86_400,
        ).catch(() => null),
  ]);

  // offers[0] em /products/{id}/items é o Buy Box Winner oficial do catálogo
  const best = offers.find((o) => typeof o.price === "number" && o.price > 0) ?? offers[0];
  const prices = offers.map((o) => o.price).filter((p) => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const maxPrice = prices.length ? Math.max(...prices) : undefined;
  const avgPrice = prices.length
    ? Math.round((prices.reduce((s, v) => s + v, 0) / prices.length) * 100) / 100
    : undefined;

  const itemId = best?.item_id ?? (h.type === "ITEM" ? h.id : undefined);
  const subcatId = best?.category_id ?? subHl?.id ?? h.presetSubcat?.id;
  const listingTypeId = best?.listing_type_id ?? "gold_special";

  // Arredonda o preço na chamada de listing_prices para aproveitar o cache entre ofertas de mesma faixa
  const feePriceKey = best?.price ? Math.round(best.price) : undefined;

  const [questionsData, feeData, subcatDetails, descData] = await Promise.all([
    itemId
      ? meli<{ total?: number; questions?: { seller_id?: number; date_created?: string }[] }>(
          `/questions/search?item=${itemId}&api_version=4`,
          3600,
        ).catch(() => null)
      : Promise.resolve(null),
    feePriceKey && subcatId
      ? meli<any>(
          `/sites/${SITE}/listing_prices?price=${feePriceKey}&category_id=${subcatId}&listing_type_id=${listingTypeId}`,
          86_400,
        ).catch(() => null)
      : Promise.resolve(null),
    h.presetSubcat && (!info?.pictures?.[0]?.url ? false : true)
      ? Promise.resolve<CategoryDetails>({
          id: h.presetSubcat.id,
          name: h.presetSubcat.name,
          totalItems: h.presetSubcat.totalItems,
          pathFromRoot: [h.presetSubcat.name],
        })
      : subcatId
        ? getCategoryDetails(subcatId)
        : Promise.resolve(null),
    itemId
      ? meli<{ date_created?: string; last_updated?: string }>(
          `/items/${itemId}/description`,
          86_400,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const sellerId = best?.seller_id ?? questionsData?.questions?.[0]?.seller_id;
  const subcatLabel = subHl?.label ?? subcatDetails?.name ?? h.presetSubcat?.name;

  const searchQuery = [subcatLabel].filter(Boolean).join(" ").trim();
  const domainParam = subcatDetails?.catalogDomain
    ? `&domain_id=${encodeURIComponent(subcatDetails.catalogDomain)}`
    : "";

  const [seller, freeShipData, fallbackCatalog] = await Promise.all([
    sellerId ? meli<any>(`/users/${sellerId}`, 86_400).catch(() => null) : Promise.resolve(null),
    sellerId && itemId && best?.price
      ? meli<any>(
          `/users/${sellerId}/shipping_options/free?item_id=${itemId}&item_price=${best.price}&listing_type_id=${listingTypeId}&mode=${best.shipping?.mode ?? "me2"}&condition=${best.condition ?? "new"}&logistic_type=${best.shipping?.logistic_type ?? "fulfillment"}`,
          86_400,
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

  const resolvedName =
    info?.name ??
    (subcatLabel && sellerNick
      ? `${subcatLabel} · ${sellerNick}`
      : fallbackProduct?.name
        ? `${subcatLabel ?? fallbackProduct.name} (${h.id})`
        : subcatLabel
          ? `${subcatLabel} (${h.id})`
          : `Produto ${h.id}`);

  const dateCreated: string | undefined = info?.date_created ?? fallbackProduct?.date_created;
  const daysActive = dateCreated
    ? Math.max(1, Math.round((Date.now() - new Date(dateCreated).getTime()) / 86_400_000))
    : undefined;

  const itemDateIsEstimated = !descData?.date_created;
  const itemDateCreated: string | undefined =
    descData?.date_created || estimateItemDateFromMlbId(itemId, dateCreated);
  const itemDaysActive = itemDateCreated
    ? Math.max(1, Math.round((Date.now() - new Date(itemDateCreated).getTime()) / 86_400_000))
    : daysActive;

  const price = best?.price;
  const saleFeePercent: number | undefined = feeData?.sale_fee_details?.percentage_fee;
  const fixedFeeAmount: number | undefined = feeData?.sale_fee_details?.fixed_fee;
  const saleFeeAmount: number | undefined =
    price != null && saleFeePercent != null
      ? Math.round((price * (saleFeePercent / 100) + (fixedFeeAmount ?? 0)) * 100) / 100
      : feeData?.sale_fee_amount;
  const shippingListCost: number | undefined = freeShipData?.coverage?.all_country?.list_cost;
  const billableWeightGrams: number | undefined =
    freeShipData?.coverage?.all_country?.billable_weight;

  const isFull = best?.shipping?.logistic_type === "fulfillment";
  const isOfficialStore = best ? best.official_store_id != null : false;
  const sellerTotalTransactions: number | undefined =
    seller?.seller_reputation?.transactions?.total;
  const subcatTotalItems = subcatDetails?.totalItems ?? h.presetSubcat?.totalItems;

  const fin = calculateFinancialBreakdown({
    price,
    saleFeeAmount,
    saleFeePercent,
    fixedFeeAmount,
    shippingListCost,
    freeShipping: best?.shipping?.free_shipping,
  });

  const sales = calculateSalesEstimates({
    position: h.presetSubcat?.position ?? h.position,
    subcategoryPosition: subHl?.position ?? h.presetSubcat?.position,
    subcategoryTotalItems: subcatTotalItems,
    offers: offers.length || 1,
    questionsTotal: questionsData?.total,
    recentQuestionDates: (questionsData?.questions ?? [])
      .map((q) => q.date_created)
      .filter((d): d is string => Boolean(d)),
    daysActive,
    itemDaysActive,
    price,
    isFull,
    freeShipping: best?.shipping?.free_shipping,
    officialStore: isOfficialStore,
    sellerTotalTransactions,
  });

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
    itemDateCreated,
    itemDaysActive,
    itemDateIsEstimated,

    subcategoryId: subcatId,
    subcategoryName: subcatLabel,
    subcategoryPosition: subHl?.position ?? h.presetSubcat?.position,
    subcategoryTotalItems: subcatTotalItems,

    price,
    minPrice,
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
    estimatedTaxPercent: fin.estimatedTaxPercent,
    estimatedTaxAmount: fin.estimatedTaxAmount,
    netReceived: fin.netReceived,
    netAfterTax: fin.netAfterTax,
    netReceivePercent: fin.netReceivePercent,
    recommendedCostMin: fin.recommendedCostMin,
    recommendedCostMax: fin.recommendedCostMax,
    profitPriceMin: fin.profitPriceMin,
    profitPriceMax: fin.profitPriceMax,

    questionsTotal: sales.questionsTotal,
    soldQuantity: sales.soldQuantity,
    estimatedStock: sales.estimatedStock,
    estimatedSales: sales.estimatedSales,
    currentMonthlyPace: sales.currentMonthlyPace,
    estimatedVisits: sales.estimatedVisits,
    conversionRatePercent: sales.conversionRatePercent,
    estimatedDailySales: sales.estimatedDailySales,
    estimatedMonthlySales: sales.estimatedMonthlySales,
    estimatedMonthlyRevenue: sales.estimatedMonthlyRevenue,
    estimatedTotalRevenue: sales.estimatedTotalRevenue,

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

async function enrich(h: EnrichCandidate): Promise<Product> {
  let cached = enrichedByIdCache.get(h.id);
  if (!cached) {
    cached = enrichRaw(h);
    enrichedByIdCache.set(h.id, cached);
  }
  const prod = await cached;
  return {
    ...prod,
    position: h.position,
    subcategoryId: prod.subcategoryId ?? h.presetSubcat?.id,
    subcategoryName: prod.subcategoryName ?? h.presetSubcat?.name,
    subcategoryPosition: prod.subcategoryPosition ?? h.presetSubcat?.position,
    subcategoryTotalItems: prod.subcategoryTotalItems ?? h.presetSubcat?.totalItems,
  };
}

async function getHighlights(categoryId: string): Promise<HighlightItem[]> {
  const { content } = await meli<{ content: HighlightItem[] }>(
    `/highlights/${SITE}/category/${categoryId}`,
    3600,
  );
  return Array.isArray(content) ? content : [];
}

/**
 * Coleta os mais vendidos da categoria raiz (Top 20) + os mais vendidos das
 * maiores subcategorias filhas (`childrenCategories`), eliminando duplicados.
 */
export async function getBestSellers(
  categoryId: string,
  details?: CategoryDetails | null,
  maxSubcategories = 5,
): Promise<Product[]> {
  const catDetails = details !== undefined ? details : await getCategoryDetails(categoryId);
  const topSubcats = (catDetails?.childrenCategories ?? []).slice(0, maxSubcategories);

  const [rootContent, ...subContents] = await Promise.all([
    getHighlights(categoryId).catch(() => [] as HighlightItem[]),
    ...topSubcats.map((sub) => getHighlights(sub.id).catch(() => [] as HighlightItem[])),
  ]);

  const seenIds = new Set<string>();
  const candidates: EnrichCandidate[] = [];

  for (const item of rootContent.slice(0, 20)) {
    if (!item?.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    candidates.push({ ...item, position: candidates.length + 1 });
  }

  for (let sIdx = 0; sIdx < topSubcats.length; sIdx++) {
    const sub = topSubcats[sIdx];
    const items = subContents[sIdx] ?? [];
    for (const item of items.slice(0, 20)) {
      if (!item?.id || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      candidates.push({
        ...item,
        position: candidates.length + 1,
        presetSubcat: {
          id: sub.id,
          name: sub.name,
          totalItems: sub.totalItems,
          position: item.position,
        },
      });
    }
  }

  return mapPool(candidates, 12, enrich);
}

export function pickBest(products: Product[]): Product | undefined {
  return products
    .filter((p) => p.discount != null)
    .sort((a, b) => b.discount! - a.discount! || (a.price ?? 0) - (b.price ?? 0))[0];
}

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

export async function generateFullSnapshot(
  onProgress?: (msg: string) => void,
): Promise<MeliSnapshot> {
  const [cats, generalTrends] = await Promise.all([getCategories(), getTrends()]);
  const categorySnapshots = await mapPool<Category, CategorySnapshot>(cats, 4, async (c, idx) => {
    const details = await getCategoryDetails(c.id);
    const subCount = Math.min(5, details?.childrenCategories?.length ?? 0);
    onProgress?.(
      `[${idx + 1}/${cats.length}] Coletando ${c.name} (${c.id}) + ${subCount} subcategorias...`,
    );
    const [trends, products] = await Promise.all([
      getTrends(c.id),
      getBestSellers(c.id, details, 5).catch(() => [] as Product[]),
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
