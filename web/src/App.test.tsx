import { screen } from "@testing-library/react";
import App from "./App";
import { anaAsBuyer, fakeAuth, renderWithAuth } from "./test/helpers";

describe("App", () => {
  it("shows the profile page at /perfil", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), "/perfil");

    expect(screen.getByRole("heading", { name: "Meu perfil" })).toBeInTheDocument();
  });

  it("sends a visitor at /perfil to the login", () => {
    renderWithAuth(<App />, fakeAuth(), "/perfil");

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });
});
