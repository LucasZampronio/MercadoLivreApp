"use client";

import type { CategorySnapshot } from "@/lib/meli";
import {
  ALL_PRODS,
  ALL_TOP1,
  brl,
  num,
  type QuickFilter,
  type SortKey,
} from "./formatters";

type ControlPanelProps = {
  selected: string;
  onSelectCategory: (catId: string) => void;
  totalCatalogCount: number;
  topOfAllCount: number;
  categories: CategorySnapshot[];
  search: string;
  onSearchChange: (q: string) => void;
  sortBy: SortKey;
  onSortChange: (sort: SortKey) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
  taxPercent: number;
  onTaxChange: (tax: number) => void;
  cmvPercent: number;
  onCmvChange: (cmv: number) => void;
  filteredCount: number;
  avgTicket: number;
  totalEstRev: number;
  fullCount: number;
};

const QUICK_FILTERS: [QuickFilter, string][] = [
  ["all", "Todos"],
  ["full", "⚡ Full"],
  ["free_shipping", "🚚 Frete Grátis"],
  ["official", "🏪 Loja Oficial"],
  ["platinum", "🏅 MercadoLíder Platinum"],
  ["classic", "Anúncio Clássico"],
  ["premium", "Anúncio Premium"],
];

export default function ControlPanel({
  selected,
  onSelectCategory,
  totalCatalogCount,
  topOfAllCount,
  categories,
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  pageSize,
  onPageSizeChange,
  quickFilter,
  onQuickFilterChange,
  taxPercent,
  onTaxChange,
  cmvPercent,
  onCmvChange,
  filteredCount,
  avgTicket,
  totalEstRev,
  fullCount,
}: ControlPanelProps) {
  return (
    <section className="control-panel">
      <div className="control-row-main">
        <div className="field-group">
          <label htmlFor="cat-select">Categoria / Visão</label>
          <select
            id="cat-select"
            value={selected}
            onChange={(e) => onSelectCategory(e.target.value)}
          >
            <option value={ALL_PRODS}>
              🌎 Todas as categorias — Catálogo completo ({totalCatalogCount} produtos)
            </option>
            <option value={ALL_TOP1}>
              🏆 Todas as categorias — Apenas o #1 de cada categoria ({topOfAllCount} produtos)
            </option>
            <optgroup label="Escolher categoria específica (Top 20)">
              {categories.map((c) => (
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
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {search && (
              <button type="button" className="clear-btn" onClick={() => onSearchChange("")}>
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
            onChange={(e) => onSortChange(e.target.value as SortKey)}
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
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
          {QUICK_FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={quickFilter === key ? "qf-btn active" : "qf-btn"}
              onClick={() => onQuickFilterChange(key)}
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
              onChange={(e) => onTaxChange(Number(e.target.value))}
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
              onChange={(e) => onCmvChange(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="kpi-bar">
        <div>
          <span>Produtos filtrados:</span> <strong>{num(filteredCount)}</strong>
        </div>
        <div>
          <span>Ticket médio:</span> <strong>{brl(avgTicket)}</strong>
        </div>
        <div>
          <span>Faturamento mensal somado (est.):</span> <strong>{brl(totalEstRev)}</strong>
        </div>
        <div>
          <span>No Mercado Envios Full:</span>{" "}
          <strong>
            {fullCount} ({filteredCount > 0 ? Math.round((fullCount / filteredCount) * 100) : 0}%)
          </strong>
        </div>
      </div>
    </section>
  );
}
