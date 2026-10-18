"use client";

import { useState } from "react";
import { calculateFinancialBreakdown, type Product } from "@/lib/meli";
import { brl, num, POWER_LABELS } from "./formatters";

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

      {(p.brand || p.model || p.color) && (
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
              Faixa nas ofertas: {brl(price)} – {brl(p.maxPrice)} (méd. {brl(p.avgPrice ?? price)})
            </small>
          )}
        </div>
      ) : (
        <small className="muted">Anúncio restrito na API ({p.id})</small>
      )}

      <div className="tags">
        {p.offers != null && (
          <span>
            {p.offers >= 100 ? "100+" : p.offers} {p.offers === 1 ? "oferta" : "ofertas"}
          </span>
        )}
        {p.freeShipping && <span className="tag-green">Frete grátis</span>}
        {p.officialStore && <span className="tag-blue">Loja oficial</span>}
        {p.warranty && <span>{p.warranty}</span>}
        {p.daysActive != null && <span>Criado há {p.daysActive}d</span>}
      </div>

      <div className="metrics-box">
        <div className="metrics-title">
          <span>Demanda &amp; Ritmo Estimado</span>
          <small className="method-badge">
            {(p.questionsTotal ?? 0) > 0 ? "via Perguntas" : "via Ranking"}
          </small>
        </div>
        <div className="metrics-grid">
          <div>
            <span>Perguntas</span>
            <strong>{num(p.questionsTotal ?? 0)}</strong>
          </div>
          <div>
            <span>Vendas est.</span>
            <strong>{p.estimatedSales != null ? `~${num(p.estimatedSales)}` : "—"}</strong>
          </div>
          <div>
            <span>Ritmo/dia</span>
            <strong>
              {p.estimatedDailySales != null ? `~${num(p.estimatedDailySales)}/dia` : "—"}
            </strong>
          </div>
          <div>
            <span>Vendas/mês</span>
            <strong>
              {p.estimatedMonthlySales != null ? `~${num(p.estimatedMonthlySales)}/mês` : "—"}
            </strong>
          </div>
        </div>
        {p.estimatedMonthlyRevenue != null && (
          <div className="revenue-row">
            Faturamento mensal est.: <strong>{brl(p.estimatedMonthlyRevenue)}</strong>
          </div>
        )}
      </div>

      {price != null && saleFeeAmount != null && (
        <div className="finance-box">
          <div className="metrics-title">Análise Financeira por Venda</div>
          <div className="finance-rows">
            <div className="fin-row">
              <span>Tarifa ML ({p.saleFeePercent ?? 14}%):</span>
              <strong className="neg">- {brl(saleFeeAmount)}</strong>
            </div>
            {p.shippingListCost != null && (
              <div className="fin-row">
                <span>
                  Frete ({p.billableWeightGrams ? `${p.billableWeightGrams}g` : "ME2"}):
                </span>
                <strong className={p.freeShipping ? "neg" : "muted"}>
                  {p.freeShipping
                    ? `- ${brl(p.shippingListCost)}`
                    : `${brl(p.shippingListCost)} (comprador)`}
                </strong>
              </div>
            )}
            {fin.netReceived != null && (
              <div className="fin-row highlight">
                <span>Anúncio recebe (líquido ML):</span>
                <strong className="pos-val">{brl(fin.netReceived)}</strong>
              </div>
            )}
            {fin.estimatedTaxAmount != null && (
              <div className="fin-row">
                <span>Imposto ({taxPercent}%):</span>
                <strong className="neg">- {brl(fin.estimatedTaxAmount)}</strong>
              </div>
            )}
            {fin.cmvAmount != null && (
              <div className="fin-row">
                <span>Custo produto ({cmvPercent}%):</span>
                <strong className="neg">- {brl(fin.cmvAmount)}</strong>
              </div>
            )}
            {fin.netProfit != null && (
              <div className="fin-row highlight">
                <span>Lucro líquido un. ({fin.netMarginPercent}%):</span>
                <strong className={fin.netProfit >= 0 ? "pos-val" : "neg"}>
                  {brl(fin.netProfit)}
                </strong>
              </div>
            )}
            {fin.profitPriceMin != null && fin.profitPriceMax != null && (
              <div className="fin-row profit-range">
                <span>Faixa p/ lucro (15%–25%):</span>
                <strong>
                  {brl(fin.profitPriceMin)} – {brl(fin.profitPriceMax)}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {p.sellerNickname && (
        <div className="seller-box">
          <div className="seller-top">
            <span>Vendedor:</span>
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
            {p.sellerTotalTransactions != null && (
              <span>{num(p.sellerTotalTransactions)} vendas na conta</span>
            )}
            {p.sellerLocation && <span>{p.sellerLocation}</span>}
          </div>
        </div>
      )}

      {p.mainFeatures && p.mainFeatures.length > 0 && (
        <ul className="features">
          {p.mainFeatures.map((f, idx) => (
            <li key={idx}>{f}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
