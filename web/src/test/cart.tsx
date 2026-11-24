import { renderHook } from "@testing-library/react";
import { cartKeyOf, useCart, type CartItem } from "../hooks/useCart";
import { anaAsManager, fakeAuth, villageVilaVerde, withAuth } from "./helpers";

export const MANAGER_CART_KEY = cartKeyOf(villageVilaVerde.public_id);

export function storeCart(items: CartItem[], key = MANAGER_CART_KEY) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function storedCart(key = MANAGER_CART_KEY): unknown {
  return JSON.parse(localStorage.getItem(key) ?? "null");
}

export function item(productPublicId: string, quantity = 1, unitPrice = "20.00"): CartItem {
  return { productPublicId, quantity, unitPrice };
}

export function renderCart(auth = fakeAuth({ user: anaAsManager })) {
  return renderHook(() => useCart(), { wrapper: withAuth(auth) });
}
