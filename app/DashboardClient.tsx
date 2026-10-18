"use client";

import { useEffect, useMemo, useState } from "react";
import type { MeliSnapshot, Product } from "@/lib/meli";

const ALL_PRODS = "catalogo_completo";
const ALL_TOP1 = "todas";

type SortKey =
  | "position"
  | "revenue_desc"
  | "daily_desc"
  | "discount_desc"
  | "price_asc"
  | "price_desc"
  | "net_desc"
  | "questions_desc";

type QuickFilter = "all" | "full" | "free_shipping" | "official" | "platinum" | "classic" | "premium";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");

const POWER_LABELS: Record<string, string> = {
  platinum: "MercadoLíder Platinum",
  gold: "MercadoLíder Gold",
  silver: "MercadoLíder",
};

function ProductImage({ src, alt, subcat }: { src?: string; alt: string; subcat?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="img-fallback" title={alt}>
        <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.6">
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

function Card({
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
  const saleFeeAmount = p.saleFeeAmount ?? (price != null ? +(price * 0.14).toFixed(2) : undefined);
  const feeRate = (p.saleFeePercent ?? 14) / 100;
  const taxRate = taxPercent / 100;
  const cmvRate = cmvPercent / 100;
  const sellerShip = p.freeShipping ? (p.shippingListCost ?? 0) : 0;

  const netReceived =
    price != null && saleFeeAmount != null
      ? Math.max(0, +(price - saleFeeAmount - sellerShip).toFixed(2))
      : p.netReceived;

  const taxAmount = price != null ? +(price * taxRate).toFixed(2) : p.estimatedTaxAmount;
  const cmvAmount = price != null ? +(price * cmvRate).toFixed(2) : undefined;
  const netProfit =
    netReceived != null && taxAmount != null && cmvAmount != null
      ? +(netReceived - taxAmount - cmvAmount).toFixed(2)
      : undefined;
  const netMarginPercent =
    netProfit != null && price != null && price > 0 ? Math.round((netProfit / price) * 100) : undefined;

  const fixedCosts = (p.fixedFeeAmount ?? 0) + sellerShip;
  const estCost = price != null ? price * cmvRate : undefined;
  const profitMin =
    estCost != null
      ? +((estCost + fixedCosts) / Math.max(0.12, 1 - feeRate - taxRate - 0.15)).toFixed(2)
      : p.profitPriceMin;
  const profitMax =
    estCost != null
      ? +((estCost + fixedCosts) / Math.max(0.12, 1 - feeRate - taxRate - 0.25)).toFixed(2)
      : p.profitPriceMax;

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
            {netReceived != null && (
              <div className="fin-row highlight">
                <span>Anúncio recebe (líquido ML):</span>
                <strong className="pos-val">{brl(netReceived)}</strong>
              </div>
            )}
            {taxAmount != null && (
              <div className="fin-row">
                <span>Imposto ({taxPercent}%):</span>
                <strong className="neg">- {brl(taxAmount)}</strong>
              </div>
            )}
            {cmvAmount != null && (
              <div className="fin-row">
                <span>Custo produto ({cmvPercent}%):</span>
                <strong className="neg">- {brl(cmvAmount)}</strong>
              </div>
            )}
            {netProfit != null && (
              <div className="fin-row highlight">
                <span>Lucro líquido un. ({netMarginPercent}%):</span>
                <strong className={netProfit >= 0 ? "pos-val" : "neg"}>{brl(netProfit)}</strong>
              </div>
            )}
            {profitMin != null && profitMax != null && (
              <div className="fin-row profit-range">
                <span>Faixa p/ lucro (15%–25%):</span>
                <strong>
                  {brl(profitMin)} – {brl(profitMax)}
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
  const [selected, setSelected] = useState<string>(ALL_PRODS);
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("position");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [pageSize, setPageSize] = useState<number>(12);
  const [page, setPage] = useState<number>(1);
  const [taxPercent, setTaxPercent] = useState<number>(6);
  const [cmvPercent, setCmvPercent] = useState<number>(45);
  const [showMethodModal, setShowMethodModal] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get("cat");
    if (
      catParam &&
      (catParam === ALL_TOP1 ||
        catParam === ALL_PRODS ||
        snapshot.categories.some((c) => c.id === catParam))
    ) {
      setSelected(catParam);
    }
  }, [snapshot.categories]);

  const selectCategory = (catId: string) => {
    setSelected(catId);
    setPage(1);
    const url = new URL(window.location.href);
    url.searchParams.set("cat", catId);
    window.history.replaceState({}, "", url.toString());
  };

  const allProductsFlat = useMemo(
    () => snapshot.categories.flatMap((c) => c.products),
    [snapshot.categories],
  );

  const isGlobalView = selected === ALL_PRODS || selected === ALL_TOP1;
  const currentCategory = snapshot.categories.find((c) => c.id === selected);

  const baseProducts = useMemo(() => {
    if (selected === ALL_PRODS) return allProductsFlat;
    if (selected === ALL_TOP1) return snapshot.topOfAll;
    return currentCategory?.products ?? [];
  }, [selected, allProductsFlat, snapshot.topOfAll, currentCategory]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = baseProducts.filter((p) => {
      if (q) {
        const hay = [
          p.name,
          p.brand,
          p.model,
          p.categoryName,
          p.subcategoryName,
          p.sellerNickname,
          p.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (quickFilter === "full" && p.logisticType !== "Full") return false;
      if (quickFilter === "free_shipping" && !p.freeShipping) return false;
      if (quickFilter === "official" && !p.officialStore) return false;
      if (quickFilter === "platinum" && p.sellerPowerStatus !== "platinum") return false;
      if (quickFilter === "classic" && p.listingTypeName !== "Clássico") return false;
      if (quickFilter === "premium" && p.listingTypeName !== "Premium") return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "revenue_desc":
          return (b.estimatedMonthlyRevenue ?? -1) - (a.estimatedMonthlyRevenue ?? -1);
        case "daily_desc":
          return (b.estimatedDailySales ?? -1) - (a.estimatedDailySales ?? -1);
        case "discount_desc":
          return (b.discount ?? -1) - (a.discount ?? -1);
        case "price_asc":
          return (a.price ?? 9999999) - (b.price ?? 9999999);
        case "price_desc":
          return (b.price ?? -1) - (a.price ?? -1);
        case "net_desc":
          return (b.netReceived ?? -1) - (a.netReceived ?? -1);
        case "questions_desc":
          return (b.questionsTotal ?? -1) - (a.questionsTotal ?? -1);
        case "position":
        default:
          return a.position - b.position || (b.estimatedMonthlyRevenue ?? 0) - (a.estimatedMonthlyRevenue ?? 0);
      }
    });
  }, [baseProducts, search, quickFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageItems = filteredAndSorted.slice(startIdx, startIdx + pageSize);

  const trends = isGlobalView ? snapshot.generalTrends : (currentCategory?.trends ?? []);
  const catDetails = isGlobalView ? null : (currentCategory?.details ?? null);

  const updatedDate = new Date(snapshot.updatedAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  // Resumo estatístico da seleção atual
  const summaryStats = useMemo(() => {
    const withPrice = filteredAndSorted.filter((p) => p.price != null);
    const avgTicket =
      withPrice.length > 0
        ? withPrice.reduce((s, p) => s + (p.price ?? 0), 0) / withPrice.length
        : 0;
    const totalEstRev = filteredAndSorted.reduce(
      (s, p) => s + (p.estimatedMonthlyRevenue ?? 0),
      0,
    );
    const fullCount = filteredAndSorted.filter((p) => p.logisticType === "Full").length;
    return { avgTicket, totalEstRev, fullCount };
  }, [filteredAndSorted]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 7;
    let start = Math.max(1, safePage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  return (
    <main>
      <header className="top-header">
        <div>
          <h1>Inteligência de Mercado · Mercado Livre</h1>
          <small className="updated-at">
            Snapshot atualizado em: <strong>{updatedDate}</strong> · {allProductsFlat.length} produtos
            monitorados em {snapshot.categories.length} categorias
          </small>
        </div>
        <div className="header-actions">
          {catDetails && (
            <div className="cat-summary">
              <strong>{catDetails.pathFromRoot.join(" › ")}</strong> ·{" "}
              {num(catDetails.totalItems)} anúncios ativos
            </div>
          )}
          <button
            type="button"
            className="btn-method"
            onClick={() => setShowMethodModal((v) => !v)}
          >
            {showMethodModal ? "Fechar explicação" : "📊 Como calculamos as estimativas?"}
          </button>
        </div>
      </header>

      {showMethodModal && (
        <section className="method-box">
          <h3>Como cada métrica e estimativa é calculada?</h3>
          <div className="method-grid">
            <div>
              <strong>1. Vendas Estimadas &amp; Ritmo/Dia</strong>
              <p>
                A API pública do Mercado Livre bloqueia o campo <code>sold_quantity</code> em{" "}
                <code>/items</code> com erro <code>403</code>. Para contornar isso com dados reais,
                consultamos <code>/questions/search?item=&#123;id&#125;</code>, que retorna o{" "}
                <strong>total exato de perguntas</strong> e a <strong>data das últimas 50 perguntas</strong>.
                No e-commerce brasileiro (ML), a taxa média é de <strong>~1 pergunta a cada 8 vendas</strong>.
                Combinamos a velocidade das perguntas recentes (60%) com a média desde a data de criação do
                catálogo <code>date_created</code> (40%). Quando uma oferta vencedora acabou de entrar no
                buybox e ainda tem 0 perguntas, aplicamos uma curva de Pareto (Lei de Zipf) baseada na
                posição <code>#1..#20</code> do ranking.
              </p>
            </div>
            <div>
              <strong>2. Tarifa ML, Frete e Líquido Recebido (100% Oficial)</strong>
              <p>
                Consultamos <code>/sites/MLB/listing_prices</code> passando o preço real, a subcategoria e
                o tipo do anúncio (<code>Clássico</code> ou <code>Premium</code>) para obter a{" "}
                <strong>comissão exata do ML em R$ e %</strong>. Em seguida, consultamos{" "}
                <code>/users/&#123;seller&#125;/shipping_options/free</code> para obter o{" "}
                <strong>peso faturável (g) e o custo de frete Mercado Envios</strong>. O recebimento
                líquido é: <code>Preço - Tarifa ML - Frete pago pelo vendedor</code>.
              </p>
            </div>
            <div>
              <strong>3. Simulador de Imposto, CMV e Faixa de Preço p/ Lucro</strong>
              <p>
                Você pode ajustar abaixo a alíquota de <strong>Imposto (%)</strong> e o{" "}
                <strong>Custo da Mercadoria / CMV (%)</strong>. A faixa de preço recomendada usa a fórmula
                inversa de precificação para atingir de <strong>15% a 25% de margem líquida</strong> livre
                após descontar comissão do ML, taxa fixa, frete e impostos:
                <br />
                <code>Preço Ideal = (Custo + Frete + Taxa Fixa) ÷ (1 - %TarifaML - %Imposto - %Margem)</code>.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* PAINEL DE CONTROLE INTERATIVO (Menus, Busca, Ordenação, Filtros e Simulador) */}
      <section className="control-panel">
        <div className="control-row-main">
          <div className="field-group">
            <label htmlFor="cat-select">Categoria / Visão</label>
            <select
              id="cat-select"
              value={selected}
              onChange={(e) => selectCategory(e.target.value)}
            >
              <option value={ALL_PRODS}>
                🌎 Todas as categorias — Catálogo completo ({allProductsFlat.length} produtos)
              </option>
              <option value={ALL_TOP1}>
                🏆 Todas as categorias — Apenas o #1 de cada categoria ({snapshot.topOfAll.length}{" "}
                produtos)
              </option>
              <optgroup label="Escolher categoria específica (Top 20)">
                {snapshot.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.products.length})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="field-group search-group">
            <label htmlFor="search-input">Buscar produto, marca, subcategoria ou vendedor</label>
            <div className="search-wrap">
              <input
                id="search-input"
                type="search"
                placeholder="Ex.: Woosh, Taramps, Creatina, Full, Capacete..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="sort-select">Ordenar por</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortKey);
                setPage(1);
              }}
            >
              <option value="position">🏅 Posição no Ranking (#1 → #20)</option>
              <option value="revenue_desc">💰 Maior Faturamento Mensal Est.</option>
              <option value="daily_desc">🔥 Maior Ritmo de Vendas / Dia</option>
              <option value="discount_desc">🏷️ Maior Desconto (% OFF)</option>
              <option value="price_asc">💵 Menor Preço</option>
              <option value="price_desc">💎 Maior Preço</option>
              <option value="net_desc">📈 Maior Líquido Recebido (ML)</option>
              <option value="questions_desc">💬 Mais Perguntas</option>
            </select>
          </div>

          <div className="field-group small-group">
            <label htmlFor="pagesize-select">Por página</label>
            <select
              id="pagesize-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={12}>12 itens</option>
              <option value={20}>20 itens</option>
              <option value={40}>40 itens</option>
              <option value={60}>60 itens</option>
            </select>
          </div>
        </div>

        <div className="control-row-sub">
          <div className="quick-filters">
            <span className="qf-label">Filtros rápidos:</span>
            {(
              [
                ["all", "Todos"],
                ["full", "⚡ Full"],
                ["free_shipping", "🚚 Frete Grátis"],
                ["official", "🏪 Loja Oficial"],
                ["platinum", "🏅 MercadoLíder Platinum"],
                ["classic", "Anúncio Clássico"],
                ["premium", "Anúncio Premium"],
              ] as [QuickFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={quickFilter === key ? "qf-btn active" : "qf-btn"}
                onClick={() => {
                  setQuickFilter(key);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="simulators">
            <div className="sim-item">
              <label htmlFor="tax-range">
                Imposto: <strong>{taxPercent}%</strong>
              </label>
              <input
                id="tax-range"
                type="range"
                min={0}
                max={20}
                step={1}
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
              />
            </div>
            <div className="sim-item">
              <label htmlFor="cmv-range">
                Custo Produto (CMV): <strong>{cmvPercent}%</strong>
              </label>
              <input
                id="cmv-range"
                type="range"
                min={20}
                max={75}
                step={5}
                value={cmvPercent}
                onChange={(e) => setCmvPercent(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* KPIs da seleção filtrada */}
        <div className="kpi-bar">
          <div>
            <span>Produtos filtrados:</span> <strong>{num(filteredAndSorted.length)}</strong>
          </div>
          <div>
            <span>Ticket médio:</span> <strong>{brl(summaryStats.avgTicket)}</strong>
          </div>
          <div>
            <span>Faturamento mensal somado (est.):</span>{" "}
            <strong>{brl(summaryStats.totalEstRev)}</strong>
          </div>
          <div>
            <span>No Mercado Envios Full:</span>{" "}
            <strong>
              {summaryStats.fullCount} (
              {filteredAndSorted.length > 0
                ? Math.round((summaryStats.fullCount / filteredAndSorted.length) * 100)
                : 0}
              %)
            </strong>
          </div>
        </div>
      </section>

      {trends.length > 0 && (
        <section className="trends-bar">
          <span className="trends-label">
            🔥 Termos mais buscados ({isGlobalView ? "Geral MLB" : (catDetails?.name ?? "Categoria")}
            ):
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

      {/* Barra de paginação superior */}
      <div className="pagination-bar">
        <span className="page-info">
          Mostrando{" "}
          <strong>
            {filteredAndSorted.length === 0 ? 0 : startIdx + 1}–
            {Math.min(startIdx + pageSize, filteredAndSorted.length)}
          </strong>{" "}
          de <strong>{num(filteredAndSorted.length)}</strong> produtos (Página {safePage} de{" "}
          {totalPages})
        </span>
        {totalPages > 1 && (
          <div className="page-controls">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(1)}
            >
              « Primeira
            </button>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Anterior
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={n === safePage ? "active" : ""}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima ›
            </button>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              Última »
            </button>
          </div>
        )}
      </div>

      {pageItems.length === 0 ? (
        <div className="empty-state">
          Nenhum produto encontrado para os filtros selecionados.{" "}
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setQuickFilter("all");
              setPage(1);
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ol className="grid">
          {pageItems.map((p) => (
            <Card
              key={`${p.categoryId ?? ""}-${p.position}-${p.id}`}
              p={p}
              showCategory={isGlobalView}
              taxPercent={taxPercent}
              cmvPercent={cmvPercent}
            />
          ))}
        </ol>
      )}

      {/* Barra de paginação inferior */}
      {totalPages > 1 && (
        <div className="pagination-bar bottom">
          <span className="page-info">
            Página <strong>{safePage}</strong> de <strong>{totalPages}</strong>
          </span>
          <div className="page-controls">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => {
                setPage(1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              « Primeira
            </button>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ‹ Anterior
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={n === safePage ? "active" : ""}
                onClick={() => {
                  setPage(n);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Próxima ›
            </button>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => {
                setPage(totalPages);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Última »
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
