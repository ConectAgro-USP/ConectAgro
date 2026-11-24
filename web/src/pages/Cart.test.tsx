import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { storedCart } from "../test/cart";
import {
  ALFACE,
  findQuantity,
  groupOf,
  inCart,
  JOAO,
  LARANJA,
  lineOf,
  MANDIOCA,
  productsOf,
  quantityOf,
  renderCartPage,
} from "../test/cartPage";

const THREE = [inCart(MANDIOCA, 12), inCart(ALFACE, 4), inCart(LARANJA, 1)];

describe("Cart", () => {
  beforeEach(() => localStorage.clear());

  it("groups the products by farmer, with subtotals and the total", async () => {
    const { fetchMock } = renderCartPage(THREE, ...productsOf(MANDIOCA, ALFACE, LARANJA));

    expect(await findQuantity("Mandioca")).toHaveValue(12);
    const joao = groupOf(JOAO);
    expect(lineOf("Mandioca")).toHaveTextContent(/Mandioca\s*R\$ 240,00\s*kg × R\$ 20,00/);
    expect(quantityOf("Alface", joao)).toHaveValue(4);
    expect(quantityOf("Alface")).toHaveAccessibleDescription("4 kg disponíveis");
    expect(joao).toHaveTextContent(/Subtotal\s*R\$ 254,00/);
    const maria = groupOf("Maria F.");
    expect(quantityOf("Laranja", maria)).toHaveValue(1);
    expect(maria).not.toHaveTextContent("Subtotal");
    expect(document.body).toHaveTextContent(/Total\s*R\$ 258,50/);
    expect(screen.getByRole("link", { name: "Mandioca" })).toHaveAttribute(
      "href",
      "/produtos/produto-1",
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/products/produto-1",
      "/api/products/produto-2",
      "/api/products/produto-3",
    ]);
  });

  it("updates the totals and the saved cart as the quantities change", async () => {
    renderCartPage(THREE, ...productsOf(MANDIOCA, ALFACE, LARANJA));

    await userEvent.clear(await findQuantity("Mandioca"));
    expect(groupOf(JOAO)).toHaveTextContent(/Subtotal\s*R\$ 14,00/);
    await userEvent.type(quantityOf("Mandioca"), "10");

    expect(groupOf(JOAO)).toHaveTextContent(/Subtotal\s*R\$ 214,00/);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 218,50/);
    expect(storedCart()).toContainEqual(inCart(MANDIOCA, 10));
  });

  it("removes a product and leaves a way to bring it back in its place", async () => {
    renderCartPage(THREE, ...productsOf(MANDIOCA, ALFACE, LARANJA));
    await findQuantity("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Remover Mandioca" }));

    const removed = screen.getByText("Mandioca saiu do carrinho").closest("li")!;
    expect(groupOf(JOAO).querySelector("li")).toBe(removed);
    expect(storedCart()).toEqual([inCart(ALFACE, 4), inCart(LARANJA, 1)]);
    expect(groupOf(JOAO)).not.toHaveTextContent("Subtotal");
    expect(document.body).toHaveTextContent(/Total\s*R\$ 18,50/);
    await userEvent.click(within(removed).getByRole("button", { name: /^Desfazer/ }));

    expect(quantityOf("Mandioca")).toHaveValue(12);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 258,50/);
  });

  it("shows an empty cart with a link to the catalog", async () => {
    const { fetchMock } = renderCartPage([]);

    expect(screen.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    expect(screen.getByText("Escolha produtos no catálogo e eles aparecem aqui.")).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: "Ver os produtos" }));

    expect(screen.getByRole("heading", { name: "Produtos" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the removed line after the last product leaves", async () => {
    renderCartPage([inCart(LARANJA, 2)], ...productsOf(LARANJA));
    await findQuantity("Laranja");

    await userEvent.click(screen.getByRole("button", { name: "Remover Laranja" }));

    expect(screen.getByText("Laranja saiu do carrinho")).toBeVisible();
    expect(screen.getByText("Nenhum produto do carrinho pode ser comprado agora.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
  });
});
