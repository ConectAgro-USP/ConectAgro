import { screen, within } from "@testing-library/react";
import type { MyProduct } from "../api/products";
import { findCard, orange, press, productsResponse, renderProducts } from "../test/products";

const HIDDEN = "Compradores não veem este produto";

function product(name: string, changes: Partial<MyProduct>): MyProduct {
  return { ...orange, public_id: name, name, ...changes };
}

describe("MyProducts, state of each product", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<[string, Partial<MyProduct>, string]>([
    ["Laranja", {}, "Disponível"],
    ["Couve", { quantity: 0 }, "Esgotado"],
    ["Alface", { expiration_date: "2026-11-19" }, "Vencido"],
    ["Mandioca", { is_available: false }, "Pausado"],
    ["Milho", { is_available: false, quantity: 0 }, "Pausado"],
  ])("labels %s as %s", async (name, changes, label) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
    renderProducts(productsResponse([product(name, changes)]));

    const card = await findCard(name);

    expect(within(card).getByText(label)).toBeVisible();
  });

  it("tells when buyers cannot see the product", async () => {
    renderProducts(
      productsResponse([product("Laranja", {}), product("Couve", { quantity: 0 })]),
    );

    expect(within(await findCard("Laranja")).queryByText(HIDDEN)).not.toBeInTheDocument();
    expect(within(await findCard("Couve")).getByText(HIDDEN)).toBeVisible();
  });

  it("links the name to the page buyers see", async () => {
    renderProducts(productsResponse([orange]));

    const card = await findCard("Laranja");

    expect(within(card).getByRole("link", { name: "Laranja" })).toHaveAttribute(
      "href",
      "/produtos/produto-1",
    );
  });

  it("focuses Voltar without scrolling when asking to remove", async () => {
    renderProducts(productsResponse([orange]));
    const card = await findCard("Laranja");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");

    await press(card, "Remover");
    const lastFocus = focus.mock.lastCall;
    focus.mockRestore();

    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(lastFocus).toEqual([{ preventScroll: true }]);
    expect(screen.getByRole("button", { name: "Voltar" })).not.toHaveAttribute("autofocus");
  });
});
