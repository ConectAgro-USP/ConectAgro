import type { Interest, InterestPurchase } from "./api/interests";
import { formatCount, formatDate, formatDay } from "./format";

export const AVAILABLE = "Disponível";

// o estado vem da parte da compra, a cancelada devolve o interesse aberto
export type InterestState = "open" | "purchase" | "delivered";

export function interestState(interest: Interest): InterestState {
  if (!interest.purchase) return "open";
  return interest.purchase.status === "ENTREGUE" ? "delivered" : "purchase";
}

export function purchaseText(purchase: InterestPurchase): string {
  const created = formatDay(purchase.created_at);
  const expected = formatDate(purchase.expected_delivery_date);
  return `Incluído na compra de ${created}, entrega prevista ${expected}`;
}

export function deliveredText(purchase: InterestPurchase): string {
  return purchase.closed_at ? `Entregue em ${formatDay(purchase.closed_at)}` : "Entregue";
}

export function chosenText(quantity: number): string {
  return `No seu interesse: ${formatCount(quantity, "kg", "kg")}`;
}

// em centavos, para a soma não acumular erro de ponto flutuante
export function costInCents(quantity: number, price: string): number {
  return Math.round(Number(price) * 100) * quantity;
}

// só o que ainda pode entrar na próxima compra do prédio entra no total
export function openCostInCents(interest: Interest): number {
  const { product } = interest;
  const open = interestState(interest) === "open";
  if (product === null || !open || interest.product_status !== AVAILABLE) return 0;
  return costInCents(interest.quantity, product.price);
}
