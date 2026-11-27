import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import {
  countsOf,
  findCard,
  orange,
  press,
  productsResponse,
  renderProducts,
} from "../test/products";

const paused = { ...orange, is_available: false };
const soldOut = { ...orange, public_id: "produto-2", name: "Couve", quantity: 0 };

function tab(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("MyProducts, pausing and the tabs", () => {
  it("pauses the sales of a product", async () => {
    const fetchMock = renderProducts(productsResponse([orange]), jsonResponse(paused));
    const card = await findCard("Laranja");

    await press(card, "Pausar vendas");

    expect(await within(card).findByText("Pausado")).toBeVisible();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/produto-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({ is_available: false });
    expect(within(card).getByRole("button", { name: "Retomar vendas" })).toBeEnabled();
  });

  it("resumes the sales of a paused product", async () => {
    const fetchMock = renderProducts(productsResponse([paused]), jsonResponse(orange));
    const card = await findCard("Laranja");

    await press(card, "Retomar vendas");

    expect(await within(card).findByText("Disponível")).toBeVisible();
    expect(sentBody(fetchMock, 1)).toEqual({ is_available: true });
  });

  it("blocks the buttons while the change is on its way", async () => {
    const fetchMock = renderProducts(productsResponse([orange]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const card = await findCard("Laranja");

    await press(card, "Pausar vendas");
    await press(card, "Pausar vendas");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(within(card).getByRole("button", { name: "Remover" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Editar" })).toBeDisabled();
  });

  it("shows why the change was refused and keeps the product as it was", async () => {
    const refusal = jsonResponse({ detail: "Produto não encontrado" }, 404);
    renderProducts(productsResponse([orange]), refusal);
    const card = await findCard("Laranja");

    await press(card, "Pausar vendas");

    expect(await within(card).findByRole("alert")).toHaveTextContent("Produto não encontrado");
    expect(within(card).getByText("Disponível")).toBeVisible();
    await waitFor(() =>
      expect(within(card).getByRole("button", { name: "Pausar vendas" })).toBeEnabled(),
    );
  });

  it("counts the products of each tab", async () => {
    renderProducts(productsResponse([orange, soldOut]));
    await findCard("Laranja");

    expect(tab(/^Todos/)).toHaveTextContent("Todos2");
    expect(tab(/^Disponíveis/)).toHaveTextContent("Disponíveis1");
    expect(tab(/^Fora do catálogo/)).toHaveTextContent("Fora do catálogo1");
    expect(tab(/^Todos/)).toHaveAttribute("aria-pressed", "true");
  });

  it("asks the API for the products of each tab", async () => {
    const counts = countsOf([orange, soldOut]);
    const fetchMock = renderProducts(
      productsResponse([orange, soldOut]),
      productsResponse([soldOut], { counts }),
      productsResponse([orange], { counts }),
    );
    await findCard("Laranja");

    await userEvent.click(tab(/^Fora do catálogo/));

    expect(tab(/^Fora do catálogo/)).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", { name: "Couve" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Laranja" })).not.toBeInTheDocument();

    await userEvent.click(tab(/^Disponíveis/));

    expect(await screen.findByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Couve" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/products/me?page=1",
      "/api/products/me?page=1&availability=hidden",
      "/api/products/me?page=1&availability=available",
    ]);
  });

  it("says when a tab has no products", async () => {
    const counts = countsOf([orange]);
    renderProducts(productsResponse([orange]), productsResponse([], { counts }));
    await findCard("Laranja");

    await userEvent.click(tab(/^Fora do catálogo/));

    expect(await screen.findByText("Todos os seus produtos estão à venda.")).toBeVisible();
  });
});
