import { screen } from "@testing-library/react";
import { storedCart } from "../test/cart";
import {
  confirm,
  findQuantity,
  inCart,
  MANDIOCA,
  productsOf,
  renderCartPage,
} from "../test/cartPage";
import { jsonResponse, sentBody } from "../test/helpers";

const BY_DOZEN = { ...MANDIOCA, unit: "duzia" as const };
const UNIT_NOTE = "A unidade mudou de quilo para dúzia";
const UNIT_CHANGED = "A unidade do produto Mandioca mudou. Confira o carrinho antes de confirmar";
const IN_DOZENS = { name: "Quantidade de Mandioca em dúzias" };

describe("Cart, product unit", () => {
  beforeEach(() => localStorage.clear());

  it("uses the new unit and says which one it was", async () => {
    renderCartPage([inCart(MANDIOCA, 2)], ...productsOf(BY_DOZEN));

    const quantity = await screen.findByRole("spinbutton", IN_DOZENS);

    expect(quantity).toHaveAccessibleDescription(new RegExp(UNIT_NOTE));
    expect(storedCart()).toEqual([{ ...inCart(MANDIOCA, 2), unit: "duzia" }]);
  });

  it("asks to confirm again when the unit changed, then sends the new one", async () => {
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 2)],
      ...productsOf(MANDIOCA, BY_DOZEN, BY_DOZEN),
      jsonResponse({ public_id: "compra-1" }, 201),
    );
    await findQuantity("Mandioca");

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Os produtos mudaram/);
    expect(screen.getByText(UNIT_NOTE)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await confirm();

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeVisible();
    expect(sentBody(fetchMock, 3)).toEqual({
      expected_delivery_date: "2026-12-01",
      items: [{ product_public_id: "produto-1", quantity: 2, unit_price: "20.00", unit: "duzia" }],
    });
  });

  it("shows the API message when the unit changed and checks again", async () => {
    renderCartPage(
      [inCart(MANDIOCA, 2)],
      ...productsOf(MANDIOCA, MANDIOCA),
      jsonResponse({ detail: UNIT_CHANGED }, 409),
      ...productsOf(BY_DOZEN),
    );
    await findQuantity("Mandioca");

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(UNIT_CHANGED);
    expect(await screen.findByText(UNIT_NOTE)).toBeVisible();
    expect(screen.getByRole("spinbutton", IN_DOZENS)).toBeVisible();
  });

  it("keeps an older cart without the unit and stores the one shown", async () => {
    const { productPublicId, quantity, unitPrice } = inCart(MANDIOCA, 2);
    renderCartPage([{ productPublicId, quantity, unitPrice }], ...productsOf(MANDIOCA));

    await findQuantity("Mandioca");

    expect(screen.queryByText(/A unidade mudou/)).not.toBeInTheDocument();
    expect(storedCart()).toEqual([inCart(MANDIOCA, 2)]);
  });
});
