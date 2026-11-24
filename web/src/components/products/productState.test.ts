import { problemOf } from "../../pages/cart/useCartCheck";
import { orange } from "../../test/products";
import { stateOf } from "./productState";

const PAST = "2020-01-01";

describe("stateOf", () => {
  it.each([
    ["available", {}],
    ["paused", { is_available: false }],
    ["expired", { expiration_date: PAST }],
    ["soldOut", { quantity: 0 }],
    ["soldOut", { quantity: -1 }],
    ["paused", { is_available: false, expiration_date: PAST, quantity: 0 }],
    ["expired", { expiration_date: PAST, quantity: 0 }],
  ])("says %s for %o", (state, changes) => {
    expect(stateOf({ ...orange, ...changes })).toBe(state);
  });

  it("gives the cart the same problem, and none for a product to buy", () => {
    const farmer = { public_id: "agricultor-1", farm_name: null, short_name: "Ana" };
    const product = { ...orange, farmer: { ...farmer, picture_url: null } };

    expect(problemOf(product)).toBeNull();
    expect(problemOf({ ...product, quantity: 0 })).toBe("soldOut");
    expect(problemOf({ ...product, is_available: false })).toBe("paused");
  });
});
