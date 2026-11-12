import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeAuth, renderWithAuth } from "../test/helpers";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("links to the home and to the profile", () => {
    renderWithAuth(<AppHeader />, fakeAuth());

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
  });

  it("links the manager to the purchases of the building", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "apartment" }));

    const link = screen.getByRole("link", { name: "Compras do prédio" });
    expect(link).toHaveAttribute("href", "/compras");
  });

  it("links the manager to the residents", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "apartment" }));

    expect(screen.getByRole("link", { name: "Moradores" })).toHaveAttribute("href", "/moradores");
  });

  it("hides the residents from the other profiles", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "farmer" }));

    expect(screen.queryByRole("link", { name: "Moradores" })).not.toBeInTheDocument();
  });

  it("hides the purchases of the building from the other profiles", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "buyer" }));

    expect(screen.queryByRole("link", { name: "Compras do prédio" })).not.toBeInTheDocument();
  });

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

  it("links the farmer to the sales", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "farmer" }));

    expect(screen.getByRole("link", { name: "Minhas vendas" })).toHaveAttribute("href", "/vendas");
  });

  it("hides the sales from the other profiles", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: "apartment" }));

    expect(screen.queryByRole("link", { name: "Minhas vendas" })).not.toBeInTheDocument();
  });
});
