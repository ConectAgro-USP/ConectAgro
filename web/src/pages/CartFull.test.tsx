import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CART_FULL, CART_LIMIT } from "../hooks/useCart";
import { item, MANAGER_CART_KEY, storeCart, storedCart } from "../test/cart";
import { findQuantity, inCart, LARANJA, productsOf, renderCartPage } from "../test/cartPage";

describe("Cart, full", () => {
  beforeEach(() => localStorage.clear());

  it("says the cart is full when a removed product cannot come back", async () => {
    const { fetchMock } = renderCartPage([inCart(LARANJA, 2)], ...productsOf(LARANJA));
    // os produtos que chegam de outra aba ficam esperando a conferência
    fetchMock.mockImplementation(() => new Promise(() => {}));
    await findQuantity("Laranja");
    await userEvent.click(screen.getByRole("button", { name: "Remover Laranja" }));
    const full = Array.from({ length: CART_LIMIT }, (_, n) => item(`outro-${n}`));
    storeCart(full);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: MANAGER_CART_KEY }));
    });

    const removed = screen.getByText("Laranja saiu do carrinho").closest("li")!;
    await userEvent.click(within(removed).getByRole("button", { name: /^Desfazer/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(CART_FULL);
    expect(CART_FULL).toContain(String(CART_LIMIT));
    expect(storedCart()).toEqual(full);
  });
});
