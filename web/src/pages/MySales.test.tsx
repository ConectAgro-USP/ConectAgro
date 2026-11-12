import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import type { PurchaseItem } from "../api/history";
import type { ProfileRead } from "../api/profiles";
import type { Sale } from "../api/sales";
import {
  ana,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  stubFetch,
  villageVilaVerde,
} from "../test/helpers";
import { MySales } from "./MySales";

const farmer: ProfileRead = {
  ...ana,
  profile_type: "farmer",
  farmer: { farm_name: "Sítio Boa Vista", zip_code: "01310200" },
};
const manager: ProfileRead = { ...ana, profile_type: "apartment", apartment: villageVilaVerde };

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
  unit_price: "9.00",
  subtotal: "18.00",
};
const sale: Sale = {
  purchase_public_id: "compra-1",
  apartment_public_id: "predio-1",
  building_name: "Cond. Village Vila Verde",
  purchased_at: "2026-11-10T14:00:00Z",
  status: "EM PROGRESSO",
  closed_at: null,
  total: "39.00",
  purchase_products: [mandioca, laranja],
};
const otherBuildingSale: Sale = {
  ...sale,
  purchase_public_id: "compra-2",
  apartment_public_id: "predio-2",
  building_name: "Edifício Jardim das Acácias",
};

function pageOf(...sales: Sale[]): Response {
  return jsonResponse({
    items: sales,
    page: 1,
    total_pages: 1,
    realized_total: "21.00",
    expected_total: "39.00",
  });
}

function renderSales(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(<MySales />, fakeAuth({ user: farmer }));
  return fetchMock;
}

async function findCard(building: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name: building });
  return title.closest("li")!;
}

describe("MySales", () => {
  it("asks for the sales of the farmer", async () => {
    const fetchMock = renderSales(pageOf(sale));

    await findCard("Cond. Village Vila Verde");
    expect(screen.getByRole("heading", { name: "Minhas vendas" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/farmers/me/sales?page=1");
  });

  it("shows the building, the products, the date, the status and the total of a sale", async () => {
    renderSales(pageOf(sale));

    const card = await findCard("Cond. Village Vila Verde");

    expect(within(card).getByText("Mandioca e Laranja")).toBeVisible();
    expect(within(card).getByText("Pendente")).toBeVisible();
    expect(card).toHaveTextContent(/Data do pedido:\s*10\/11/);
    expect(card).toHaveTextContent(/Valor combinado\s*R\$ 39,00/);
  });

  it("names the totals after what is delivered and what is pending", async () => {
    renderSales(pageOf(sale));

    expect(await screen.findByText("Total entregue")).toBeInTheDocument();
    expect(screen.getByText("Total pendente")).toBeInTheDocument();
  });

  it("opens the items of a sale", async () => {
    renderSales(pageOf(sale));
    const card = await findCard("Cond. Village Vila Verde");

    await userEvent.click(within(card).getByRole("button", { name: "Ver detalhes" }));

    expect(within(card).getByText("3 × R$ 7,00")).toBeVisible();
    expect(card).toHaveTextContent(/Mandioca\s*3 × R\$ 7,00\s*R\$ 21,00/);
    expect(card).toHaveTextContent(/Laranja\s*2 × R\$ 9,00\s*R\$ 18,00/);
  });

  it("filters the sales by building", async () => {
    const fetchMock = renderSales(pageOf(sale, otherBuildingSale), pageOf(otherBuildingSale));
    await userEvent.click(await screen.findByRole("button", { name: "Filtrar" }));

    await userEvent.selectOptions(screen.getByLabelText("Prédio"), "Edifício Jardim das Acácias");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/farmers/me/sales?page=1&apartment_public_id=predio-2",
    );
  });

  it("says when the farmer has no sale yet", async () => {
    renderSales(pageOf());

    expect(await screen.findByText("Você ainda não fez nenhuma venda")).toBeInTheDocument();
  });

  it("opens at /vendas for the farmer", async () => {
    stubFetch(pageOf(sale));
    renderWithAuth(<App />, fakeAuth({ user: farmer }), "/vendas");

    expect(await screen.findByRole("heading", { name: "Minhas vendas" })).toBeInTheDocument();
  });

  it("sends a manager at /vendas back to the home", () => {
    const fetchMock = stubFetch();
    renderWithAuth(<App />, fakeAuth({ user: manager }), "/vendas");

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
