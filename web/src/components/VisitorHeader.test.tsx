import { screen, within } from "@testing-library/react";
import { anaAsBuyer, fakeAuth } from "../test/helpers";
import { renderVisitorApp } from "../test/visitor";

function header(): HTMLElement {
  return screen.getByRole("banner");
}

describe("header for a visitor", () => {
  it("shows the logo, the search and the login in place of the profile", async () => {
    renderVisitorApp("/");
    await screen.findByText("1 produto");

    const top = header();
    expect(within(top).getByRole("link", { name: "ConectAgro" })).toHaveAttribute("href", "/");
    const search = within(top).getByRole("search");
    expect(search.parentElement).toHaveClass("hidden", "lg:block");
    const login = within(top).getByRole("link", { name: "Entrar" });
    expect(login).toHaveAttribute("href", "/login");
    expect(login).toHaveClass("rounded-full", "h-11", "bg-lime-800");
    expect(login.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no logout, no profile, no page links and no cart", async () => {
    renderVisitorApp("/");
    await screen.findByText("1 produto");

    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Perfil" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Início" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Carrinho/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Menu principal" })).not.toBeInTheDocument();
  });

  it("has no bottom bar and keeps no space for it", async () => {
    const { container } = renderVisitorApp("/");
    await screen.findByText("1 produto");

    expect(screen.queryByRole("button", { name: "Mais" })).not.toBeInTheDocument();
    expect(container.querySelector("[class*='safe-area-inset-bottom']")).toBeNull();
  });

  it("sends the visitor to the login with the page to come back to", async () => {
    renderVisitorApp("/?q=couve&sort=lowest_price");
    await screen.findByText("1 produto");

    const login = within(header()).getByRole("link", { name: "Entrar" });
    expect(login).toHaveAttribute("href", "/login?proximo=%2F%3Fq%3Dcouve%26sort%3Dlowest_price");
  });

  it("keeps the product page as the return", async () => {
    renderVisitorApp("/produtos/prod-123");
    await screen.findByRole("heading", { name: "Mandioca Natural" });

    const login = within(header()).getByRole("link", { name: "Entrar" });
    expect(login).toHaveAttribute("href", "/login?proximo=%2Fprodutos%2Fprod-123");
  });

  it("gives a logged in resident the usual header and bottom bar", async () => {
    renderVisitorApp("/", {}, fakeAuth({ user: anaAsBuyer("APROVADO") }));
    await screen.findByText("1 produto");

    expect(within(header()).queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais" })).toBeInTheDocument();
  });
});
