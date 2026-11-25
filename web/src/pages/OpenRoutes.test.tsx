import { screen } from "@testing-library/react";
import type { ProfileRead } from "../api/profiles";
import { ana, anaAsBuyer, anaAsFarmer, anaAsManager, fakeAuth } from "../test/helpers";
import { renderVisitorApp } from "../test/visitor";

const PROFILE_QUESTION = "Como você vai usar o ConectAgro?";

function openAs(url: string, user: ProfileRead | null) {
  return renderVisitorApp(url, {}, fakeAuth({ user }));
}

function address(): string | null {
  return screen.getByTestId("address").textContent;
}

describe("pages that ask for a login", () => {
  it.each([
    ["/perfil", "/login?proximo=%2Fperfil"],
    ["/interesses", "/login?proximo=%2Finteresses"],
    ["/carrinho", "/login?proximo=%2Fcarrinho"],
    ["/vendas?mes=2026-11", "/login?proximo=%2Fvendas%3Fmes%3D2026-11"],
  ])("send a visitor at %s to the login with the way back", (url, login) => {
    const { fetchMock } = openAs(url, null);

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeVisible();
    expect(address()).toBe(login);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keep the visitor on the home", async () => {
    openAs("/", null);

    expect(await screen.findByText("1 produto")).toBeVisible();
    expect(address()).toBe("/");
  });
});

describe("logged in users keep their start", () => {
  it("gives the farmer the farmer home", () => {
    openAs("/", anaAsFarmer);

    expect(screen.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it.each([
    ["resident", anaAsBuyer("APROVADO")],
    ["manager", anaAsManager],
  ])("gives the %s the catalog of the building", async (_who, user) => {
    openAs("/", user);

    expect(await screen.findByText("1 produto")).toBeVisible();
    expect(screen.getByText("Cond. Village Vila Verde")).toBeVisible();
    expect(screen.getByRole("link", { name: "Perfil" })).toBeVisible();
  });

  it.each(["/", "/produtos/prod-123"])("asks a user without profile to set it up at %s", (url) => {
    openAs(url, ana);

    expect(screen.getByRole("heading", { name: PROFILE_QUESTION })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it.each(["/", "/produtos/prod-123"])("shows a pending resident the wait at %s", (url) => {
    openAs(url, anaAsBuyer("PENDENTE"));

    expect(screen.getByRole("heading", { name: "Aguardando aprovação" })).toBeVisible();
  });

  it("shows a refused resident the new link request", () => {
    openAs("/", anaAsBuyer("RECUSADO"));

    expect(screen.getByRole("heading", { name: "Vínculo recusado" })).toBeVisible();
  });

  it("still tells another profile it has no access", () => {
    openAs("/necessidades", anaAsFarmer);

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta página" })).toBeVisible();
  });
});
