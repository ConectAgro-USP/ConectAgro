import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MANAGER_CART_KEY, storeCart } from "../test/cart";
import {
  fillDeliveryDate,
  findQuantity,
  inCart,
  LARANJA,
  MANDIOCA,
  productsOf,
  renderCartPage,
} from "../test/cartPage";

const CHANGED = "Os produtos mudaram desde que você abriu o carrinho. Confira e confirme de novo.";

describe("Cart, an item the page never showed", () => {
  beforeEach(() => localStorage.clear());

  it("asks to confirm again instead of buying it", async () => {
    const { fetchMock } = renderCartPage([inCart(MANDIOCA, 2)], ...productsOf(MANDIOCA));
    await findQuantity("Mandioca");
    // a laranja chega de outra aba, e a conferência dela falha
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(productsOf(LARANJA)[0]);
    storeCart([inCart(MANDIOCA, 2), inCart(LARANJA, 3)]);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: MANAGER_CART_KEY }));
    });
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Laranja" })).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(productsOf(MANDIOCA)[0]);
    fetchMock.mockResolvedValueOnce(productsOf(LARANJA)[0]);

    fillDeliveryDate("2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByText(CHANGED)).toBeVisible();
    expect(screen.getByRole("link", { name: "Laranja" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/purchases");
  });
});
