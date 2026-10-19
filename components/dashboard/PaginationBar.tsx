"use client";

import { num } from "./formatters";

type PaginationBarProps = {
  safePage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIdx: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
  isBottom?: boolean;
};

export default function PaginationBar({
  safePage,
  totalPages,
  pageSize,
  totalItems,
  startIdx,
  pageNumbers,
  onPageChange,
  isBottom,
}: PaginationBarProps) {
  if (isBottom && totalPages <= 1) return null;

  return (
    <div className={isBottom ? "pagination-bar bottom" : "pagination-bar"}>
      <span className="page-info">
        {isBottom ? (
          <>
            Página <strong>{safePage}</strong> de <strong>{totalPages}</strong>
          </>
        ) : (
          <>
            Mostrando{" "}
            <strong>
              {totalItems === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + pageSize, totalItems)}
            </strong>{" "}
            de <strong>{num(totalItems)}</strong> produtos (Página {safePage} de {totalPages})
          </>
        )}
      </span>
      {totalPages > 1 && (
        <div className="page-controls">
          <button type="button" disabled={safePage === 1} onClick={() => onPageChange(1)}>
            « Primeira
          </button>
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
          >
            ‹ Anterior
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              type="button"
              className={n === safePage ? "active" : ""}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          >
            Próxima ›
          </button>
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            Última »
          </button>
        </div>
      )}
    </div>
  );
}

