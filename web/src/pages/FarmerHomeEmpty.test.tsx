import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findSummary, renderHome, salesPage } from "../test/home";
import { orange, productsResponse } from "../test/products";
import { pendingSale } from "../test/sales";
import { MyProducts } from "./MyProducts";

const FIRST = "Cadastrar primeiro produto";

describe("FarmerHome, a farmer without products", () => {
  it("invites the farmer to add the first product", async () => {
    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Seus produtos aparecem aqui" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre o que você colhe para os prédios da região verem e comprarem."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: FIRST })).toHaveAttribute(
      "href",
      "/meus-produtos?novo=1",
    );
    expect(screen.queryByRole("link", { name: "Cadastrar produto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Seus produtos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sua nota" })).not.toBeInTheDocument();
  });

  it("still shows the sales left to deliver", async () => {
    renderHome({ sales: salesPage([pendingSale], 1, "21.00") });

    const summary = await findSummary("Vendas a entregar");

    expect(await within(summary).findByText("Cond. Village Vila Verde")).toBeVisible();
    expect(screen.getByRole("link", { name: FIRST })).toBeInTheDocument();
  });
});

describe("FarmerHome, when a summary does not load", () => {
  it("shows the reason and loads that summary again", async () => {
    const refused = jsonResponse({ detail: "Algo deu errado no servidor" }, 500);
    const fetchMock = renderHome({ products: [orange], sales: [refused] });
    const summary = await findSummary("Vendas a entregar");

    expect(await within(summary).findByRole("alert")).toHaveTextContent(
      "Algo deu errado no servidor",
    );
    await userEvent.click(within(summary).getByRole("button", { name: "Tentar de novo" }));

    expect(await within(summary).findByText("Nenhuma venda para entregar agora.")).toBeVisible();
    const salesCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/sales"));
    expect(salesCalls).toHaveLength(2);
  });
});

describe("MyProducts opened from the home page", () => {
  it("opens the form for a new product", async () => {
    stubFetch(productsResponse([orange]));
    renderWithAuth(<MyProducts />, fakeAuth({ user: anaAsFarmer }), "/meus-produtos?novo=1");

    expect(screen.getByRole("heading", { name: "Cadastrar produto" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("heading", { name: "Laranja" })).toBeInTheDocument();
  });
});
