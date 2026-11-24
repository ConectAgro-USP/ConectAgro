import type { Availability, MyProduct, MyProductCounts } from "../../api/products";
import { daysUntil } from "../../format";

export type ProductState = "available" | "paused" | "expired" | "soldOut";

export const STATE_LABELS: Record<ProductState, string> = {
  available: "Disponível",
  paused: "Pausado",
  expired: "Vencido",
  soldOut: "Esgotado",
};

// a mesma regra vale para o dono, a página do produto e o carrinho
type Stateful = Pick<MyProduct, "is_available" | "expiration_date" | "quantity">;

// a pausa vem antes, porque é o que o botão de retomar desfaz
export function stateOf(product: Stateful): ProductState {
  if (!product.is_available) return "paused";
  if (daysUntil(product.expiration_date) < 0) return "expired";
  if (product.quantity <= 0) return "soldOut";
  return "available";
}

export type ProductTab = "all" | "available" | "hidden";

export function inTab(tab: ProductTab, product: MyProduct): boolean {
  if (tab === "all") return true;
  return (stateOf(product) === "available") === (tab === "available");
}

export function availabilityOf(tab: ProductTab): Availability | null {
  return tab === "all" ? null : tab;
}

// o mesmo prazo que a API usa para contar os que vencem logo
const EXPIRING_SOON_DAYS = 7;

function countsOf(product: MyProduct): MyProductCounts {
  const available = stateOf(product) === "available";
  return {
    all: 1,
    available: available ? 1 : 0,
    hidden: available ? 0 : 1,
    sold_out: stateOf(product) === "soldOut" ? 1 : 0,
    expiring_soon: available && daysUntil(product.expiration_date) <= EXPIRING_SOON_DAYS ? 1 : 0,
  };
}

// a contagem da API acompanha a escrita, sem pedir a lista de novo
export function recount(
  counts: MyProductCounts,
  before: MyProduct | null,
  after: MyProduct | null,
): MyProductCounts {
  const removed = before ? countsOf(before) : null;
  const added = after ? countsOf(after) : null;
  const change = (key: keyof MyProductCounts) =>
    counts[key] - (removed?.[key] ?? 0) + (added?.[key] ?? 0);
  return {
    all: change("all"),
    available: change("available"),
    hidden: change("hidden"),
    sold_out: change("sold_out"),
    expiring_soon: change("expiring_soon"),
  };
}
