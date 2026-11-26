import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { storedCart } from "../test/cart";
import {
  fillDeliveryDate,
  findQuantity,
  inCart,
  lineOf,
  MANDIOCA,
  productsOf,
  renderCartPage,
} from "../test/cartPage";
import { jsonResponse, sentBody } from "../test/helpers";

describe("Cart, quantity typed with a decimal point", () => {
  beforeEach(() => localStorage.clear());

  it("buys the quantity the page shows", async () => {
    const { fetchMock } = renderCartPage(
      [inCart(MANDIOCA, 12)],
      ...productsOf(MANDIOCA, MANDIOCA),
      jsonResponse({ public_id: "compra-1" }, 201),
    );

    // o campo de número aceita o texto colado por cima do 12
    fireEvent.change(await findQuantity("Mandioca"), { target: { value: "2.0" } });
    fillDeliveryDate("2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeVisible();
    expect(sentBody(fetchMock, 2)).toMatchObject({ items: [{ quantity: 2 }] });
  });

  it("shows and keeps the same quantity", async () => {
    renderCartPage([inCart(MANDIOCA, 12)], ...productsOf(MANDIOCA));

    const field = await findQuantity("Mandioca");
    fireEvent.change(field, { target: { value: "2.0" } });

    expect(field).toHaveValue(2);
    expect(lineOf("Mandioca")).toHaveTextContent(/Mandioca\s*R\$ 40,00\s*kg × R\$ 20,00/);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 40,00/);
    expect(storedCart()).toEqual([inCart(MANDIOCA, 2)]);
  });
});
