"use client";

import { useEffect, useState } from "react";
import type { MeliSnapshot, Product } from "@/lib/meli";

const ALL = "todas";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");

const POWER_LABELS: Record<string, string> = {
  platinum: "MercadoLíder Platinum",
  gold: "MercadoLíder Gold",
  silver: "MercadoLíder",
};

function pickBestClient(products: Product[]): Product | undefined {
  return [...products]
    .filter((p) => p.discount != null)
    .sort((a, b) => b.discount! - a.discount! || (a.price ?? 0) - (b.price ?? 0))[0];
}

function Card({ p, showCategory }: { p: Product; showCategory?: boolean }) {
  return (
    <li className="card">
      <div className="card-head">
        <span className="pos">#{p.position}</span>
        <span className="type-badge">{p.type}</span>
        {p.listingTypeName && <span className="badge-outline">{p.listingTypeName}</span>}
        {p.logisticType && <span className="badge-full">{p.logisticType}</span>}
      </div>

      {p.image && <img src={p.image} alt={p.name} loading="lazy" />}

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

      {p.price != null ? (
        <div className="price-box">
          <div className="price">
            {p.originalPrice != null && p.discount != null && <s>{brl(p.originalPrice)}</s>}
            <strong>{brl(p.price)}</strong>
            {p.discount != null && <em>{p.discount}% OFF</em>}
          </div>
          {p.maxPrice != null && p.maxPrice > p.price && (
            <small className="range">
              Faixa nas ofertas: {brl(p.price)} – {brl(p.maxPrice)} (méd.{" "}
              {brl(p.avgPrice ?? p.price)})
            </small>
          )}
        </div>
      ) : (
        <small className="muted">Preço indisponível na API ({p.id})</small>
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

      {(p.questionsTotal != null || p.estimatedSales != null) && (
        <div className="metrics-box">
          <div className="metrics-title">Demanda &amp; Ritmo Estimado</div>
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
      )}

      {p.saleFeeAmount != null && p.price != null && (
        <div className="finance-box">
          <div className="metrics-title">Análise Financeira por Venda (API Oficial)</div>
          <div className="finance-rows">
            <div className="fin-row">
              <span>Tarifa ML ({p.saleFeePercent ?? "—"}%):</span>
              <strong className="neg">- {brl(p.saleFeeAmount)}</strong>
            </div>
            {p.shippingListCost != null && (
              <div className="fin-row">
                <span>
                  Frete ref. ({p.billableWeightGrams ? `${p.billableWeightGrams}g` : "ME2"}):
                </span>
                <strong className={p.freeShipping ? "neg" : "muted"}>
                  {p.freeShipping
                    ? `- ${brl(p.shippingListCost)}`
                    : `${brl(p.shippingListCost)} (comprador)`}
                </strong>
              </div>
            )}
            {p.netReceived != null && (
              <div className="fin-row highlight">
                <span>Anúncio recebe (líquido ML):</span>
                <strong className="pos-val">{brl(p.netReceived)}</strong>
              </div>
            )}
            {p.estimatedTaxAmount != null && (
              <div className="fin-row">
                <span>Imposto est. ({p.estimatedTaxPercent}% Simples):</span>
                <strong className="neg">- {brl(p.estimatedTaxAmount)}</strong>
              </div>
            )}
            {p.netAfterTax != null && (
              <div className="fin-row">
                <span>Sobra após imposto:</span>
                <strong>{brl(p.netAfterTax)}</strong>
              </div>
            )}
            {p.profitPriceMin != null && p.profitPriceMax != null && (
              <div className="fin-row profit-range">
                <span>Faixa p/ lucro (15%–25%):</span>
                <strong>
                  {brl(p.profitPriceMin)} – {brl(p.profitPriceMax)}
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

export default function DashboardClient({ snapshot }: { snapshot: MeliSnapshot }) {
  const defaultCat = snapshot.categories[0]?.id ?? ALL;
  const [selected, setSelected] = useState<string>(defaultCat);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get("cat");
    if (catParam && (catParam === ALL || snapshot.categories.some((c) => c.id === catParam))) {
      setSelected(catParam);
    }
  }, [snapshot.categories]);

  const selectCategory = (catId: string) => {
    setSelected(catId);
    const url = new URL(window.location.href);
    url.searchParams.set("cat", catId);
    window.history.replaceState({}, "", url.toString());
  };

  const isAll = selected === ALL;
  const currentCategory = snapshot.categories.find((c) => c.id === selected);
  const products = isAll ? snapshot.topOfAll : (currentCategory?.products ?? []);
  const trends = isAll ? snapshot.generalTrends : (currentCategory?.trends ?? []);
  const catDetails = isAll ? null : (currentCategory?.details ?? null);
  const best = isAll ? pickBestClient(products) : undefined;

  const updatedDate = new Date(snapshot.updatedAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <main>
      <header className="top-header">
        <div>
          <h1>Mais vendidos no Mercado Livre</h1>
          <small className="updated-at">Última atualização dos dados: {updatedDate}</small>
        </div>
        {catDetails && (
          <div className="cat-summary">
            <strong>{catDetails.pathFromRoot.join(" › ")}</strong> ·{" "}
            {num(catDetails.totalItems)} anúncios ativos na categoria
          </div>
        )}
      </header>

      <nav>
        <button
          type="button"
          onClick={() => selectCategory(ALL)}
          className={isAll ? "active" : ""}
        >
          Todas as categorias
        </button>
        {snapshot.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCategory(c.id)}
            className={c.id === selected ? "active" : ""}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {trends.length > 0 && (
        <section className="trends-bar">
          <span className="trends-label">
            Buscas em alta ({isAll ? "Geral MLB" : (catDetails?.name ?? "Categoria")}):
          </span>
          <div className="trends-list">
            {trends.map((t) => (
              <a key={t.keyword} href={t.url} target="_blank" rel="noreferrer">
                {t.keyword}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="note">
        Dados extraídos dos endpoints oficiais da API do Mercado Livre: ranking (
        <code>/highlights</code>), catálogo (<code>/products</code>), ofertas (
        <code>/products/&#123;id&#125;/items</code>), tarifas oficiais (
        <code>/listing_prices</code>), frete (<code>/shipping_options/free</code>), engajamento (
        <code>/questions/search</code>), reputação do vendedor (<code>/users</code>) e tendências (
        <code>/trends</code>). Vendas estimadas calculadas por benchmark de perguntas/idade do
        produto (pois <code>/items</code> retorna 403 na API pública).
      </p>

      {isAll && best && (
        <section className="best">
          <h2>Maior desconto entre os 1º lugares</h2>
          <ol className="grid">
            <Card p={best} showCategory />
          </ol>
        </section>
      )}

      {isAll && <h2>1º lugar de cada categoria</h2>}
      <ol className="grid">
        {products.map((p) => (
          <Card key={`${p.categoryId ?? ""}${p.id}`} p={p} showCategory={isAll} />
        ))}
      </ol>
    </main>
  );
}

