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
