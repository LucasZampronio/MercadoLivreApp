import { mapPool, meli, SITE } from "./client.ts";
import { calculateFinancialBreakdown, calculateSalesEstimates } from "./formulas.ts";
import type {
  Category,
  CategoryDetails,
  CategorySnapshot,
  HighlightItem,
  MeliSnapshot,
  Offer,
  Product,
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

async function enrich(h: HighlightItem): Promise<Product> {
  const base: Product = { position: h.position, id: h.id, type: h.type, name: h.id };

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

  const searchQuery = [subcatLabel].filter(Boolean).join(" ").trim();
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

  const resolvedName =
    info?.name ??
    (subcatLabel && sellerNick
      ? `${subcatLabel} · ${sellerNick}`
      : fallbackProduct?.name
        ? `${subcatLabel ?? fallbackProduct.name} (${h.id})`
        : subcatLabel
          ? `${subcatLabel} (${h.id})`
          : `Produto ${h.id}`);

  const dateCreated: string | undefined = info?.date_created;
  const daysActive = dateCreated
    ? Math.max(1, Math.round((Date.now() - new Date(dateCreated).getTime()) / 86_400_000))
    : undefined;

  const price = best?.price;
  const saleFeeAmount: number | undefined = feeData?.sale_fee_amount;
  const saleFeePercent: number | undefined = feeData?.sale_fee_details?.percentage_fee;
  const fixedFeeAmount: number | undefined = feeData?.sale_fee_details?.fixed_fee;
  const shippingListCost: number | undefined = freeShipData?.coverage?.all_country?.list_cost;
  const billableWeightGrams: number | undefined =
    freeShipData?.coverage?.all_country?.billable_weight;

  const fin = calculateFinancialBreakdown({
    price,
    saleFeeAmount,
    saleFeePercent,
    fixedFeeAmount,
    shippingListCost,
    freeShipping: best?.shipping?.free_shipping,
  });

  const sales = calculateSalesEstimates({
    position: h.position,
    questionsTotal: questionsData?.total,
    recentQuestionDates: (questionsData?.questions ?? [])
      .map((q) => q.date_created)
      .filter((d): d is string => Boolean(d)),
    daysActive,
    price,
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
    estimatedTaxPercent: fin.estimatedTaxPercent,
    estimatedTaxAmount: fin.estimatedTaxAmount,
    netReceived: fin.netReceived,
    netAfterTax: fin.netAfterTax,
    profitPriceMin: fin.profitPriceMin,
    profitPriceMax: fin.profitPriceMax,

    questionsTotal: sales.questionsTotal,
    estimatedSales: sales.estimatedSales,
    estimatedDailySales: sales.estimatedDailySales,
    estimatedMonthlySales: sales.estimatedMonthlySales,
    estimatedMonthlyRevenue: sales.estimatedMonthlyRevenue,

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
