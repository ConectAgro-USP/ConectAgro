import type { MyProduct } from "../../api/products";
import { daysUntil } from "../../format";

export type ProductState = "available" | "paused" | "expired" | "soldOut";

export const STATE_LABELS: Record<ProductState, string> = {
  available: "Disponível",
  paused: "Pausado",
  expired: "Vencido",
  soldOut: "Esgotado",
};

// a pausa vem antes, porque é o que o botão de retomar desfaz
export function stateOf(product: MyProduct): ProductState {
  if (!product.is_available) return "paused";
  if (daysUntil(product.expiration_date) < 0) return "expired";
  if (product.quantity === 0) return "soldOut";
  return "available";
}

export type ProductTab = "all" | "available" | "hidden";

export function inTab(tab: ProductTab, product: MyProduct): boolean {
  if (tab === "all") return true;
  return (stateOf(product) === "available") === (tab === "available");
}
