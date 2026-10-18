export const ALL_PRODS = "catalogo_completo";
export const ALL_TOP1 = "todas";

export type SortKey =
  | "position"
  | "revenue_desc"
  | "daily_desc"
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

export const POWER_LABELS: Record<string, string> = {
  platinum: "MercadoLíder Platinum",
  gold: "MercadoLíder Gold",
  silver: "MercadoLíder",
};
