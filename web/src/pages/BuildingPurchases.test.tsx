import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import type { PurchaseItem } from "../api/history";
import type { ProfileRead } from "../api/profiles";
import type { BuildingPurchase, PurchasePart } from "../api/purchases";
import {
  ana,
  anaAsBuyer,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  stubFetch,
  villageVilaVerde,
} from "../test/helpers";
import { BuildingPurchases } from "./BuildingPurchases";

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
const osvaldoPart: PurchasePart = {
  public_id: "parte-1",
  farmer_public_id: "agricultor-1",
  farmer_short_name: "Osvaldo S.",
  status: "EM PROGRESSO",
  closed_at: null,
  total: "30.00",
  purchase_products: [mandioca, laranja],
};
const mariaPart: PurchasePart = {
  public_id: "parte-2",
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  status: "ENTREGUE",
  closed_at: "2026-11-11T15:00:00Z",
  total: "18.00",
  purchase_products: [tomate],
};
const purchase: BuildingPurchase = {
  public_id: "compra-1",
  status: "EM PROGRESSO",
  created_at: "2026-11-10T14:00:00Z",
  expected_delivery_date: "2026-11-20",
  closed_at: null,
  total: "48.00",
  purchase_parts: [osvaldoPart, mariaPart],
};
// a API lista todos os agricultores do prédio, e um deles entrou sem nome
const farmers = [
  { public_id: "agricultor-3", name: "" },
  { public_id: "agricultor-2", name: "Maria F." },
  { public_id: "agricultor-1", name: "Osvaldo S." },
];

function pageOf(...purchases: BuildingPurchase[]): Response {
  return jsonResponse({
    items: purchases,
    page: 1,
    total_pages: 1,
    realized_total: "18.00",
    expected_total: "30.00",
    counterparts: farmers,
  });
}

function renderPurchases(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(<BuildingPurchases />, fakeAuth({ user: manager }));
  return fetchMock;
}

async function findCard(farmers: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name: farmers });
  return title.closest("li")!;
}

describe("BuildingPurchases", () => {
  it("asks for the purchases of the building", async () => {
    const fetchMock = renderPurchases(pageOf(purchase));

    await findCard("Osvaldo S. e Maria F.");
    expect(screen.getByRole("heading", { name: "Compras do prédio" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments/me/purchases?page=1");
  });

  it("shows the farmers, the products, the date and the total of a purchase", async () => {
    renderPurchases(pageOf(purchase));

    const card = await findCard("Osvaldo S. e Maria F.");

    expect(within(card).getByText("Mandioca, Laranja e Tomate")).toBeVisible();
    expect(card).toHaveTextContent(/Data do pedido:\s*10\/11/);
    expect(card).toHaveTextContent(/Valor combinado\s*R\$ 48,00/);
  });

  it("names the totals after what is delivered and what is on its way", async () => {
    renderPurchases(pageOf(purchase));

    expect(await screen.findByText("Total entregue")).toBeInTheDocument();
    expect(screen.getByText("Total a caminho")).toBeInTheDocument();
  });

  it("opens the part of each farmer with its status and items", async () => {
    renderPurchases(pageOf(purchase));
    const card = await findCard("Osvaldo S. e Maria F.");

    await userEvent.click(within(card).getByRole("button", { name: "Ver detalhes" }));

    const osvaldo = within(card).getByRole("heading", { name: "Osvaldo S." }).closest("section")!;
    expect(within(osvaldo).getByText("A caminho")).toBeVisible();
    expect(osvaldo).toHaveTextContent(/Mandioca\s*3 × R\$ 7,00\s*R\$ 21,00/);
    expect(osvaldo).toHaveTextContent(/Subtotal\s*R\$ 30,00/);
    const maria = within(card).getByRole("heading", { name: "Maria F." }).closest("section")!;
    expect(within(maria).getByText("Entregue em 11/11")).toBeVisible();
    expect(maria).toHaveTextContent(/Tomate\s*2 × R\$ 9,00\s*R\$ 18,00/);
  });

  it("leaves the subtotal out of a part with a single product", async () => {
    renderPurchases(pageOf(purchase));
    const card = await findCard("Osvaldo S. e Maria F.");

    await userEvent.click(within(card).getByRole("button", { name: "Ver detalhes" }));

    const maria = within(card).getByRole("heading", { name: "Maria F." }).closest("section")!;
    expect(maria).not.toHaveTextContent("Subtotal");
  });

  it("filters the purchases by farmer", async () => {
    const fetchMock = renderPurchases(pageOf(purchase), pageOf(purchase));
    await userEvent.click(await screen.findByRole("button", { name: "Filtrar" }));

    await userEvent.selectOptions(screen.getByLabelText("Agricultor"), "Maria F.");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/apartments/me/purchases?page=1&farmer_public_id=agricultor-2",
    );
  });

  it("names the farmer whose account has no name", async () => {
    const nameless = { ...mariaPart, farmer_short_name: "" };
    renderPurchases(pageOf({ ...purchase, purchase_parts: [nameless] }));

    expect(await findCard("Agricultor")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(screen.getByRole("option", { name: "Agricultor" })).toHaveValue("agricultor-3");
  });

  it("shows when the purchase is expected to arrive", async () => {
    renderPurchases(pageOf(purchase));

    const card = await findCard("Osvaldo S. e Maria F.");

    expect(card).toHaveTextContent(/Entrega prevista:\s*20\/11/);
  });

  it("says when the building has no purchase yet", async () => {
    renderPurchases(pageOf());

    expect(await screen.findByText("O prédio ainda não fez nenhuma compra")).toBeInTheDocument();
  });

  it("opens at /compras for the manager", async () => {
    stubFetch(pageOf(purchase));
    renderWithAuth(<App />, fakeAuth({ user: manager }), "/compras");

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeInTheDocument();
  });

  it("sends a resident at /compras back to the home", () => {
    const fetchMock = stubFetch();
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), "/compras");

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
