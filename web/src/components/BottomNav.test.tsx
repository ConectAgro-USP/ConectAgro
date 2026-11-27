import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProfileType } from "../api/profiles";
import { fakeAuth, renderWithAuth } from "../test/helpers";
import { BottomNav } from "./BottomNav";

function barItems(): string[] {
  const bar = screen.getByRole("navigation", { name: "Menu principal" });
  return within(bar)
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

async function openMore() {
  await userEvent.click(screen.getByRole("button", { name: "Mais" }));
}

describe("BottomNav", () => {
  it.each<[ProfileType, string[]]>([
    ["farmer", ["Início", "Produtos", "Vendas", "Avaliações", "Mais"]],
    ["apartment", ["Início", "Necessidades", "Compras", "Mais"]],
    ["buyer", ["Início", "Agricultores", "Interesses", "Avaliações", "Mais"]],
  ])("shows the %s profile its destinations with visible labels", (profileType, labels) => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType }));

    expect(barItems()).toEqual(labels);
  });

  it("links each destination to its page", () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "farmer" }));

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Produtos" })).toHaveAttribute("href", "/meus-produtos");
    expect(screen.getByRole("link", { name: "Vendas" })).toHaveAttribute("href", "/vendas");
    expect(screen.getByRole("link", { name: "Avaliações" })).toHaveAttribute("href", "/avaliacoes");
  });

  it("marks the current page", () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "farmer" }), "/vendas");

    expect(screen.getByRole("link", { name: "Vendas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the rest of the manager pages, the profile and the logout in Mais", async () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "apartment" }));

    await openMore();

    const panel = screen.getByRole("link", { name: "Moradores" }).closest("ul")!;
    const items = within(panel).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["Moradores", "Agricultores", "Avaliações", "Perfil", "Sair"]);
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
  });

  it("gives the farmer only the profile and the logout in Mais", async () => {
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "farmer" }));

    await openMore();

    expect(screen.getByRole("link", { name: "Perfil" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sair" })).toBeVisible();
  });

  it("logs out from Mais", async () => {
    const auth = fakeAuth({ profileType: "buyer" });
    renderWithAuth(<BottomNav />, auth);

    await openMore();
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it("shows in Mais why the logout failed", async () => {
    const logout = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithAuth(<BottomNav />, fakeAuth({ profileType: "buyer", logout }));

    await openMore();
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
    expect(screen.getByRole("button", { name: "Sair" })).toBeVisible();
  });
});
