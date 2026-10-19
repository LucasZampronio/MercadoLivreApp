"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CMV_PERCENT, DEFAULT_TAX_PERCENT, type MeliSnapshot, type Product } from "@/lib/meli";
import ControlPanel, { type SubcategoryOption } from "./ControlPanel";
import { ALL_PRODS, ALL_TOP1, num, type QuickFilter, type SortKey } from "./formatters";
import MethodologyPanel from "./MethodologyPanel";
import PaginationBar from "./PaginationBar";
import ProductCard from "./ProductCard";

export default function DashboardClient({ snapshot }: { snapshot: MeliSnapshot }) {
  const [selected, setSelected] = useState<string>(ALL_PRODS);
  const [selectedSubcat, setSelectedSubcat] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("position");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [pageSize, setPageSize] = useState<number>(12);
  const [page, setPage] = useState<number>(1);
  const [taxPercent, setTaxPercent] = useState<number>(DEFAULT_TAX_PERCENT);
  const [cmvPercent, setCmvPercent] = useState<number>(DEFAULT_CMV_PERCENT);
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
    setSelectedSubcat("all");
    setPage(1);
    const url = new URL(window.location.href);
    url.searchParams.set("cat", catId);
    window.history.replaceState({}, "", url.toString());
  };

  const allProductsFlat = useMemo(() => {
    const seen = new Set<string>();
    const out: Product[] = [];
    for (const c of snapshot.categories) {
      for (const p of c.products) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
    }
    return out;
  }, [snapshot.categories]);

  const isGlobalView = selected === ALL_PRODS || selected === ALL_TOP1;
  const currentCategory = snapshot.categories.find((c) => c.id === selected);

  const baseProducts = useMemo(() => {
    if (selected === ALL_PRODS) return allProductsFlat;
    if (selected === ALL_TOP1) return snapshot.topOfAll;
    return currentCategory?.products ?? [];
  }, [selected, allProductsFlat, snapshot.topOfAll, currentCategory]);

  const subcategories = useMemo<SubcategoryOption[]>(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const p of baseProducts) {
      const id = p.subcategoryId ?? p.subcategoryName;
      const name = p.subcategoryName ?? p.subcategoryId;
      if (!id || !name) continue;
      const cur = map.get(id);
      if (cur) {
        cur.count += 1;
      } else {
        map.set(id, { id, name, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [baseProducts]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = baseProducts.filter((p) => {
      if (selectedSubcat !== "all") {
        const subKey = p.subcategoryId ?? p.subcategoryName;
        if (subKey !== selectedSubcat) return false;
      }
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
        case "total_revenue_desc":
          return (b.estimatedTotalRevenue ?? -1) - (a.estimatedTotalRevenue ?? -1);
        case "revenue_desc":
          return (b.estimatedMonthlyRevenue ?? -1) - (a.estimatedMonthlyRevenue ?? -1);
        case "daily_desc":
          return (b.estimatedDailySales ?? -1) - (a.estimatedDailySales ?? -1);
        case "visits_desc":
          return (b.estimatedVisits ?? -1) - (a.estimatedVisits ?? -1);
        case "conversion_desc":
          return (b.conversionRatePercent ?? -1) - (a.conversionRatePercent ?? -1);
        case "discount_desc":
          return (b.discount ?? -1) - (a.discount ?? -1);
        case "price_asc":
          return (a.price ?? 9999999) - (b.price ?? 9999999);
        case "price_desc":
          return (b.price ?? -1) - (a.price ?? -1);
        case "net_desc":
          return (b.netAfterTax ?? b.netReceived ?? -1) - (a.netAfterTax ?? a.netReceived ?? -1);
        case "questions_desc":
          return (b.questionsTotal ?? -1) - (a.questionsTotal ?? -1);
        case "position":
        default:
          return (
            a.position - b.position ||
            (b.estimatedMonthlyRevenue ?? 0) - (a.estimatedMonthlyRevenue ?? 0)
          );
      }
    });
  }, [baseProducts, selectedSubcat, search, quickFilter, sortBy]);

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

  const handlePageChangeBottom = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <header className="top-header">
        <div>
          <h1>Inteligência de Mercado · Mercado Livre</h1>
          <small className="updated-at">
            Snapshot atualizado em: <strong>{updatedDate}</strong> ·{" "}
            <strong>{num(allProductsFlat.length)}</strong> produtos únicos em{" "}
            {snapshot.categories.length} categorias e {subcategories.length}+ subcategorias
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

      {showMethodModal && <MethodologyPanel />}

      <ControlPanel
        selected={selected}
        onSelectCategory={selectCategory}
        selectedSubcat={selectedSubcat}
        onSelectSubcat={(subId) => {
          setSelectedSubcat(subId);
          setPage(1);
        }}
        subcategories={subcategories}
        totalCatalogCount={allProductsFlat.length}
        topOfAllCount={snapshot.topOfAll.length}
        categories={snapshot.categories}
        search={search}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        sortBy={sortBy}
        onSortChange={(s) => {
          setSortBy(s);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setPage(1);
        }}
        quickFilter={quickFilter}
        onQuickFilterChange={(qf) => {
          setQuickFilter(qf);
          setPage(1);
        }}
        taxPercent={taxPercent}
        onTaxChange={setTaxPercent}
        cmvPercent={cmvPercent}
        onCmvChange={setCmvPercent}
        filteredCount={filteredAndSorted.length}
        avgTicket={summaryStats.avgTicket}
        totalEstRev={summaryStats.totalEstRev}
        fullCount={summaryStats.fullCount}
      />

      {trends.length > 0 && (
        <section className="trends-bar">
          <span className="trends-label">
            🔥 Termos mais buscados (
            {isGlobalView ? "Geral MLB" : (catDetails?.name ?? "Categoria")}):
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

      <PaginationBar
        safePage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredAndSorted.length}
        startIdx={startIdx}
        pageNumbers={pageNumbers}
        onPageChange={setPage}
      />

      {pageItems.length === 0 ? (
        <div className="empty-state">
          Nenhum produto encontrado para os filtros selecionados.{" "}
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedSubcat("all");
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
            <ProductCard
              key={`${p.categoryId ?? ""}-${p.position}-${p.id}`}
              p={p}
              showCategory={isGlobalView}
              taxPercent={taxPercent}
              cmvPercent={cmvPercent}
            />
          ))}
        </ol>
      )}

      <PaginationBar
        safePage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredAndSorted.length}
        startIdx={startIdx}
        pageNumbers={pageNumbers}
        onPageChange={handlePageChangeBottom}
        isBottom
      />
    </main>
  );
}
