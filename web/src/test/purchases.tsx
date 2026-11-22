import { screen } from "@testing-library/react";
import type { PurchaseItem } from "../api/history";
import type { BuildingPurchase, PurchasePart } from "../api/purchases";
import type { Reviewable } from "../api/reviews";
import { BuildingPurchases } from "../pages/BuildingPurchases";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "./helpers";

const mandioca: PurchaseItem = {
  product_public_id: "produto-1",
  product_name: "Mandioca",
  quantity: 3,
  unit_price: "7.00",
  subtotal: "21.00",
};
const laranja: PurchaseItem = {
  product_public_id: "produto-2",
  product_name: "Laranja",
  quantity: 2,
  unit_price: "4.50",
  subtotal: "9.00",
};
const tomate: PurchaseItem = {
  product_public_id: "produto-3",
  product_name: "Tomate",
  quantity: 2,
  unit_price: "9.00",
  subtotal: "18.00",
};
export const osvaldoPart: PurchasePart = {
  public_id: "parte-1",
  farmer_public_id: "agricultor-1",
  farmer_short_name: "Osvaldo S.",
  status: "EM PROGRESSO",
  closed_at: null,
  total: "30.00",
  purchase_products: [mandioca, laranja],
};
export const mariaPart: PurchasePart = {
  public_id: "parte-2",
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  status: "ENTREGUE",
  closed_at: "2026-11-11T15:00:00Z",
  total: "18.00",
  purchase_products: [tomate],
};
export const purchase: BuildingPurchase = {
  public_id: "compra-1",
  status: "EM PROGRESSO",
  created_at: "2026-11-10T14:00:00Z",
  expected_delivery_date: "2026-11-20",
  closed_at: null,
  total: "48.00",
  purchase_parts: [osvaldoPart, mariaPart],
};
export const openPurchase: BuildingPurchase = {
  ...purchase,
  public_id: "compra-2",
  total: "30.00",
  purchase_parts: [osvaldoPart],
};
// a API lista todos os agricultores do prédio, e um deles entrou sem nome
const farmers = [
  { public_id: "agricultor-3", name: "" },
  { public_id: "agricultor-2", name: "Maria F." },
  { public_id: "agricultor-1", name: "Osvaldo S." },
];

export function pageOf(...purchases: BuildingPurchase[]): Response {
  return jsonResponse({
    items: purchases,
    page: 1,
    total_pages: 1,
    realized_total: "18.00",
    expected_total: "30.00",
    counterparts: farmers,
  });
}

export function renderPurchases(firstPage: Response, ...more: Response[]) {
  return renderRating(firstPage, [], ...more);
}

export function renderRating(firstPage: Response, reviewables: Reviewable[], ...more: Response[]) {
  const fetchMock = stubFetch(firstPage, jsonResponse(reviewables), ...more);
  renderWithAuth(<BuildingPurchases />, fakeAuth({ user: anaAsManager }));
  return fetchMock;
}

export async function findCard(farmers: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name: farmers });
  return title.closest("li")!;
}
