import { act } from "@testing-library/react";
import { anaAsBuyer, anaAsFarmer, anaAsManager, fakeAuth } from "../test/helpers";
import { item, MANAGER_CART_KEY, renderCart, storeCart, storedCart } from "../test/cart";
import { CART_LIMIT, cartKeyOf } from "./useCart";

const otherManager = {
  ...anaAsManager,
  apartment: { ...anaAsManager.apartment!, public_id: "outro-predio" },
};

describe("useCart", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the items in the browser after a reload", () => {
    const { result, unmount } = renderCart();
    expect(result.current.items).toEqual([]);

    act(() => void result.current.add(item("produto-1", 2), 10));
    unmount();

    expect(storedCart()).toEqual([item("produto-1", 2)]);
    expect(renderCart().result.current.items).toEqual([item("produto-1", 2)]);
  });

  it("adds to the quantity already there, up to the stock, with the newest price", () => {
    const { result } = renderCart();

    act(() => void result.current.add(item("produto-1", 3), 5));
    act(() => void result.current.add(item("produto-1", 4, "22.00"), 5));

    expect(result.current.items).toEqual([item("produto-1", 5, "22.00")]);
    expect(result.current.quantityOf("produto-1")).toBe(5);
    expect(result.current.quantityOf("produto-2")).toBe(0);
  });

  it("keeps one cart for each manager", () => {
    storeCart([item("produto-1")]);

    const other = renderCart(fakeAuth({ user: otherManager })).result;

    expect(other.current.items).toEqual([]);
    act(() => void other.current.add(item("produto-2"), 5));
    expect(storedCart(cartKeyOf("outro-predio"))).toEqual([item("produto-2")]);
    expect(storedCart()).toEqual([item("produto-1")]);
  });

  it.each([
    ["resident", anaAsBuyer("APROVADO")],
    ["farmer", anaAsFarmer],
  ])("gives the %s no cart", (_profile, user) => {
    const { result } = renderCart(fakeAuth({ user }));

    expect(result.current.enabled).toBe(false);
    act(() => expect(result.current.add(item("produto-1"), 5)).toBe(false));
    expect(localStorage).toHaveLength(0);
  });

  it.each([
    ["text that is not JSON", "{carrinho"],
    ["an object", JSON.stringify({ productPublicId: "produto-1" })],
    ["a zero quantity", JSON.stringify([item("produto-1", 0)])],
    ["a broken quantity", JSON.stringify([item("produto-1", 1.5)])],
    ["a price that is not a number", JSON.stringify([item("produto-1", 1, "caro")])],
    ["a missing product", JSON.stringify([{ quantity: 1, unitPrice: "2.00" }])],
    ["a repeated product", JSON.stringify([item("produto-1"), item("produto-1")])],
  ])("turns %s into an empty cart", (_case, raw) => {
    localStorage.setItem(MANAGER_CART_KEY, raw);

    expect(renderCart().result.current.items).toEqual([]);
  });

  it(`holds at most ${CART_LIMIT} products, the API limit`, () => {
    storeCart(Array.from({ length: CART_LIMIT }, (_, index) => item(`produto-${index}`)));
    const { result } = renderCart();

    act(() => expect(result.current.add(item("produto-novo"), 5)).toBe(false));
    act(() => expect(result.current.add(item("produto-0"), 5)).toBe(true));
    let left = 0;
    act(() => void (left = result.current.put([item("produto-1", 3), item("a"), item("b")])));

    expect(left).toBe(2);
    expect(result.current.items).toHaveLength(CART_LIMIT);
    expect(result.current.quantityOf("produto-0")).toBe(2);
    expect(result.current.quantityOf("produto-1")).toBe(3);
  });

  it("changes, removes and clears the items", () => {
    storeCart([item("produto-1"), item("produto-2")]);
    const { result } = renderCart();

    act(() => result.current.change("produto-1", { quantity: 4, unitPrice: "9.90" }));
    expect(result.current.items).toEqual([item("produto-1", 4, "9.90"), item("produto-2")]);
    act(() => result.current.remove("produto-2"));
    expect(storedCart()).toEqual([item("produto-1", 4, "9.90")]);
    act(() => result.current.clear());

    expect(result.current.items).toEqual([]);
    expect(localStorage.getItem(MANAGER_CART_KEY)).toBeNull();
  });
});
