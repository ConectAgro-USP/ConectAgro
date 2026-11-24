import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALFACE,
  fillDeliveryDate,
  findQuantity,
  inCart,
  MANDIOCA,
  productsOf,
  renderCartPage,
} from "../test/cartPage";
import { jsonResponse, sentBody } from "../test/helpers";

const PAUSED_ALFACE = { ...ALFACE, is_available: false };
const SOLD_OUT_ALFACE = { ...ALFACE, quantity: 0 };

async function confirm() {
  fillDeliveryDate("2026-12-01");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
}

describe("Cart submit with a product that came back", () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ["paused", PAUSED_ALFACE],
    ["sold out", SOLD_OUT_ALFACE],
  ])("asks again when a %s product can be bought again", async (_case, blocked) => {
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 2), inCart(ALFACE, 2)],
      ...productsOf(MANDIOCA, blocked, MANDIOCA, ALFACE),
    );
    await findQuantity("Mandioca");
    expect(document.body).toHaveTextContent(/Total\s*R\$ 40,00/);

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Os produtos mudaram/);
    expect(await findQuantity("Alface")).toHaveValue(2);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 47,00/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("buys the product that came back after the new confirmation", async () => {
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 2), inCart(ALFACE, 2)],
      ...productsOf(MANDIOCA, PAUSED_ALFACE, MANDIOCA, ALFACE, MANDIOCA, ALFACE),
      jsonResponse({ public_id: "compra-1" }, 201),
    );
    await findQuantity("Mandioca");
    await confirm();
    await findQuantity("Alface");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeVisible();
    expect(sentBody(fetchMock, 6)).toEqual({
      expected_delivery_date: "2026-12-01",
      items: [
        { product_public_id: "produto-1", quantity: 2, unit_price: "20.00", unit: "kg" },
        { product_public_id: "produto-2", quantity: 2, unit_price: "3.50", unit: "kg" },
      ],
    });
  });
});
