export type Category = {
  id: string;
  name: string;
};

export type Trend = {
  keyword: string;
  url: string;
};

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

  // Catálogo / Ficha técnica (/products/{id} + /items/{id}/description)
  brand?: string;
  model?: string;
  color?: string;
  weight?: string;
  dimensions?: string;
  mainFeatures?: string[];
  qualityType?: string;
  dateCreated?: string;
  daysActive?: number;
  itemDateCreated?: string;
  itemDaysActive?: number;

  // Categoria & Subcategoria (/highlights/MLB/{type}/{id} + /categories/{id})
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  subcategoryPosition?: number;
  subcategoryTotalItems?: number;

  // Ofertas & Preços (/products/{id}/items)
  price?: number;
  minPrice?: number;
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

  // Financeiro: Tarifas ML, Frete, Imposto, Recebimento Líquido e Recomendação (/sites/MLB/listing_prices + /shipping_options/free)
  saleFeeAmount?: number;
  saleFeePercent?: number;
  fixedFeeAmount?: number;
  shippingListCost?: number;
  billableWeightGrams?: number;
  estimatedTaxPercent?: number;
  estimatedTaxAmount?: number;
  netReceived?: number;
  netAfterTax?: number;
  netReceivePercent?: number;
  recommendedCostMin?: number;
  recommendedCostMax?: number;
  profitPriceMin?: number;
  profitPriceMax?: number;

  // Demanda, Tráfego, Conversão e Faturamento (estilo Avantpro)
  questionsTotal?: number;
  soldQuantity?: number;
  estimatedStock?: number;
  estimatedSales?: number;
  currentMonthlyPace?: number;
  estimatedVisits?: number;
  conversionRatePercent?: number;
  estimatedDailySales?: number;
  estimatedMonthlySales?: number;
  estimatedMonthlyRevenue?: number;
  estimatedTotalRevenue?: number;

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

export type HighlightItem = {
  id: string;
  position: number;
  type: string;
};

export type Offer = {
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

