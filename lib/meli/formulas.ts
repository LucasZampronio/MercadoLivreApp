/**
 * Fórmulas financeiras e estatísticas de inteligência de mercado (estilo Avantpro).
 * Documentação detalhada em: docs/formulas-e-estimativas.md
 */

export const QUESTIONS_TO_SALES_MULTIPLIER = 8; // Benchmark ML: ~1 pergunta a cada 8 vendas (~12,5% perguntam)
export const DEFAULT_TAX_PERCENT = 6; // Simples Nacional (Anexo I - Comércio inicial)
export const DEFAULT_CMV_PERCENT = 45; // Custo da Mercadoria Vendida (45% do preço de venda)

export type SalesEstimateInput = {
  position: number;
  questionsTotal?: number;
  recentQuestionDates?: string[];
  daysActive?: number;
  price?: number;
};

export type SalesEstimateResult = {
  questionsTotal: number;
  estimatedSales: number;
  estimatedDailySales: number;
  estimatedMonthlySales: number;
  estimatedMonthlyRevenue?: number;
  method: "questions" | "ranking_pareto";
};

/**
 * Calcula Vendas Estimadas, Ritmo/Dia, Vendas/Mês e Faturamento Mensal:
 * - Se há perguntas em `/questions/search`, combina a velocidade recente (últimas até 50 perguntas, peso 60%)
 *   com a média histórica desde `date_created` (peso 40%).
 * - Se o anúncio vencedor do buybox tem 0 perguntas (recém-criado), aplica a Lei de Potência (Pareto/Zipf)
 *   pela posição #1..#20 do ranking: ritmo_base = 28 / (posição ^ 0.55).
 */
export function calculateSalesEstimates(input: SalesEstimateInput): SalesEstimateResult {
  const questionsTotal = input.questionsTotal ?? 0;
  const effectiveDays = input.daysActive ?? 180;

  const qTimestamps = (input.recentQuestionDates ?? [])
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  const rankBaselineDaily = Math.max(
    1.2,
    Math.round((28 / Math.pow(Math.max(1, input.position), 0.55)) * 10) / 10,
  );

  let estimatedSales: number;
  let estimatedDailySales: number;
  let method: "questions" | "ranking_pareto";

  if (questionsTotal > 0) {
    method = "questions";
    estimatedSales = questionsTotal * QUESTIONS_TO_SALES_MULTIPLIER;
    const lifetimeDaily = estimatedSales / effectiveDays;

    if (qTimestamps.length >= 2) {
      const oldestRecent = Math.min(...qTimestamps);
      const spanDays = Math.max(1, (Date.now() - oldestRecent) / 86_400_000);
      const recentDaily = (qTimestamps.length * QUESTIONS_TO_SALES_MULTIPLIER) / spanDays;
      estimatedDailySales = Math.max(
        0.5,
        Math.round((recentDaily * 0.6 + lifetimeDaily * 0.4) * 10) / 10,
      );
    } else {
      estimatedDailySales = Math.max(0.5, Math.round(lifetimeDaily * 10) / 10);
    }
  } else {
    method = "ranking_pareto";
    estimatedDailySales = rankBaselineDaily;
    estimatedSales = Math.round(estimatedDailySales * Math.min(effectiveDays, 120));
  }

  const estimatedMonthlySales = Math.round(estimatedDailySales * 30);
  const estimatedMonthlyRevenue =
    input.price != null ? Math.round(estimatedMonthlySales * input.price) : undefined;

  return {
    questionsTotal,
    estimatedSales,
    estimatedDailySales,
    estimatedMonthlySales,
    estimatedMonthlyRevenue,
    method,
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
  netProfit?: number;
  netMarginPercent?: number;
  profitPriceMin?: number;
  profitPriceMax?: number;
};

/**
 * Calcula o Recebimento Líquido do ML, Impostos, CMV, Lucro Líquido Unitário e
 * a Faixa de Preço Ideal para atingir de 15% a 25% de margem líquida:
 *
 * Preço_Alvo(m) = (Custo_Produto + Frete_Vendedor + Taxa_Fixa_ML) / (1 - %Comissão_ML - %Imposto - m)
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
      ? Math.round((netReceived - estimatedTaxAmount) * 100) / 100
      : undefined;

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
    netProfit,
    netMarginPercent,
    profitPriceMin,
    profitPriceMax,
  };
}
