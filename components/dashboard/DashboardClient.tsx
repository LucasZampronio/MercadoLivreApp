"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CMV_PERCENT, DEFAULT_TAX_PERCENT, type MeliSnapshot } from "@/lib/meli";
import ControlPanel from "./ControlPanel";
import { ALL_PRODS, ALL_TOP1, num, type QuickFilter, type SortKey } from "./formatters";
import MethodologyPanel from "./MethodologyPanel";
import PaginationBar from "./PaginationBar";
import ProductCard from "./ProductCard";

export default function DashboardClient({ snapshot }: { snapshot: MeliSnapshot }) {
  const [selected, setSelected] = useState<string>(ALL_PRODS);
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
          return (
            a.position - b.position ||
            (b.estimatedMonthlyRevenue ?? 0) - (a.estimatedMonthlyRevenue ?? 0)
          );
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
            Snapshot atualizado em: <strong>{updatedDate}</strong> · {allProductsFlat.length}{" "}
            produtos monitorados em {snapshot.categories.length} categorias
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
