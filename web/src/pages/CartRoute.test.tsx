import { screen } from "@testing-library/react";
import App from "../App";
import type { ProfileRead } from "../api/profiles";
import {
  anaAsBuyer,
  anaAsFarmer,
  anaAsManager,
  fakeAuth,
  renderWithAuth,
  stubSilentApi,
} from "../test/helpers";

describe("Cart route", () => {
  beforeEach(() => localStorage.clear());

  it("opens the cart for the manager, with its own title", () => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: anaAsManager }), "/carrinho");

    expect(screen.getByRole("heading", { level: 1, name: "Carrinho" })).toBeVisible();
    expect(document.title).toBe("Carrinho · ConectAgro");
  });

  it.each<[string, ProfileRead]>([
    ["resident", anaAsBuyer("APROVADO")],
    ["farmer", anaAsFarmer],
  ])("keeps the %s out of the cart", (_profile, user) => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user }), "/carrinho");

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta página" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Carrinho" })).not.toBeInTheDocument();
  });
});
