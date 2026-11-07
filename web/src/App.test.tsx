import { screen } from "@testing-library/react";
import App from "./App";
import { ana, anaAsBuyer, fakeAuth, renderWithAuth } from "./test/helpers";

describe("App", () => {
  it.each([
    ["/", "Olá, Ana Souza"],
    ["/perfil", "Meu perfil"],
  ])("shows the header with the page at %s", (url, heading) => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), url);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Perfil" })).toBeInTheDocument();
  });

  it("shows no header before the profile is set up", () => {
    renderWithAuth(<App />, fakeAuth({ user: ana }), "/");

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Perfil" })).not.toBeInTheDocument();
  });

  it("sends a visitor at /perfil to the login", () => {
    renderWithAuth(<App />, fakeAuth(), "/perfil");

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Perfil" })).not.toBeInTheDocument();
  });
});
