import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MyProduct, MyProductCounts } from "../api/products";
import { jsonResponse } from "../test/helpers";
import { findCard, orange, press, productsResponse, renderProducts } from "../test/products";

const MORE = "Mostrar mais produtos";
// a API conta os 25 produtos, mesmo mandando só os da página
const COUNTS: MyProductCounts = {
  all: 25,
  available: 21,
  hidden: 4,
  sold_out: 2,
  expiring_soon: 3,
};
const couve: MyProduct = { ...orange, public_id: "produto-2", name: "Couve" };
const FIRST = { page: 1, total: 25, total_pages: 2, counts: COUNTS };
const SECOND = { page: 2, total: 25, total_pages: 2, counts: COUNTS };

function tab(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("MyProducts, pages", () => {
  it("shows the next page below the first one", async () => {
    const fetchMock = renderProducts(
      productsResponse([orange], FIRST),
      productsResponse([couve], SECOND),
    );
    await findCard("Laranja");

    await userEvent.click(screen.getByRole("button", { name: MORE }));

    expect(await screen.findByRole("heading", { name: "Couve" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/me?page=2");
    expect(screen.queryByRole("button", { name: MORE })).not.toBeInTheDocument();
  });

  it("offers no more products on the last page", async () => {
    renderProducts(productsResponse([orange]));
    await findCard("Laranja");

    expect(screen.queryByRole("button", { name: MORE })).not.toBeInTheDocument();
  });

  it("counts the tabs with the API totals, not only the products on screen", async () => {
    renderProducts(productsResponse([orange], FIRST));
    await findCard("Laranja");

    expect(tab(/^Todos/)).toHaveTextContent("Todos25");
    expect(tab(/^Disponíveis/)).toHaveTextContent("Disponíveis21");
    expect(tab(/^Fora do catálogo/)).toHaveTextContent("Fora do catálogo4");
  });

  it("moves a paused product between the tab counts", async () => {
    renderProducts(
      productsResponse([orange], FIRST),
      jsonResponse({ ...orange, is_available: false }),
    );
    const card = await findCard("Laranja");

    await press(card, "Pausar vendas");

    expect(await within(card).findByText("Pausado")).toBeVisible();
    expect(tab(/^Todos/)).toHaveTextContent("Todos25");
    expect(tab(/^Disponíveis/)).toHaveTextContent("Disponíveis20");
    expect(tab(/^Fora do catálogo/)).toHaveTextContent("Fora do catálogo5");
  });

  it("takes a removed product out of the counts", async () => {
    renderProducts(productsResponse([orange], FIRST), new Response(null, { status: 204 }));
    const card = await findCard("Laranja");

    await press(card, "Remover");
    await press(card, "Remover");

    await waitFor(() => expect(card).not.toBeInTheDocument());
    expect(tab(/^Todos/)).toHaveTextContent("Todos24");
    expect(tab(/^Disponíveis/)).toHaveTextContent("Disponíveis20");
  });

  it("shows why the next page failed and asks for it again", async () => {
    const fetchMock = renderProducts(
      productsResponse([orange], FIRST),
      jsonResponse({ detail: "Algo deu errado no servidor" }, 500),
      productsResponse([couve], SECOND),
    );
    await findCard("Laranja");
    await userEvent.click(screen.getByRole("button", { name: MORE }));

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("heading", { name: "Couve" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/products/me?page=2");
  });
});
