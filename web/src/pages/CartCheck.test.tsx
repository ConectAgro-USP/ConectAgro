import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { storedCart } from "../test/cart";
import {
  ALFACE,
  findQuantity,
  inCart,
  LARANJA,
  lineOf,
  MANDIOCA,
  productsOf,
  renderCartPage,
} from "../test/cartPage";
import { jsonResponse } from "../test/helpers";

const SERVER_ERROR = "Algo deu errado no servidor. Tente novamente mais tarde";
const GONE = jsonResponse({ detail: "Produto não encontrado" }, 404);

describe("Cart check", () => {
  beforeEach(() => localStorage.clear());

  it("uses the new price and shows the old one next to it", async () => {
    const pricier = { ...MANDIOCA, price: "22.00" };
    renderCartPage([inCart(MANDIOCA, 2)], ...productsOf(pricier));

    const quantity = await findQuantity("Mandioca");

    expect(quantity).toHaveAccessibleDescription(/O preço mudou de R\$\s20,00 para R\$\s22,00/);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 44,00/);
    expect(storedCart()).toEqual([{ ...inCart(MANDIOCA, 2), unitPrice: "22.00" }]);
  });

  it("brings the quantity down to the stock", async () => {
    renderCartPage([inCart(ALFACE, 9)], ...productsOf(ALFACE));

    const quantity = await findQuantity("Alface");

    expect(quantity).toHaveValue(4);
    expect(quantity).toHaveAttribute("max", "4");
    expect(quantity).toHaveAccessibleDescription(/Você tinha pedido 9 kg/);
    expect(storedCart()).toEqual([inCart(ALFACE, 4)]);
  });

  it.each([
    ["sold out", { ...ALFACE, quantity: 0 }, "Sem estoque"],
    ["expired", { ...ALFACE, expiration_date: "2020-01-01" }, "Venceu"],
    ["paused", { ...ALFACE, is_available: false }, "O agricultor pausou a venda"],
  ])("keeps a %s product out of the purchase", async (_case, product, reason) => {
    renderCartPage([inCart(MANDIOCA, 1), inCart(ALFACE, 2)], ...productsOf(MANDIOCA, product));
    await findQuantity("Mandioca");

    expect(lineOf("Alface")).toHaveTextContent(`${reason}, fica fora da compra`);
    expect(screen.queryByLabelText("Quantidade de Alface em kg")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Total\s*R\$ 20,00/);
    await userEvent.click(screen.getByRole("button", { name: "Remover Alface" }));
    expect(storedCart()).toEqual([inCart(MANDIOCA, 1)]);
  });

  it("takes out the products that left the catalog and says so", async () => {
    renderCartPage([inCart(MANDIOCA, 1), inCart(LARANJA, 1)], GONE, ...productsOf(LARANJA));

    await findQuantity("Laranja");

    expect(screen.getByText("1 produto saiu do catálogo e foi tirado do carrinho")).toBeVisible();
    expect(storedCart()).toEqual([inCart(LARANJA, 1)]);
  });

  it("shows the empty cart when every product left the catalog", async () => {
    renderCartPage([inCart(MANDIOCA, 1)], GONE);

    expect(await screen.findByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    expect(screen.getByText(/1 produto saiu do catálogo/)).toBeVisible();
  });

  it("says why the products could not be checked and tries again", async () => {
    renderCartPage(
      [inCart(MANDIOCA, 1)],
      jsonResponse({ detail: SERVER_ERROR }, 500),
      jsonResponse(MANDIOCA),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(SERVER_ERROR);
    expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await findQuantity("Mandioca")).toHaveValue(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([401, 403])("reloads the user when the API answers %i", async (status) => {
    const { auth } = renderCartPage(
      [inCart(MANDIOCA, 1)],
      jsonResponse({ detail: "Sem acesso" }, status),
    );

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });
});
