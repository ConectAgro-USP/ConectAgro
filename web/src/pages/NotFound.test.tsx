import { screen } from "@testing-library/react";
import App from "../App";
import { ana, anaAsBuyer, anaAsFarmer, fakeAuth, renderWithAuth } from "../test/helpers";

const NOT_FOUND = "Página não encontrada";

describe("unknown address", () => {
  it("shows the not found page inside the app, with a way back to the start", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsFarmer }), "/pagina-que-nao-existe");

    expect(screen.getByRole("heading", { level: 1, name: NOT_FOUND })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Perfil" })).toBeInTheDocument();
  });

  it("shows the not found page for a deeper unknown address", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsFarmer }), "/vendas/antigas/2020");

    expect(screen.getByRole("heading", { level: 1, name: NOT_FOUND })).toBeInTheDocument();
  });

  it("still sends a visitor to the login", () => {
    renderWithAuth(<App />, fakeAuth(), "/pagina-que-nao-existe");

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: NOT_FOUND })).not.toBeInTheDocument();
  });

  it("still asks a user without profile to choose one", () => {
    renderWithAuth(<App />, fakeAuth({ user: ana }), "/pagina-que-nao-existe");

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: NOT_FOUND })).not.toBeInTheDocument();
  });

  it("still shows a pending resident the wait for approval", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("PENDENTE") }), "/pagina-que-nao-existe");

    expect(screen.getByRole("heading", { name: "Aguardando aprovação" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: NOT_FOUND })).not.toBeInTheDocument();
  });
});

describe("page of another profile", () => {
  const NO_ACCESS = "Você não tem acesso a esta página";

  it("keeps the header and offers a way back to the start", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsFarmer }), "/necessidades");

    expect(screen.getByRole("heading", { level: 1, name: NO_ACCESS })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Perfil" })).toBeInTheDocument();
  });

  it("still shows a pending resident the wait for approval", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("PENDENTE") }), "/vendas");

    expect(screen.getByRole("heading", { name: "Aguardando aprovação" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: NO_ACCESS })).not.toBeInTheDocument();
  });
});
