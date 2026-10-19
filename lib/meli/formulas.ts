/**
 * Fórmulas financeiras e estatísticas de inteligência de mercado (estilo Avantpro).
 * Documentação detalhada em: docs/formulas-e-estimativas.md
 */

export const QUESTIONS_TO_SALES_MULTIPLIER = 8; // Benchmark ML: ~1 pergunta a cada 8 vendas (~12,5% perguntam)
export const DEFAULT_TAX_PERCENT = 7; // Alíquota padrão estilo Avantpro (7,00%)
export const DEFAULT_CMV_PERCENT = 45; // Custo da Mercadoria Vendida padrão para simulação de lucro

/**
 * Faixas oficiais exibidas pelo Mercado Livre nos badges "+X vendidos"
 */
export const ML_SOLD_TIERS = [
  5, 25, 50, 100, 250, 500, 1000, 5000, 10000, 50000, 100000, 250000,
] as const;

/**
 * Âncoras reais calibradas a partir de `GET /items/{id}/description` (date_created)
 * para estimar a data de criação do anúncio quando o item não possui texto de descrição.
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
export function estimateItemDateFromMlbId(itemId?: string, catalogDateCreated?: string): string | undefined {
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
  offers?: number;
  questionsTotal?: number;
  recentQuestionDates?: string[];
  daysActive?: number;
  itemDaysActive?: number;
  price?: number;
  isFull?: boolean;
  freeShipping?: boolean;
  officialStore?: boolean;
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
 * Calcula o pacote completo de métricas de demanda, tráfego e conversão estilo Avantpro:
 * - `soldQuantity`: Faixa de vendidos do ML (`50.000`, `10.000`, `5.000`, `1.000`, `500`, `250`, `100`, `50`, `25`, `5`)
 * - `estimatedSales`: Vendas estimadas acumuladas (`Math.round(soldQuantity * 1.35)` ou via perguntas quando superior)
 * - `currentMonthlyPace`: Ritmo atual em vendas/mês nos últimos 30 dias
 * - `estimatedDailySales`: Vendas por dia (`Math.round(soldQuantity / effectiveDays)`)
 * - `estimatedMonthlySales`: Vendas mensais históricas (`Math.floor(soldQuantity / (effectiveDays / 30))`)
 * - `conversionRatePercent`: % Conversão (`(soldQuantity / estimatedVisits) * 100`)
 * - `estimatedVisits`: Total de visitas acumuladas (`Math.round(soldQuantity / (conversionRatePercent / 100))`)
 * - `estimatedStock`: Estoque disponível estimado no Buy Box (`50`, `100`, `25`, `15`, `10`)
 * - `estimatedTotalRevenue`: Faturamento bruto acumulado (`soldQuantity * price`)
 */
export function calculateSalesEstimates(input: SalesEstimateInput): SalesEstimateResult {
  const questionsTotal = input.questionsTotal ?? 0;
  const effectiveDays = Math.max(1, input.daysActive ?? input.itemDaysActive ?? 180);
  const pos = Math.max(1, input.position);
  const subPos = Math.max(1, input.subcategoryPosition ?? pos);
  const offersCount = Math.max(1, input.offers ?? 1);

  const qTimestamps = (input.recentQuestionDates ?? [])
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  // Velocidade base diária pela posição no ranking (Lei de Pareto/Zipf: #1 ≈ 26/dia)
  const rankDailyBase = 26 / Math.pow(pos, 0.52);
  const questionLifetimeDaily = (questionsTotal * QUESTIONS_TO_SALES_MULTIPLIER) / effectiveDays;
  const historicalDaily = Math.max(rankDailyBase, questionLifetimeDaily);

  // Volume bruto acumulado ao longo do tempo ativo do catálogo/anúncio
  const rawAccumulatedSales = historicalDaily * effectiveDays;

  // Mapeia para a faixa oficial de vendidos do Mercado Livre (+50 mil, +10 mil, +5 mil, +1000, +500, +100...)
  let soldQuantity = Math.max(5, Math.round(rawAccumulatedSales));
  for (let i = ML_SOLD_TIERS.length - 1; i >= 0; i--) {
    if (rawAccumulatedSales * 1.02 >= ML_SOLD_TIERS[i]) {
      soldQuantity = ML_SOLD_TIERS[i];
      break;
    }
  }

  // Vendas estimadas (fator Avantpro 1.35x sobre o piso da faixa de vendidos)
  const estimatedSales = Math.max(
    Math.round(soldQuantity * 1.35),
    questionsTotal * QUESTIONS_TO_SALES_MULTIPLIER,
  );

  // Média diária e mensal histórica (idêntico ao Avantpro: soldQuantity / dias e soldQuantity / meses)
  const estimatedDailySales = Math.max(1, Math.round(soldQuantity / effectiveDays));
  const monthsActive = Math.max(1 / 30, effectiveDays / 30);
  const estimatedMonthlySales = Math.max(1, Math.floor(soldQuantity / monthsActive));

  // Ritmo atual (vendas/mês nos últimos 30 dias enquanto está no Top 20 Mais Vendidos)
  let recentQuestionDaily = 0;
  if (qTimestamps.length >= 2) {
    const oldestRecent = Math.min(...qTimestamps);
    const spanDays = Math.max(1, (Date.now() - oldestRecent) / 86_400_000);
    recentQuestionDaily = (qTimestamps.length * QUESTIONS_TO_SALES_MULTIPLIER) / spanDays;
  }

  // Fator de impulso de catálogo atual (ofertas competindo + liderança na subcategoria + Full)
  const catalogMomentumMultiplier =
    1 +
    Math.min(0.85, Math.log10(offersCount) * 0.52) +
    (subPos === 1 ? 0.22 : subPos <= 3 ? 0.1 : 0) +
    (input.isFull ? 0.08 : 0);

  const currentDailyPace = Math.max(
    rankDailyBase * catalogMomentumMultiplier,
    recentQuestionDaily * 1.35,
    estimatedDailySales * 1.15,
  );
  const currentMonthlyPace = Math.max(1, Math.round(currentDailyPace * 30));

  // Taxa de conversão (%) baseada na qualidade do Buy Box (posição, Full, Frete Grátis, Loja Oficial)
  const rawConversion =
    9.5 +
    1.8 / Math.pow(pos, 0.45) +
    (input.isFull ? 1.1 : 0) +
    (input.freeShipping ? 0.5 : 0) +
    (input.officialStore ? 0.23 : 0);
  const conversionRatePercent = Math.round(Math.min(18.5, Math.max(3.2, rawConversion)) * 100) / 100;

  // Total de visitas acumuladas = Vendidos / Taxa de conversão
  const exactConversionRatio = rawConversion / 100;
  const estimatedVisits = Math.max(
    soldQuantity * 5,
    Math.round(soldQuantity / exactConversionRatio),
  );

  // Estoque disponível estimado no anúncio vencedor
  const estimatedStock = input.isFull
    ? input.officialStore
      ? 50
      : pos <= 3
        ? 50
        : 25
    : input.officialStore
      ? 30
      : pos <= 5
        ? 20
        : 10;

  const estimatedMonthlyRevenue =
    input.price != null ? Math.round(currentMonthlyPace * input.price) : undefined;
  const estimatedTotalRevenue =
    input.price != null ? Math.round(soldQuantity * input.price * 100) / 100 : undefined;

  return {
    questionsTotal,
    soldQuantity,
    estimatedStock,
    estimatedSales,
    currentMonthlyPace,
    estimatedVisits,
    conversionRatePercent,
    estimatedDailySales,
    estimatedMonthlySales,
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
 * Calcula todas as métricas financeiras estilo Avantpro:
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
