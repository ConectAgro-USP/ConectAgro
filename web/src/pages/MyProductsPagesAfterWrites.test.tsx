import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MyProduct } from "../api/products";
import { jsonResponse } from "../test/helpers";
import { findCard, orange, press, productsResponse, renderProducts } from "../test/products";

const MORE = { name: "Mostrar mais produtos" };
const couve: MyProduct = { ...orange, public_id: "produto-2", name: "Couve" };
const milho: MyProduct = { ...orange, public_id: "produto-3", name: "Milho" };
const batata: MyProduct = { ...orange, public_id: "produto-4", name: "Batata" };
// 22 produtos em duas páginas, que viram 21 depois da escrita
const BEFORE = { total: 22, total_pages: 2 };
const AFTER = { total: 21, total_pages: 2 };

function showMore() {
  return userEvent.click(screen.getByRole("button", MORE));
}

describe("MyProducts, pages after a write", () => {
  it("asks for the first page again after a removal, so no product is skipped", async () => {
    const fetchMock = renderProducts(
      productsResponse([orange, couve], BEFORE),
      new Response(null, { status: 204 }),
      productsResponse([couve, milho], AFTER),
      productsResponse([batata], { ...AFTER, page: 2 }),
    );
    const card = await findCard("Laranja");
    await press(card, "Remover");
    await press(card, "Remover");
    await waitFor(() => expect(card).not.toBeInTheDocument());

    await showMore();

    expect(await findCard("Milho")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Couve" })).toHaveLength(1);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/products/me?page=1");
    await showMore();
    expect(await findCard("Batata")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe("/api/products/me?page=2");
  });

  it("asks for the page again after a product leaves a filtered tab", async () => {
    const fetchMock = renderProducts(
      productsResponse([orange, couve], BEFORE),
      productsResponse([orange, couve], BEFORE),
      jsonResponse({ ...orange, is_available: false }),
      productsResponse([couve, milho], { ...AFTER, total_pages: 1 }),
    );
    await findCard("Laranja");
    await userEvent.click(screen.getByRole("button", { name: /^Disponíveis/ }));
    const card = await findCard("Laranja");
    await press(card, "Pausar vendas");
    await waitFor(() => expect(card).not.toBeInTheDocument());

    await showMore();

    expect(await findCard("Milho")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe(fetchMock.mock.calls[1][0]);
    expect(screen.queryByRole("button", MORE)).not.toBeInTheDocument();
  });

  it("goes on to the next page when nothing left the list", async () => {
    const fetchMock = renderProducts(
      productsResponse([orange], BEFORE),
      jsonResponse({ ...orange, is_available: false }),
      productsResponse([couve], { ...BEFORE, page: 2 }),
    );
    const card = await findCard("Laranja");
    await press(card, "Pausar vendas");
    await within(card).findByText("Pausado");

    await showMore();

    expect(await findCard("Couve")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/products/me?page=2");
  });
});
