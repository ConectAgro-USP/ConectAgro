import { screen } from "@testing-library/react";
import type { PurchaseItem } from "../api/history";
import type { Sale } from "../api/sales";
import { MySales } from "../pages/MySales";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "./helpers";

const mandioca: PurchaseItem = {
  product_public_id: "produto-1",
  product_name: "Mandioca",
  quantity: 3,
  unit_price: "7.00",
  subtotal: "21.00",
};
export const pendingSale: Sale = {
  purchase_public_id: "compra-1",
  apartment_public_id: "predio-1",
  building_name: "Cond. Village Vila Verde",
  purchased_at: "2026-11-10T14:00:00Z",
  expected_delivery_date: "2026-11-20",
  status: "EM PROGRESSO",
  closed_at: null,
  total: "21.00",
  purchase_products: [mandioca],
};
export const deliveredSale: Sale = {
  ...pendingSale,
  purchase_public_id: "compra-2",
  apartment_public_id: "predio-2",
  building_name: "Edifício Jardim das Acácias",
  status: "ENTREGUE",
  closed_at: "2026-11-12T15:00:00Z",
};
const buildings = [
  { public_id: "predio-1", name: "Cond. Village Vila Verde" },
  { public_id: "predio-2", name: "Edifício Jardim das Acácias" },
];

export function salesPage(...sales: Sale[]): Response {
  return jsonResponse({
    items: sales,
    page: 1,
    total_pages: 1,
    realized_total: "21.00",
    expected_total: "21.00",
    counterparts: buildings,
  });
}

export function renderSales(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(<MySales />, fakeAuth({ user: anaAsFarmer }));
  return fetchMock;
}

export async function findSale(building: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name: building });
  return title.closest("li")!;
}
