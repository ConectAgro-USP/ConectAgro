import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import {
  anaAsBuyer,
  anaAsManager,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  stubFetch,
} from "../test/helpers";
import { findCard, mariaPart, pageOf, purchase, renderPurchases } from "../test/purchases";

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
    renderWithAuth(<App />, fakeAuth({ user: anaAsManager }), "/compras");

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeInTheDocument();
  });

  it("sends a resident at /compras back to the home", () => {
    const fetchMock = stubFetch();
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), "/compras");

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
