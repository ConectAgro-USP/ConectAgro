import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import type { ProfileRead } from "../api/profiles";
import { item, MANAGER_CART_KEY, storeCart } from "../test/cart";
import { anaAsBuyer, anaAsFarmer, anaAsManager, fakeAuth, renderWithAuth } from "../test/helpers";
import { AppHeader } from "./AppHeader";

function renderHeader(user: ProfileRead = anaAsManager, url = "/") {
  renderWithAuth(
    <>
      <AppHeader />
      <Routes>
        <Route path="/carrinho" element={<h1>Página do carrinho</h1>} />
        <Route path="*" element={null} />
      </Routes>
    </>,
    fakeAuth({ user }),
    url,
  );
}

describe("CartLink", () => {
  beforeEach(() => localStorage.clear());

  it("shows the manager how many products are in the cart and opens it", async () => {
    storeCart([item("produto-1", 5), item("produto-2"), item("produto-3")]);
    renderHeader();

    const link = screen.getByRole("link", { name: "Carrinho, 3 itens" });
    expect(link).toHaveTextContent("3");
    await userEvent.click(link);

    expect(screen.getByRole("heading", { name: "Página do carrinho" })).toBeInTheDocument();
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("counts an empty cart and a cart with one product", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Carrinho, 0 itens" })).toBeVisible();

    act(() => {
      storeCart([item("produto-1", 4)]);
      window.dispatchEvent(new StorageEvent("storage", { key: MANAGER_CART_KEY }));
    });

    expect(screen.getByRole("link", { name: "Carrinho, 1 item" })).toBeVisible();
  });

  it("stays outside the page links", () => {
    renderHeader();

    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(nav).not.toContainElement(screen.getByRole("link", { name: /^Carrinho/ }));
  });

  it.each<[string, ProfileRead]>([
    ["resident", anaAsBuyer("APROVADO")],
    ["farmer", anaAsFarmer],
  ])("is never shown to the %s", (_profile, user) => {
    storeCart([item("produto-1")]);
    renderHeader(user);

    expect(screen.queryByRole("link", { name: /Carrinho/ })).not.toBeInTheDocument();
  });
});
