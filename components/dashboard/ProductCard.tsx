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

function InfoDot({ title }: { title: string }) {
  return (
    <span className="av-info" title={title} aria-label={title}>
      i
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
  const itemDaysActive =
    p.itemDaysActive ??
    (itemDateCreated
      ? Math.max(1, Math.round((Date.now() - new Date(itemDateCreated).getTime()) / 86_400_000))
      : p.daysActive);

  // Caso o snapshot ainda não tenha os novos campos pré-calculados, calcula em tempo real
  const fallbackSales =
    p.soldQuantity == null || p.estimatedVisits == null || p.currentMonthlyPace == null
      ? calculateSalesEstimates({
          position: p.position,
          subcategoryPosition: p.subcategoryPosition,
          offers: p.offers,
          questionsTotal: p.questionsTotal,
          daysActive: p.daysActive,
          itemDaysActive,
          price,
          isFull: p.logisticType === "Full",
          freeShipping: p.freeShipping,
          officialStore: p.officialStore,
        })
      : null;

  const soldQuantity = p.soldQuantity ?? fallbackSales?.soldQuantity ?? 0;
  const estimatedStock = p.estimatedStock ?? fallbackSales?.estimatedStock ?? 20;
  const estimatedSales = p.estimatedSales ?? fallbackSales?.estimatedSales ?? 0;
  const currentMonthlyPace =
    p.currentMonthlyPace ?? fallbackSales?.currentMonthlyPace ?? p.estimatedMonthlySales ?? 0;
  const estimatedVisits = p.estimatedVisits ?? fallbackSales?.estimatedVisits ?? 0;
  const conversionRatePercent =
    p.conversionRatePercent ?? fallbackSales?.conversionRatePercent ?? 10;
  const estimatedDailySales = p.estimatedDailySales ?? fallbackSales?.estimatedDailySales ?? 1;
  const historicalMonthlySales =
    p.estimatedMonthlySales ?? fallbackSales?.estimatedMonthlySales ?? 30;
  const estimatedTotalRevenue =
    p.estimatedTotalRevenue ??
    fallbackSales?.estimatedTotalRevenue ??
    (price != null ? soldQuantity * price : undefined);
  const estimatedMonthlyRevenue =
    p.estimatedMonthlyRevenue ??
    fallbackSales?.estimatedMonthlyRevenue ??
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

      {/* PAINEL AVANTPRO COMPLETO */}
      <div className="av-panel">
        {/* Barra de ícones de status (Reputação,Loja Oficial,Garantia,Full,Frete Grátis) */}
        <div className="av-status-bar">
          <span
            className={p.sellerPowerStatus ? "av-status-icon active" : "av-status-icon"}
            title={
              p.sellerPowerStatus
                ? (POWER_LABELS[p.sellerPowerStatus] ?? p.sellerPowerStatus)
                : "Vendedor padrão"
            }
          >
            🏅
          </span>
          <span
            className={p.officialStore ? "av-status-icon active" : "av-status-icon"}
            title={p.officialStore ? "Loja Oficial / Marca Verificada" : "Loja comum"}
          >
            🏪
          </span>
          <span
            className={p.warranty ? "av-status-icon active" : "av-status-icon"}
            title={p.warranty ?? "Sem garantia informada"}
          >
            🛡️
          </span>
          <span
            className={p.logisticType === "Full" ? "av-status-icon active" : "av-status-icon"}
            title={`Logística: ${p.logisticType ?? "Padrão"}`}
          >
            ⚡
          </span>
          <span
            className={p.freeShipping ? "av-status-icon active" : "av-status-icon"}
            title={p.freeShipping ? "Frete Grátis ativo" : "Frete por conta do comprador"}
          >
            🚚
          </span>
        </div>

        {/* 4 Pílulas Superiores (Frete, Catálogo, Vendidos, Estoque) */}
        <div className="av-pills-grid">
          <div className="av-pill">
            <span className="av-pill-icon">🚚</span>
            <strong>
              Frete: {p.shippingListCost != null ? brl(p.shippingListCost) : "Grátis"}
            </strong>
            <InfoDot
              title={`Custo de frete ME2 (/shipping_options/free)${p.billableWeightGrams ? ` · Peso faturável: ${num(p.billableWeightGrams)}g` : ""}`}
            />
          </div>

          <div className={isCatalog ? "av-pill av-pill-blue" : "av-pill"}>
            <span className="av-pill-icon">📚</span>
            <strong>{isCatalog ? "Catálogo" : "Tradicional"}</strong>
            <InfoDot
              title={
                isCatalog
                  ? `Produto de Catálogo (${p.offers ?? 1} ofertas competindo no Buy Box)`
                  : `Anúncio próprio (${p.type})`
              }
            />
          </div>

          <div className="av-pill">
            <span className="av-pill-icon">📦</span>
            <strong>{num(soldQuantity)} Vendidos</strong>
            <InfoDot title="Faixa de vendas acumuladas (+Vendidos) estimada para o produto/catálogo" />
          </div>

          <div className="av-pill">
            <span className="av-pill-icon">🎫</span>
            <strong>{num(estimatedStock)} Estoque</strong>
            <InfoDot title="Estoque disponível estimado na oferta vencedora do Buy Box" />
          </div>
        </div>

        {/* 12 Cards de Métricas (6 linhas x 2 colunas idênticas ao Avantpro) */}
        <div className="av-cards-grid">
          {/* Linha 1 */}
          <div className="av-metric-card">
            <InfoDot title="Volume total estimado de vendas acumuladas (faixa de vendidos × 1,35 ou volume por perguntas)" />
            <span className="av-metric-label">📊 Vendas estimadas</span>
            <strong className="av-metric-val">{num(estimatedSales)}</strong>
          </div>

          <div className="av-metric-card">
            <InfoDot title="Ritmo atual de vendas nos últimos 30 dias considerando a posição atual no Top 20, número de ofertas do catálogo e velocidade de perguntas recentes" />
            <span className="av-metric-label">🛒 Ritmo atual (vendas/mês)</span>
            <strong className="av-metric-val">{num(currentMonthlyPace)}</strong>
          </div>

          {/* Linha 2 */}
          <div className="av-metric-card">
            <InfoDot title="Total estimado de visitas acumuladas com base nas vendas e na taxa de conversão do anúncio" />
            <span className="av-metric-label">👁️ Visitas</span>
            <strong className="av-metric-val">{num(estimatedVisits)}</strong>
          </div>

          <div className="av-metric-card">
            <InfoDot title="Média de vendas por dia desde a criação do catálogo/anúncio (Vendidos ÷ Dias ativos)" />
            <span className="av-metric-label">🎫 Vendas por dia</span>
            <strong className="av-metric-val">{num(estimatedDailySales)}</strong>
          </div>

          {/* Linha 3 */}
          <div className="av-metric-card">
            <InfoDot title="Média histórica de vendas por mês desde a criação (Vendidos ÷ Meses ativos)" />
            <span className="av-metric-label">🛒 Vendas mensais</span>
            <strong className="av-metric-val">{num(historicalMonthlySales)}/Mês</strong>
          </div>

          <div className="av-metric-card">
            <InfoDot title="Taxa de conversão estimada (Vendidos ÷ Visitas × 100)" />
            <span className="av-metric-label">% Conversão</span>
            <strong className="av-metric-val">{pct(conversionRatePercent)}</strong>
          </div>

          {/* Linha 4: Datas de criação do Anúncio e do Catálogo */}
          <div className="av-metric-card">
            <InfoDot title="Data de criação do anúncio vencedor obtida via GET /items/{id}/description (ou interpolada pelo ID MLB)" />
            <span className="av-metric-label">📅 Anúncio criado em</span>
            <strong className="av-metric-val av-date-val">{fmtDate(itemDateCreated)}</strong>
            {itemDaysActive != null && (
              <span className="av-days-pill">● Há {num(itemDaysActive)} dias</span>
            )}
          </div>

          <div className="av-metric-card">
            <InfoDot title="Data oficial de criação da ficha de catálogo obtida via GET /products/{id}" />
            <span className="av-metric-label">📅 Catálogo criado em</span>
            <strong className="av-metric-val av-date-val">
              {fmtDate(p.dateCreated ?? itemDateCreated)}
            </strong>
            {(p.daysActive ?? itemDaysActive) != null && (
              <span className="av-days-pill">
                ● Há {num((p.daysActive ?? itemDaysActive)!)} dias
              </span>
            )}
          </div>

          {/* Linha 5: Imposto (vermelho) e Recebe (verde) */}
          <div className="av-metric-card av-card-red">
            <InfoDot title="Imposto estimado sobre o preço de venda (ajustável no controle superior)" />
            <span className="av-metric-label">% Imposto</span>
            <strong className="av-metric-val">
              {fin.estimatedTaxAmount != null ? brl(fin.estimatedTaxAmount) : "—"}
            </strong>
            <span className="av-metric-sub">{pct(taxPercent)}</span>
          </div>

          <div className="av-metric-card av-card-green">
            <InfoDot title="Valor líquido recebido após descontar Comissão ML, Frete e Imposto (Preço - Comissão - Frete - Imposto)" />
            <span className="av-metric-label">👛 Recebe</span>
            <strong className="av-metric-val">
              {fin.netAfterTax != null ? brl(fin.netAfterTax) : "—"}
            </strong>
            {fin.netReceivePercent != null && (
              <span className="av-metric-sub">{pct(fin.netReceivePercent)}</span>
            )}
          </div>

          {/* Linha 6: Recomendação (azul) e Comissão ML (verde) */}
          <div className="av-metric-card av-card-blue">
            <InfoDot title="Faixa recomendada de custo de aquisição do produto (entre 50% e 90% do valor líquido Recebe)" />
            <span className="av-metric-label">🎯 Recomendação</span>
            <strong className="av-metric-val av-rec-val">
              {fin.recommendedCostMin != null && fin.recommendedCostMax != null
                ? `Entre ${brl(fin.recommendedCostMin)} e ${brl(fin.recommendedCostMax)}`
                : "—"}
            </strong>
          </div>

          <div className="av-metric-card av-card-green">
            <InfoDot
              title={`Comissão oficial do Mercado Livre (/sites/MLB/listing_prices) para anúncio ${p.listingTypeName ?? "Clássico"}`}
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

        {/* Banner Inferior Azul "Faturando R$ ..." */}
        {estimatedTotalRevenue != null && (
          <div className="av-revenue-banner">
            <div className="av-rev-main">
              <span>📈</span>
              <strong>Faturando {brl(estimatedTotalRevenue)}</strong>
            </div>
            {estimatedMonthlyRevenue != null && (
              <small className="av-rev-sub">
                Ritmo mensal atual: {brl(estimatedMonthlyRevenue)}/mês · {num(p.questionsTotal ?? 0)}{" "}
                perguntas no anúncio
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
