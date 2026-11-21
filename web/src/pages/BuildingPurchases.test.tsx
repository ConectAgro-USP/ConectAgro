import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import type { PurchaseItem } from "../api/history";
import type { ProfileRead } from "../api/profiles";
import type { BuildingPurchase, PurchasePart } from "../api/purchases";
import type { Reviewable } from "../api/reviews";
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

function renderPurchases(firstPage: Response, ...more: Response[]) {
  return renderRating(firstPage, [], ...more);
}

function renderRating(firstPage: Response, reviewables: Reviewable[], ...more: Response[]) {
  const fetchMock = stubFetch(firstPage, jsonResponse(reviewables), ...more);
  renderWithAuth(<BuildingPurchases />, fakeAuth({ user: manager }));
  return fetchMock;
}

const mariaToRate: Reviewable = {
  purchase_public_id: "compra-1",
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  delivered_at: "2026-11-11T15:00:00Z",
  product_names: ["Tomate"],
};

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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe(
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

  it("asks which deliveries the manager can still rate", async () => {
    const fetchMock = renderPurchases(pageOf(purchase));

    await findCard("Osvaldo S. e Maria F.");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/purchases/reviewable");
  });

  it("invites to rate the delivered part still without a rating, without opening it", async () => {
    renderRating(pageOf(purchase), [mariaToRate]);
    const card = await findCard("Osvaldo S. e Maria F.");

    const rate = await within(card).findByRole("group", { name: "Avalie a compra de Maria F." });
    expect(rate).toBeVisible();
    expect(within(rate).getByRole("link", { name: "4 estrelas" })).toHaveAttribute(
      "href",
      "/avaliar?compra=compra-1&agricultor=agricultor-2&nota=4",
    );
    // a parte do Osvaldo ainda está a caminho
    expect(within(card).getAllByRole("group")).toHaveLength(1);
  });

  it("just says to rate the purchase when it has a single farmer", async () => {
    const onlyMaria = { ...purchase, status: "ENTREGUE" as const, purchase_parts: [mariaPart] };
    renderRating(pageOf(onlyMaria), [mariaToRate]);

    const card = await findCard("Maria F.");

    expect(await within(card).findByRole("group", { name: "Avalie a compra" })).toBeVisible();
  });

  it("leaves the stars out of purchases already rated or of other buildings", async () => {
    const elsewhere = { ...mariaToRate, purchase_public_id: "compra-9" };
    renderRating(pageOf(purchase), [elsewhere]);

    const card = await findCard("Osvaldo S. e Maria F.");

    expect(within(card).queryByRole("group")).not.toBeInTheDocument();
  });

  it("keeps the history when the deliveries to rate do not load", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(pageOf(purchase), jsonResponse({}, 500));
    renderWithAuth(<BuildingPurchases />, fakeAuth({ user: manager }));

    const card = await findCard("Osvaldo S. e Maria F.");

    await waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
    expect(within(card).queryByRole("group")).not.toBeInTheDocument();
  });

  it("shows when the purchase is expected to arrive", async () => {
    renderPurchases(pageOf(purchase));

    const card = await findCard("Osvaldo S. e Maria F.");

    expect(card).toHaveTextContent(/Entrega prevista:\s*20\/11/);
  });

  it("invites the manager without purchases to the home", async () => {
    renderPurchases(pageOf());

    expect(
      await screen.findByText(
        "Você ainda não fez compras, confira a página inicial e faça a sua primeira compra hoje",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toBeInTheDocument();
  });

  it("opens at /compras for the manager", async () => {
    stubFetch(pageOf(purchase), jsonResponse([]));
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
