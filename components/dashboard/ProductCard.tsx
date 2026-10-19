"use client";

import { useState } from "react";
import {
  calculateFinancialBreakdown,
  calculateSalesEstimates,
  estimateItemDateFromMlbId,
  type Product,
} from "@/lib/meli";
import { brl, fmtDate, num, pct, POWER_LABELS } from "./formatters";

function ProductImage({ src, alt, subcat }: { src?: string; alt: string; subcat?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="img-fallback" title={alt}>
        <svg
          viewBox="0 0 24 24"
          width="38"
          height="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <span>{subcat ?? "Produto Mercado Livre"}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function SourceBadge({ isEstimate, title }: { isEstimate?: boolean; title: string }) {
  return (
    <span
      className={isEstimate ? "av-source-badge est" : "av-source-badge real"}
      title={title}
      aria-label={title}
    >
      {isEstimate ? "≈" : "✓"}
    </span>
  );
}

export default function ProductCard({
  p,
  showCategory,
  taxPercent,
  cmvPercent,
}: {
  p: Product;
  showCategory?: boolean;
  taxPercent: number;
  cmvPercent: number;
}) {
  const price = p.price;
  const saleFeeAmount =
    p.saleFeeAmount ?? (price != null ? +(price * 0.14).toFixed(2) : undefined);

  const fin = calculateFinancialBreakdown({
    price,
    saleFeeAmount,
    saleFeePercent: p.saleFeePercent,
    fixedFeeAmount: p.fixedFeeAmount,
    shippingListCost: p.shippingListCost,
    freeShipping: p.freeShipping,
    taxPercent,
    cmvPercent,
  });

  const itemDateCreated =
    p.itemDateCreated ?? estimateItemDateFromMlbId(p.itemId, p.dateCreated);
  const itemDateIsEstimated = p.itemDateIsEstimated ?? !p.itemDateCreated;
  const itemDaysActive =
    p.itemDaysActive ??
    (itemDateCreated
      ? Math.max(1, Math.round((Date.now() - new Date(itemDateCreated).getTime()) / 86_400_000))
      : p.daysActive);

  // Recalcula com o modelo multi-sinal caso algum campo não esteja no JSON
  const sales = calculateSalesEstimates({
    position: p.position,
    subcategoryPosition: p.subcategoryPosition,
    subcategoryTotalItems: p.subcategoryTotalItems,
    offers: p.offers,
    questionsTotal: p.questionsTotal,
    daysActive: p.daysActive,
    itemDaysActive,
    price,
    isFull: p.logisticType === "Full",
    freeShipping: p.freeShipping,
    officialStore: p.officialStore,
    sellerTotalTransactions: p.sellerTotalTransactions,
  });

  const soldQuantity = p.soldQuantity ?? sales.soldQuantity;
  const estimatedStock = p.estimatedStock ?? sales.estimatedStock;
  const estimatedSales = p.estimatedSales ?? sales.estimatedSales;
  const currentMonthlyPace = p.currentMonthlyPace ?? sales.currentMonthlyPace;
  const estimatedVisits = p.estimatedVisits ?? sales.estimatedVisits;
  const conversionRatePercent = p.conversionRatePercent ?? sales.conversionRatePercent;
  const estimatedDailySales = p.estimatedDailySales ?? sales.estimatedDailySales;
  const historicalMonthlySales = p.estimatedMonthlySales ?? sales.estimatedMonthlySales;
  const estimatedTotalRevenue =
    p.estimatedTotalRevenue ??
    sales.estimatedTotalRevenue ??
    (price != null ? estimatedSales * price : undefined);
  const estimatedMonthlyRevenue =
    p.estimatedMonthlyRevenue ??
    sales.estimatedMonthlyRevenue ??
    (price != null ? currentMonthlyPace * price : undefined);

  const isCatalog = p.type === "PRODUCT";

  return (
    <li className="card">
      <div className="card-head">
        <span className="pos">#{p.position}</span>
        <span className="type-badge">{p.type}</span>
        {p.listingTypeName && <span className="badge-outline">{p.listingTypeName}</span>}
        {p.logisticType && <span className="badge-full">{p.logisticType}</span>}
      </div>

      <ProductImage src={p.image} alt={p.name} subcat={p.subcategoryName ?? p.categoryName} />

      <div className="cat-row">
        {showCategory && p.categoryName && <span className="cat">{p.categoryName}</span>}
        {p.subcategoryName && (
          <span className="subcat">
            {p.subcategoryName}
            {p.subcategoryTotalItems != null && ` (${num(p.subcategoryTotalItems)} anúncios)`}
          </span>
        )}
      </div>

      {p.permalink ? (
        <a className="title" href={p.permalink} target="_blank" rel="noreferrer">
          {p.name}
        </a>
      ) : (
        <span className="title">{p.name}</span>
      )}

      {(p.brand || p.model || p.color || p.weight) && (
        <div className="specs">
          {p.brand && (
            <span>
              Marca: <strong>{p.brand}</strong>
            </span>
          )}
          {p.model && (
            <span>
              Modelo: <strong>{p.model}</strong>
            </span>
          )}
          {p.color && (
            <span>
              Cor: <strong>{p.color}</strong>
            </span>
          )}
          {p.weight && (
            <span>
              Peso: <strong>{p.weight}</strong>
            </span>
          )}
        </div>
      )}

      {price != null ? (
        <div className="price-box">
          <div className="price">
            {p.originalPrice != null && p.discount != null && <s>{brl(p.originalPrice)}</s>}
            <strong>{brl(price)}</strong>
            {p.discount != null && <em>{p.discount}% OFF</em>}
          </div>
          {p.maxPrice != null && p.maxPrice > price && (
            <small className="range">
              {p.offers ? `${p.offers} ofertas · ` : ""}
              Faixa: {brl(p.minPrice ?? price)} – {brl(p.maxPrice)} (méd. {brl(p.avgPrice ?? price)})
            </small>
          )}
        </div>
      ) : (
        <small className="muted">Anúncio restrito na API ({p.id})</small>
      )}

      {/* PAINEL AVANTPRO COM DISTINÇÃO CLARA: ✓ OFICIAL API vs ≈ ESTIMATIVA */}
      <div className="av-panel">
        <div className="av-legend-row">
          <span className="av-legend-item real" title="Dado 100% oficial retornado pela API do Mercado Livre">
            <b>✓</b> Oficial API
          </span>
          <span className="av-legend-item est" title="Estimativa multi-sinal (Perguntas, Subcategoria, Ofertas, Preço e Vendedor)">
            <b>≈</b> Estimativa
          </span>
        </div>

        {/* Barra de ícones de status (100% Oficial API) */}
        <div className="av-status-bar">
          <span
            className={p.sellerPowerStatus ? "av-status-icon active" : "av-status-icon"}
            title={
              p.sellerPowerStatus
                ? `✓ Oficial API: ${POWER_LABELS[p.sellerPowerStatus] ?? p.sellerPowerStatus}`
                : "✓ Oficial API: Vendedor padrão"
            }
          >
            🏅
          </span>
          <span
            className={p.officialStore ? "av-status-icon active" : "av-status-icon"}
            title={
              p.officialStore
                ? "✓ Oficial API: Loja Oficial / Marca Verificada"
                : "✓ Oficial API: Loja comum"
            }
          >
            🏪
          </span>
          <span
            className={p.warranty ? "av-status-icon active" : "av-status-icon"}
            title={`✓ Oficial API: ${p.warranty ?? "Sem garantia informada"}`}
          >
            🛡️
          </span>
          <span
            className={p.logisticType === "Full" ? "av-status-icon active" : "av-status-icon"}
            title={`✓ Oficial API · Logística: ${p.logisticType ?? "Padrão"}`}
          >
            ⚡
          </span>
          <span
            className={p.freeShipping ? "av-status-icon active" : "av-status-icon"}
            title={
              p.freeShipping
                ? "✓ Oficial API: Frete Grátis ativo"
                : "✓ Oficial API: Frete por conta do comprador"
            }
          >
            🚚
          </span>
        </div>

        {/* 4 Pílulas Superiores */}
        <div className="av-pills-grid">
          <div className="av-pill">
            <span className="av-pill-icon">🚚</span>
            <strong>
              Frete: {p.shippingListCost != null ? brl(p.shippingListCost) : "Grátis"}
            </strong>
            <SourceBadge
              isEstimate={false}
              title={`✓ Oficial API (/shipping_options/free)${p.billableWeightGrams ? ` · Peso faturável: ${num(p.billableWeightGrams)}g` : ""}`}
            />
          </div>

          <div className={isCatalog ? "av-pill av-pill-blue" : "av-pill"}>
            <span className="av-pill-icon">📚</span>
            <strong>
              {isCatalog ? `Catálogo (${p.offers ?? 1})` : "Tradicional"}
            </strong>
            <SourceBadge
              isEstimate={false}
              title={
                isCatalog
                  ? `✓ Oficial API (/products/${p.id}/items): ${p.offers ?? 1} ofertas competindo no catálogo`
                  : `✓ Oficial API: Anúncio próprio (${p.type})`
              }
            />
          </div>

          <div className="av-pill av-pill-est">
            <span className="av-pill-icon">📦</span>
            <strong>≈ +{num(soldQuantity)} Vendidos</strong>
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Faixa de vendidos (+Vendidos) estimada por perguntas, porte da subcategoria e ofertas"
            />
          </div>

          <div className="av-pill av-pill-est">
            <span className="av-pill-icon">🎫</span>
            <strong>≈ {num(estimatedStock)} Estoque</strong>
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Estoque disponível estimado pela logística (Full/Normal), giro diário e porte do vendedor"
            />
          </div>
        </div>

        {/* Pílula de Dados Reais de Engajamento da API (Perguntas do Anúncio + Vendas da Conta do Vendedor) */}
        <div className="av-real-signals">
          <span title="✓ Dado 100% oficial via GET /questions/search">
            ✓ 💬 <strong>{num(p.questionsTotal ?? 0)}</strong> perguntas no anúncio
          </span>
          {p.sellerTotalTransactions != null && p.sellerTotalTransactions > 0 && (
            <span title="✓ Dado 100% oficial via GET /users/{seller_id}">
              ✓ 🏪 <strong>{num(p.sellerTotalTransactions)}</strong> vendas na conta
            </span>
          )}
        </div>

        {/* 12 Cards de Métricas (6 linhas x 2 colunas) */}
        <div className="av-cards-grid">
          {/* Linha 1 (Estimativas) */}
          <div className="av-metric-card av-card-est">
            <SourceBadge
              isEstimate
              title="≈ Estimativa multi-sinal: combina perguntas reais (/questions/search), tamanho da subcategoria, ofertas no catálogo, preço e dias ativos"
            />
            <span className="av-metric-label">📊 Vendas estimadas</span>
            <strong className="av-metric-val">≈ {num(estimatedSales)}</strong>
          </div>

          <div className="av-metric-card av-card-est">
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Ritmo atual de vendas nos últimos 30 dias enquanto ocupa o Top 20 Mais Vendidos"
            />
            <span className="av-metric-label">🛒 Ritmo atual (vendas/mês)</span>
            <strong className="av-metric-val">≈ {num(currentMonthlyPace)}</strong>
          </div>

          {/* Linha 2 (Estimativas) */}
          <div className="av-metric-card av-card-est">
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Total de visitas acumuladas (Vendas estimadas ÷ Taxa de conversão)"
            />
            <span className="av-metric-label">👁️ Visitas</span>
            <strong className="av-metric-val">≈ {num(estimatedVisits)}</strong>
          </div>

          <div className="av-metric-card av-card-est">
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Média de vendas por dia desde a criação (Vendas estimadas ÷ Dias ativos)"
            />
            <span className="av-metric-label">🎫 Vendas por dia</span>
            <strong className="av-metric-val">≈ {num(estimatedDailySales)}</strong>
          </div>

          {/* Linha 3 (Estimativas) */}
          <div className="av-metric-card av-card-est">
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Média histórica de vendas por mês desde a criação (Vendas estimadas ÷ Meses ativos)"
            />
            <span className="av-metric-label">🛒 Vendas mensais</span>
            <strong className="av-metric-val">≈ {num(historicalMonthlySales)}/Mês</strong>
          </div>

          <div className="av-metric-card av-card-est">
            <SourceBadge
              isEstimate
              title="≈ Estimativa: Taxa de conversão calculada pela posição no ranking, preço, Full, Frete Grátis e Loja Oficial"
            />
            <span className="av-metric-label">% Conversão</span>
            <strong className="av-metric-val">≈ {pct(conversionRatePercent)}</strong>
          </div>

          {/* Linha 4: Datas de criação do Anúncio e do Catálogo (Oficiais da API!) */}
          <div className={itemDateIsEstimated ? "av-metric-card av-card-est" : "av-metric-card"}>
            <SourceBadge
              isEstimate={itemDateIsEstimated}
              title={
                itemDateIsEstimated
                  ? "≈ Estimativa: Data interpolada pela sequência monotônica do ID MLB (anúncio sem descrição textual)"
                  : "✓ Oficial API: Data exata de criação do anúncio via GET /items/{id}/description"
              }
            />
            <span className="av-metric-label">📅 Anúncio criado em</span>
            <strong className="av-metric-val av-date-val">
              {itemDateIsEstimated ? `≈ ${fmtDate(itemDateCreated)}` : fmtDate(itemDateCreated)}
            </strong>
            {itemDaysActive != null && (
              <span className="av-days-pill">
                ● Há {itemDateIsEstimated ? `≈ ${num(itemDaysActive)}` : num(itemDaysActive)} dias
              </span>
            )}
          </div>

          <div className={p.dateCreated ? "av-metric-card" : "av-metric-card av-card-est"}>
            <SourceBadge
              isEstimate={!p.dateCreated}
              title={
                p.dateCreated
                  ? "✓ Oficial API: Data exata de criação da ficha de catálogo via GET /products/{id}"
                  : "≈ Estimativa: Baseada na data do anúncio"
              }
            />
            <span className="av-metric-label">📅 Catálogo criado em</span>
            <strong className="av-metric-val av-date-val">
              {p.dateCreated ? fmtDate(p.dateCreated) : `≈ ${fmtDate(itemDateCreated)}`}
            </strong>
            {(p.daysActive ?? itemDaysActive) != null && (
              <span className="av-days-pill">
                ● Há {num((p.daysActive ?? itemDaysActive)!)} dias
              </span>
            )}
          </div>

          {/* Linha 5: Imposto e Recebe (Cálculo Exato sobre Preço, Tarifa ML e Frete Oficiais!) */}
          <div className="av-metric-card av-card-red">
            <SourceBadge
              isEstimate={false}
              title="✓ Cálculo exato sobre o preço de venda com a alíquota de Imposto selecionada no painel superior"
            />
            <span className="av-metric-label">% Imposto</span>
            <strong className="av-metric-val">
              {fin.estimatedTaxAmount != null ? brl(fin.estimatedTaxAmount) : "—"}
            </strong>
            <span className="av-metric-sub">{pct(taxPercent)}</span>
          </div>

          <div className="av-metric-card av-card-green">
            <SourceBadge
              isEstimate={false}
              title="✓ Cálculo exato sobre dados oficiais da API: Preço Buy Box - Comissão ML (/listing_prices) - Frete (/shipping_options/free) - Imposto"
            />
            <span className="av-metric-label">👛 Recebe</span>
            <strong className="av-metric-val">
              {fin.netAfterTax != null ? brl(fin.netAfterTax) : "—"}
            </strong>
            {fin.netReceivePercent != null && (
              <span className="av-metric-sub">{pct(fin.netReceivePercent)}</span>
            )}
          </div>

          {/* Linha 6: Recomendação e Comissão ML (100% Oficial API!) */}
          <div className="av-metric-card av-card-blue">
            <SourceBadge
              isEstimate={false}
              title="✓ Cálculo exato: Faixa recomendada de custo de compra do produto (50% a 90% do valor líquido Recebe)"
            />
            <span className="av-metric-label">🎯 Recomendação</span>
            <strong className="av-metric-val av-rec-val">
              {fin.recommendedCostMin != null && fin.recommendedCostMax != null
                ? `Entre ${brl(fin.recommendedCostMin)} e ${brl(fin.recommendedCostMax)}`
                : "—"}
            </strong>
          </div>

          <div className="av-metric-card av-card-green">
            <SourceBadge
              isEstimate={false}
              title={`✓ Oficial API: Comissão exata do Mercado Livre via GET /sites/MLB/listing_prices (${p.listingTypeName ?? "Clássico"})`}
            />
            <span className="av-metric-label">💲 Comissão ML</span>
            <strong className="av-metric-val">
              {saleFeeAmount != null ? brl(saleFeeAmount) : "—"}
            </strong>
            <span className="av-metric-sub">
              {p.saleFeePercent ?? 14}% {p.listingTypeName ? `(${p.listingTypeName})` : ""}
            </span>
          </div>
        </div>

        {/* Simulador rápido de Lucro Líquido com o CMV selecionado */}
        {fin.netProfit != null && (
          <div className="av-cmv-sim">
            <div>
              <span>Lucro líq. p/ CMV {cmvPercent}%:</span>{" "}
              <strong className={fin.netProfit >= 0 ? "pos-val" : "neg"}>
                {brl(fin.netProfit)} ({fin.netMarginPercent}%)
              </strong>
            </div>
            {fin.profitPriceMin != null && fin.profitPriceMax != null && (
              <div>
                <span>Preço p/ margem 15%–25%:</span>{" "}
                <strong>
                  {brl(fin.profitPriceMin)} – {brl(fin.profitPriceMax)}
                </strong>
              </div>
            )}
          </div>
        )}

        {/* Banner Inferior Azul "≈ Faturando R$ ..." */}
        {estimatedTotalRevenue != null && (
          <div
            className="av-revenue-banner"
            title="≈ Estimativa de faturamento acumulado (Vendas estimadas × Preço) e faturamento mensal no ritmo atual"
          >
            <div className="av-rev-main">
              <span>📈</span>
              <strong>≈ Faturando {brl(estimatedTotalRevenue)}</strong>
            </div>
            {estimatedMonthlyRevenue != null && (
              <small className="av-rev-sub">
                ≈ Ritmo mensal atual: {brl(estimatedMonthlyRevenue)}/mês
              </small>
            )}
          </div>
        )}
      </div>

      {p.sellerNickname && (
        <div className="seller-box">
          <div className="seller-top">
            <span>Vendedor Buy Box:</span>
            {p.sellerPermalink ? (
              <a href={p.sellerPermalink} target="_blank" rel="noreferrer">
                <strong>{p.sellerNickname}</strong>
              </a>
            ) : (
              <strong>{p.sellerNickname}</strong>
            )}
          </div>
          <div className="seller-meta">
            {p.sellerPowerStatus && (
              <span className="power-badge">
                {POWER_LABELS[p.sellerPowerStatus] ?? p.sellerPowerStatus}
              </span>
            )}
            {p.sellerTotalTransactions != null && p.sellerTotalTransactions > 0 && (
              <span>{num(p.sellerTotalTransactions)} vendas na conta</span>
            )}
            {p.sellerLocation && <span>{p.sellerLocation}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
