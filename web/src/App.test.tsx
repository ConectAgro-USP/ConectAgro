import { screen } from "@testing-library/react";
import App from "./App";
import { ana, anaAsBuyer, fakeAuth, renderWithAuth, stubSilentApi } from "./test/helpers";

describe("App", () => {
  it.each([
    ["/", "Produtos em destaque"],
    ["/perfil", "Meu perfil"],
  ])("shows the header with the page at %s", (url, heading) => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), url);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Perfil" })).toBeInTheDocument();
  });

  it("shows no header before the profile is set up", () => {
    renderWithAuth(<App />, fakeAuth({ user: ana }), "/");

    const question = "Como você vai usar o ConectAgro?";
    expect(screen.getByRole("heading", { name: question })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Perfil" })).not.toBeInTheDocument();
  });

  it("sends a visitor at /perfil to the login", () => {
    renderWithAuth(<App />, fakeAuth(), "/perfil");

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Perfil" })).not.toBeInTheDocument();
  });
});
