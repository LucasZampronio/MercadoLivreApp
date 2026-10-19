export const ALL_PRODS = "catalogo_completo";
export const ALL_TOP1 = "todas";

export type SortKey =
  | "position"
  | "total_revenue_desc"
  | "revenue_desc"
  | "daily_desc"
  | "visits_desc"
  | "conversion_desc"
  | "discount_desc"
  | "price_asc"
  | "price_desc"
  | "net_desc"
  | "questions_desc";

export type QuickFilter =
  | "all"
  | "full"
  | "free_shipping"
  | "official"
  | "platinum"
  | "classic"
  | "premium";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (n: number) => n.toLocaleString("pt-BR");

export const pct = (n: number, decimals = 2) =>
  `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;

export const fmtDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const POWER_LABELS: Record<string, string> = {
  platinum: "MercadoLíder Platinum",
  gold: "MercadoLíder Gold",
  silver: "MercadoLíder",
};
