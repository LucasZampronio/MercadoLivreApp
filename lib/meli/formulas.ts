/**
 * Fórmulas financeiras (100% exatas sobre dados oficiais da API) e
 * estimativas estatísticas multi-sinal (sinalizadas na UI com "≈").
 * Documentação detalhada em: docs/formulas-e-estimativas.md
 */

export const DEFAULT_TAX_PERCENT = 7; // Alíquota padrão estilo Avantpro (7,00%)
export const DEFAULT_CMV_PERCENT = 45; // Custo da Mercadoria Vendida padrão para simulação de lucro

/**
 * Degraus oficiais exibidos pelo Mercado Livre nos badges "+X vendidos"
 */
export const ML_SOLD_TIERS = [
  5, 25, 50, 100, 250, 500, 1000, 5000, 10000, 50000, 100000, 250000,
] as const;

/**
 * Âncoras reais calibradas a partir de `GET /items/{id}/description` (date_created)
 * para interpolar a data de criação do anúncio quando o item não possui texto de descrição.
 */
const MLB_ID_DATE_ANCHORS: readonly [number, number][] = [
  [1_100_000_000, Date.parse("2018-09-01T00:00:00Z")],
  [1_500_000_000, Date.parse("2020-05-01T00:00:00Z")],
  [2_171_568_742, Date.parse("2022-02-09T13:40:08Z")],
  [2_754_855_144, Date.parse("2022-08-12T13:38:24Z")],
  [3_399_022_201, Date.parse("2023-08-03T18:35:17Z")],
  [3_658_693_539, Date.parse("2024-04-15T19:53:37Z")],
  [4_268_042_659, Date.parse("2024-11-15T12:00:00Z")],
  [5_314_914_634, Date.parse("2025-03-12T12:24:57Z")],
  [5_736_190_284, Date.parse("2025-09-23T19:20:34Z")],
  [6_696_013_250, Date.parse("2026-04-30T19:40:32Z")],
  [6_929_873_368, Date.parse("2026-06-09T21:20:16Z")],
  [7_827_546_312, Date.parse("2026-10-16T19:43:06Z")],
];

/**
 * Interpola a data de criação aproximada de um `MLB{id}` sequencial caso
 * `/items/{id}/description` não retorne `date_created`.
 */
export function estimateItemDateFromMlbId(
  itemId?: string,
  catalogDateCreated?: string,
): string | undefined {
  if (!itemId) return catalogDateCreated;
  const num = Number(itemId.replace(/\D+/g, ""));
  if (!Number.isFinite(num) || num < 500_000_000) return catalogDateCreated;

  let ts: number;
  if (num <= MLB_ID_DATE_ANCHORS[0][0]) {
    ts = MLB_ID_DATE_ANCHORS[0][1];
  } else if (num >= MLB_ID_DATE_ANCHORS[MLB_ID_DATE_ANCHORS.length - 1][0]) {
    ts = MLB_ID_DATE_ANCHORS[MLB_ID_DATE_ANCHORS.length - 1][1];
  } else {
    ts = MLB_ID_DATE_ANCHORS[0][1];
    for (let i = 0; i < MLB_ID_DATE_ANCHORS.length - 1; i++) {
      const [id0, t0] = MLB_ID_DATE_ANCHORS[i];
      const [id1, t1] = MLB_ID_DATE_ANCHORS[i + 1];
      if (num >= id0 && num <= id1) {
        const ratio = (num - id0) / Math.max(1, id1 - id0);
        ts = Math.round(t0 + ratio * (t1 - t0));
        break;
      }
    }
  }

  return new Date(Math.min(Date.now() - 86_400_000, ts)).toISOString();
}

export type SalesEstimateInput = {
  position: number;
  subcategoryPosition?: number;
  subcategoryTotalItems?: number;
  offers?: number;
  questionsTotal?: number;
  recentQuestionDates?: string[];
  daysActive?: number;
  itemDaysActive?: number;
  price?: number;
  isFull?: boolean;
  freeShipping?: boolean;
  officialStore?: boolean;
  sellerTotalTransactions?: number;
};

export type SalesEstimateResult = {
  questionsTotal: number;
  soldQuantity: number;
  estimatedStock: number;
  estimatedSales: number;
  currentMonthlyPace: number;
  estimatedVisits: number;
  conversionRatePercent: number;
  estimatedDailySales: number;
  estimatedMonthlySales: number;
  estimatedMonthlyRevenue?: number;
  estimatedTotalRevenue?: number;
  method: "questions" | "ranking_pareto";
};

/**
 * Calcula estimativas multi-sinal combinando:
 * 1. Posição na categoria (#1..#20) e na subcategoria (`/highlights`)
 * 2. Tamanho do mercado da subcategoria (`subcategoryTotalItems` via `/categories/{id}`)
 * 3. Quantidade de ofertas disputando o catálogo (`offers` via `/products/{id}/items`)
 * 4. Elasticidade de preço (`price`: itens de ticket baixo giram mais unidades que ticket alto)
 * 5. Total e velocidade real de perguntas (`questionsTotal` e `recentQuestionDates` via `/questions/search`)
 * 6. Teto de transações reais da conta do vendedor (`sellerTotalTransactions` via `/users/{id}`) para anúncios de oferta única
 */
export function calculateSalesEstimates(input: SalesEstimateInput): SalesEstimateResult {
  const questionsTotal = input.questionsTotal ?? 0;
  const effectiveDays = Math.max(1, input.daysActive ?? input.itemDaysActive ?? 180);
  const pos = Math.max(1, input.position);
  const subPos = Math.max(1, input.subcategoryPosition ?? pos);
  const offersCount = Math.max(1, input.offers ?? 1);
  const price = input.price && input.price > 0 ? input.price : 120;
  const subcatSize = Math.max(200, input.subcategoryTotalItems ?? 15_000);

  const qTimestamps = (input.recentQuestionDates ?? [])
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  // Multiplicador de vendas por pergunta ajustado pelo ticket do produto
  // Ticket baixo (~R$30) tem menos perguntas por venda (~16x); ticket alto (>R$800) tem mais dúvidas (~6x)
  const salesPerQuestion = Math.min(
    18,
    Math.max(5.5, 14.5 * Math.pow(100 / Math.max(25, price), 0.22)),
  );

  // Fator de tamanho da subcategoria (subcategorias gigantes vendem mais que nichos pequenos)
  const marketSizeFactor = Math.min(1.45, Math.max(0.45, Math.pow(subcatSize / 25_000, 0.2)));

  // Fator de elasticidade de preço (itens baratos têm giro diário de unidades maior)
  const priceVelocityFactor = Math.min(1.6, Math.max(0.35, Math.pow(160 / price, 0.24)));

  // Fator de competição no catálogo (mais vendedores no mesmo catálogo = maior giro agregado)
  const catalogFactor =
    offersCount > 1 ? 1 + Math.min(0.65, Math.log10(offersCount) * 0.35) : 0.85;

  // Velocidade diária base multi-sinal
  const rankDaily =
    (18 / Math.pow(pos, 0.54)) *
    marketSizeFactor *
    priceVelocityFactor *
    catalogFactor *
    (subPos === 1 ? 1.12 : subPos <= 3 ? 1.04 : 0.96);

  // Velocidade via perguntas reais do anúncio
  let recentQuestionDaily = 0;
  if (qTimestamps.length >= 2) {
    const oldestRecent = Math.min(...qTimestamps);
    const spanDays = Math.max(1, (Date.now() - oldestRecent) / 86_400_000);
    recentQuestionDaily = (qTimestamps.length * salesPerQuestion) / spanDays;
  }
  const lifetimeQuestionDaily = (questionsTotal * salesPerQuestion) / effectiveDays;

  // Combina o sinal de perguntas reais com o modelo multi-sinal da categoria
  const blendedDaily =
    questionsTotal > 0
      ? Math.max(
          rankDaily * 0.75 + lifetimeQuestionDaily * 0.5,
          recentQuestionDaily * 0.65 + rankDaily * 0.45,
        )
      : rankDaily;

  let estimatedSales = Math.max(
    Math.round(questionsTotal * salesPerQuestion),
    Math.round(blendedDaily * effectiveDays),
  );

  // Se for anúncio de vendedor único (sem dezenas de ofertas de catálogo), limita pelo histórico real da conta do vendedor
  if (
    offersCount <= 2 &&
    input.sellerTotalTransactions != null &&
    input.sellerTotalTransactions > 0
  ) {
    const sellerCap = Math.max(
      Math.round(questionsTotal * salesPerQuestion),
      Math.round(input.sellerTotalTransactions * 0.65),
    );
    estimatedSales = Math.min(estimatedSales, Math.max(10, sellerCap));
  }

  // Degrau "+X Vendidos" correspondente ao volume estimado (igual à faixa exibida pelo ML)
  let soldQuantity = Math.max(5, Math.round(estimatedSales * 0.75));
  for (let i = ML_SOLD_TIERS.length - 1; i >= 0; i--) {
    if (estimatedSales >= ML_SOLD_TIERS[i]) {
      soldQuantity = ML_SOLD_TIERS[i];
      break;
    }
  }

  // Média diária e mensal histórica (consistente com o volume estimado e dias ativos)
  const estimatedDailySales = Math.max(1, Math.round(estimatedSales / effectiveDays));
  const monthsActive = Math.max(1 / 30, effectiveDays / 30);
  const historicalMonthlySales = Math.max(1, Math.round(estimatedSales / monthsActive));

  // Ritmo atual (vendas/mês nos últimos 30 dias enquanto está no Top 20)
  const currentDailyPace = Math.max(
    blendedDaily * (1 + (subPos === 1 ? 0.25 : 0.1) + (input.isFull ? 0.12 : 0)),
    recentQuestionDaily * 1.15,
    estimatedDailySales,
  );
  const currentMonthlyPace = Math.max(1, Math.round(currentDailyPace * 30));

  // Taxa de conversão (%) baseada em múltiplos sinais reais do anúncio (posição, preço, Full, Frete Grátis, Loja Oficial, Ofertas)
  const priceConvAdj = Math.min(2.2, Math.max(-2.8, Math.log10(180 / Math.max(15, price)) * 1.9));
  const rawConversion =
    8.4 +
    2.1 / Math.pow(pos, 0.48) +
    priceConvAdj +
    (input.isFull ? 1.35 : 0) +
    (input.freeShipping ? 0.65 : 0) +
    (input.officialStore ? 0.48 : 0) +
    Math.min(0.9, Math.log10(offersCount + 1) * 0.42);

  const conversionRatePercent = Math.round(Math.min(18.5, Math.max(2.4, rawConversion)) * 100) / 100;

  // Total de visitas acumuladas consistente com as vendas estimadas e a conversão
  const estimatedVisits = Math.max(
    estimatedSales * 5,
    Math.round(estimatedSales / (conversionRatePercent / 100)),
  );

  // Estoque disponível estimado ponderando logística, porte do vendedor e giro diário
  const sellerScale =
    input.sellerTotalTransactions != null && input.sellerTotalTransactions > 0
      ? Math.min(2.5, Math.max(0.5, Math.log10(input.sellerTotalTransactions) / 3.8))
      : 1;
  const estimatedStock = Math.max(
    5,
    Math.round(
      currentDailyPace *
        (input.isFull ? 2.4 : 1.4) *
        (input.officialStore ? 1.3 : 1) *
        sellerScale,
    ),
  );

  const estimatedMonthlyRevenue =
    input.price != null ? Math.round(currentMonthlyPace * input.price) : undefined;
  const estimatedTotalRevenue =
    input.price != null ? Math.round(estimatedSales * input.price * 100) / 100 : undefined;

  return {
    questionsTotal,
    soldQuantity,
    estimatedStock,
    estimatedSales,
    currentMonthlyPace,
    estimatedVisits,
    conversionRatePercent,
    estimatedDailySales,
    estimatedMonthlySales: historicalMonthlySales,
    estimatedMonthlyRevenue,
    estimatedTotalRevenue,
    method: questionsTotal > 0 ? "questions" : "ranking_pareto",
  };
}

export type FinancialBreakdownInput = {
  price?: number;
  saleFeeAmount?: number;
  saleFeePercent?: number;
  fixedFeeAmount?: number;
  shippingListCost?: number;
  freeShipping?: boolean;
  taxPercent?: number;
  cmvPercent?: number;
};

export type FinancialBreakdownResult = {
  netReceived?: number;
  estimatedTaxPercent: number;
  estimatedTaxAmount?: number;
  cmvAmount?: number;
  netAfterTax?: number;
  netReceivePercent?: number;
  recommendedCostMin?: number;
  recommendedCostMax?: number;
  netProfit?: number;
  netMarginPercent?: number;
  profitPriceMin?: number;
  profitPriceMax?: number;
};

/**
 * Calcula todas as métricas financeiras exatas sobre os dados oficiais de tarifa e frete da API:
 * - `estimatedTaxAmount`: Valor do imposto (`Preço * %Imposto`)
 * - `netReceived`: Repasse bruto do ML (`Preço - Comissão ML - Frete`)
 * - `netAfterTax` ("Recebe"): Valor líquido recebido após tarifas, frete e imposto (`Preço - Comissão ML - Frete - Imposto`)
 * - `netReceivePercent` ("% Recebe"): Percentual que sobra sobre o preço de venda (`(Recebe / Preço) * 100`)
 * - `recommendedCostMin` e `recommendedCostMax` ("Recomendação"): Faixa de custo/fornecedor recomendada (`50%` a `90%` do `Recebe`)
 * - `profitPriceMin` e `profitPriceMax`: Faixa de preço de venda sugerida para atingir 15% a 25% de margem líquida dado o CMV
 */
export function calculateFinancialBreakdown(
  input: FinancialBreakdownInput,
): FinancialBreakdownResult {
  const {
    price,
    saleFeeAmount,
    saleFeePercent,
    fixedFeeAmount,
    shippingListCost,
    freeShipping,
    taxPercent = DEFAULT_TAX_PERCENT,
    cmvPercent = DEFAULT_CMV_PERCENT,
  } = input;

  const sellerShippingDeduction = freeShipping ? (shippingListCost ?? 0) : 0;
  const effectiveFeeAmount =
    saleFeeAmount ?? (price != null ? Math.round(price * 0.14 * 100) / 100 : undefined);

  const netReceived =
    price != null && effectiveFeeAmount != null
      ? Math.max(0, Math.round((price - effectiveFeeAmount - sellerShippingDeduction) * 100) / 100)
      : undefined;

  const estimatedTaxAmount =
    price != null ? Math.round(price * (taxPercent / 100) * 100) / 100 : undefined;
  const cmvAmount =
    price != null ? Math.round(price * (cmvPercent / 100) * 100) / 100 : undefined;

  const netAfterTax =
    netReceived != null && estimatedTaxAmount != null
      ? Math.max(0, Math.round((netReceived - estimatedTaxAmount) * 100) / 100)
      : undefined;

  const netReceivePercent =
    netAfterTax != null && price != null && price > 0
      ? Math.round((netAfterTax / price) * 10000) / 100
      : undefined;

  // Recomendação Avantpro: faixa de custo máximo do produto entre 50% e 90% do líquido recebido ("Recebe")
  const recommendedCostMin =
    netAfterTax != null ? Math.floor(netAfterTax * 0.5 * 100) / 100 : undefined;
  const recommendedCostMax =
    netAfterTax != null ? Math.round(netAfterTax * 0.9 * 100) / 100 : undefined;

  const netProfit =
    netAfterTax != null && cmvAmount != null
      ? Math.round((netAfterTax - cmvAmount) * 100) / 100
      : undefined;

  const netMarginPercent =
    netProfit != null && price != null && price > 0
      ? Math.round((netProfit / price) * 100)
      : undefined;

  const feeRate = (saleFeePercent ?? 14) / 100;
  const taxRate = taxPercent / 100;
  const fixedCosts = (fixedFeeAmount ?? 0) + sellerShippingDeduction;

  const profitPriceMin =
    cmvAmount != null
      ? Math.round(((cmvAmount + fixedCosts) / Math.max(0.12, 1 - feeRate - taxRate - 0.15)) * 100) /
        100
      : undefined;

  const profitPriceMax =
    cmvAmount != null
      ? Math.round(((cmvAmount + fixedCosts) / Math.max(0.12, 1 - feeRate - taxRate - 0.25)) * 100) /
        100
      : undefined;

  return {
    netReceived,
    estimatedTaxPercent: taxPercent,
    estimatedTaxAmount,
    cmvAmount,
    netAfterTax,
    netReceivePercent,
    recommendedCostMin,
    recommendedCostMax,
    netProfit,
    netMarginPercent,
    profitPriceMin,
    profitPriceMax,
  };
}
