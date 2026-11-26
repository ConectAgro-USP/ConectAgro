import { act } from "@testing-library/react";
import { item, MANAGER_CART_KEY, renderCart, storeCart } from "../test/cart";

describe("useCart sync", () => {
  beforeEach(() => localStorage.clear());

  it("updates every part of the page that shows the cart", () => {
    const header = renderCart().result;
    const page = renderCart().result;

    act(() => void page.current.add(item("produto-1", 2), 10));

    expect(header.current.items).toEqual([item("produto-1", 2)]);
    expect(header.current.items).toBe(page.current.items);
  });

  it("follows the cart changed in another tab", () => {
    const { result } = renderCart();
    storeCart([item("produto-1", 3)]);

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: MANAGER_CART_KEY }));
    });

    expect(result.current.items).toEqual([item("produto-1", 3)]);
  });

  it("ignores other keys changed in another tab", () => {
    const { result } = renderCart();
    const before = result.current.items;
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "outra-chave" }));
    });

    // o carrinho igual não muda a tela, então só a leitura mostra o aviso
    expect(getItem).not.toHaveBeenCalled();
    expect(result.current.items).toBe(before);
    getItem.mockRestore();
  });

  it("keeps the cart in the tab when the browser refuses to save it", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });
    const { result } = renderCart();

    act(() => void result.current.add(item("produto-1", 2), 10));

    expect(result.current.items).toEqual([item("produto-1", 2)]);
    setItem.mockRestore();
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });

  it("starts empty when the browser does not let the page read", () => {
    storeCart([item("produto-1")]);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });

    expect(renderCart().result.current.items).toEqual([]);
    getItem.mockRestore();
  });
});
