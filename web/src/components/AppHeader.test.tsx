import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProfileType } from "../api/profiles";
import { fakeAuth, renderWithAuth } from "../test/helpers";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("links to the home and to the profile", () => {
    renderWithAuth(<AppHeader />, fakeAuth());

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
  });

  it.each<[ProfileType, string[]]>([
    ["farmer", ["Início", "Produtos", "Vendas", "Avaliações"]],
    ["apartment", ["Início", "Necessidades", "Compras", "Moradores", "Agricultores", "Avaliações"]],
    ["buyer", ["Início", "Agricultores", "Interesses", "Avaliações"]],
  ])("shows the %s profile its page links with short labels", (profileType, labels) => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType }));

    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    const items = within(nav).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(labels);
  });

  it("marks the current page link", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "apartment" }), "/necessidades");

    const link = screen.getByRole("link", { name: "Necessidades" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the profile and the logout outside the page links", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "farmer" }));

    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(nav).queryByText("Perfil")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toHaveTextContent("Sair");
  });

  it.each(["farmer", "apartment", "buyer"] as const)(
    "shows no disabled control to the %s profile",
    (profileType) => {
      const { container } = renderWithAuth(<AppHeader />, fakeAuth({ profileType }));

      expect(container.querySelectorAll(":disabled")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: "Carrinho" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Notificações" })).not.toBeInTheDocument();
    },
  );

  it("logs out", async () => {
    const auth = fakeAuth();
    renderWithAuth(<AppHeader />, auth);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it("shows why the logout failed", async () => {
    const logout = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithAuth(<AppHeader />, fakeAuth({ logout }));

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
  });
});
