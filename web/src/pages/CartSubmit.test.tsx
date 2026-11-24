import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { storedCart } from "../test/cart";
import {
  ALFACE,
  fillDeliveryDate,
  findQuantity,
  inCart,
  LARANJA,
  MANDIOCA,
  productsOf,
  renderCartPage,
} from "../test/cartPage";
import { jsonResponse, sentBody } from "../test/helpers";

const PRICE_CHANGED = "O preço do produto Mandioca mudou, confira o resumo da compra";
const SHORT = "O produto Mandioca não tem a quantidade pedida";
const PAST_DATE = {
  detail: [
    {
      type: "value_error",
      loc: ["body", "expected_delivery_date"],
      msg: "A data prevista de entrega não pode estar no passado",
    },
  ],
};
const SOLD_OUT_ALFACE = { ...ALFACE, quantity: 0 };

async function confirm(date = "2026-12-01") {
  fillDeliveryDate(date);
  await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
}

describe("Cart submit", () => {
  beforeEach(() => localStorage.clear());

  it("buys what can be bought, empties the cart and opens the purchases", async () => {
    const opened = productsOf(MANDIOCA, SOLD_OUT_ALFACE, LARANJA);
    const checked = productsOf(MANDIOCA, SOLD_OUT_ALFACE, LARANJA);
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 12), inCart(ALFACE, 2), inCart(LARANJA, 1)],
      ...opened,
      ...checked,
      jsonResponse({ public_id: "compra-1" }, 201),
    );
    await findQuantity("Mandioca");

    await confirm();

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeVisible();
    expect(fetchMock.mock.calls[6][0]).toBe("/api/purchases");
    expect(fetchMock.mock.calls[6][1]?.method).toBe("POST");
    expect(sentBody(fetchMock, 6)).toEqual({
      expected_delivery_date: "2026-12-01",
      items: [
        { product_public_id: "produto-1", quantity: 12, unit_price: "20.00" },
        { product_public_id: "produto-3", quantity: 1, unit_price: "4.50" },
      ],
    });
    expect(storedCart()).toBeNull();
  });

  it("waits for the delivery date before sending", async () => {
    const { fetchMock } = renderCartPage([inCart(MANDIOCA, 1)], ...productsOf(MANDIOCA));
    await findQuantity("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(screen.getByLabelText("Entrega prevista")).toBeInvalid();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("stops and shows what changed since the cart was opened", async () => {
    const pricier = { ...MANDIOCA, price: "22.00" };
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 2)],
      ...productsOf(MANDIOCA, pricier),
    );
    await findQuantity("Mandioca");

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Os produtos mudaram/);
    expect(screen.getByText(/O preço mudou de/)).toBeVisible();
    expect(document.body).toHaveTextContent(/Total\s*R\$ 44,00/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["the price changed", jsonResponse({ detail: PRICE_CHANGED }, 409), PRICE_CHANGED],
    ["the stock is short", jsonResponse({ detail: SHORT }, 409), SHORT],
    ["the date is past", jsonResponse(PAST_DATE, 422), PAST_DATE.detail[0].msg],
  ])("shows the API message when %s and checks again", async (_case, refusal, message) => {
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 2)],
      ...productsOf(MANDIOCA, MANDIOCA),
      refusal,
      ...productsOf(MANDIOCA),
    );
    await findQuantity("Mandioca");

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/products/produto-1");
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
    expect(storedCart()).toEqual([inCart(MANDIOCA, 2)]);
  });

  it("keeps the refusal on the form when the refused product leaves the catalog", async () => {
    renderCartPage(
      [inCart(MANDIOCA, 2), inCart(LARANJA, 1)],
      ...productsOf(MANDIOCA, LARANJA, MANDIOCA, LARANJA),
      jsonResponse({ detail: SHORT }, 409),
      jsonResponse({ detail: "Produto não encontrado" }, 404),
      ...productsOf(LARANJA),
    );
    await findQuantity("Mandioca");

    await confirm();

    expect(await screen.findByText(/1 produto saiu do catálogo/)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(SHORT);
    expect(storedCart()).toEqual([inCart(LARANJA, 1)]);
  });

  it("sends the purchase only once while it is on its way", async () => {
    const { fetchMock } = renderCartPage([inCart(MANDIOCA, 1)], ...productsOf(MANDIOCA, MANDIOCA));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    await findQuantity("Mandioca");
    await confirm();

    await userEvent.click(screen.getByRole("button", { name: "Confirmando..." }));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Confirmando..." })).toBeDisabled();
  });
});
