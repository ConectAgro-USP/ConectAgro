import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { address, couve, feijao, renderCatalog, requested } from "../test/catalog";
import { pageOf } from "../test/farmers";
import { anaAsManager, fakeAuth, renderWithAuth, stubSilentApi } from "../test/helpers";
import { Dashboard } from "./Dashboard";

async function searchFor(term: string) {
  const box = screen.getByRole("searchbox", { name: "Buscar produto" });
  await userEvent.clear(box);
  await userEvent.type(box, `${term}{Enter}`);
}

describe("Catalog, searching products", () => {
  it("shows the slogan, the building and the count of products", async () => {
    renderCatalog("/", pageOf([feijao, couve]));

    expect(screen.getByText("Conectando residências à agricultura familiar")).toBeVisible();
    expect(screen.getByText(/Comprando para/)).toHaveTextContent(
      "Comprando para Cond. Village Vila Verde",
    );
    expect(await screen.findByText("2 produtos")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Produtos disponíveis");
  });

  it("names the building of the manager", () => {
    stubSilentApi();
    renderWithAuth(<Dashboard />, fakeAuth({ user: anaAsManager }));

    expect(screen.getByText(/Comprando para/)).toHaveTextContent(
      "Comprando para Cond. Village Vila Verde",
    );
  });

  it("searches by the typed term and keeps it in the address", async () => {
    const fetchMock = renderCatalog("/", pageOf([feijao, couve]), pageOf([feijao]));
    await screen.findByText("2 produtos");

    await searchFor("feijão");

    expect(await screen.findByText("1 produto")).toBeVisible();
    expect(requested(fetchMock)[1]).toBe("/api/products?q=feij%C3%A3o&page=1");
    expect(address()).toBe("/?q=feij%C3%A3o");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Resultados para “feijão”");
    expect(screen.getByRole("searchbox", { name: "Buscar produto" })).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Couve" })).not.toBeInTheDocument();
  });

  it("opens a shared link with the search already done", async () => {
    const fetchMock = renderCatalog("/?q=feij%C3%A3o", pageOf([feijao]));

    expect(await screen.findByRole("link", { name: "Feijão carioca" })).toBeVisible();
    expect(requested(fetchMock)).toEqual(["/api/products?q=feij%C3%A3o&page=1"]);
    expect(screen.getByRole("searchbox", { name: "Buscar produto" })).toHaveValue("feijão");
  });

  it("removes the search with its chip", async () => {
    const fetchMock = renderCatalog("/?q=couve", pageOf([couve]), pageOf([feijao, couve]));
    await screen.findByText("1 produto");

    await userEvent.click(screen.getByRole("button", { name: "Remover Busca: couve" }));

    expect(await screen.findByText("2 produtos")).toBeVisible();
    expect(requested(fetchMock)[1]).toBe("/api/products?page=1");
    expect(address()).toBe("/");
    expect(screen.getByRole("searchbox", { name: "Buscar produto" })).toHaveValue("");
    expect(screen.queryByRole("list", { name: "Filtros aplicados" })).not.toBeInTheDocument();
  });

  it("explains an empty search and clears it", async () => {
    renderCatalog("/?q=abacaxi", pageOf([]), pageOf([feijao]));

    const reason = await screen.findByText(/Nenhum produto encontrado para “abacaxi”/);
    expect(reason).toBeVisible();
    expect(screen.queryByText("Nenhum produto disponível agora.")).not.toBeInTheDocument();
    const empty = reason.parentElement!;
    await userEvent.click(within(empty).getByRole("button", { name: "Limpar filtros" }));

    expect(await screen.findByRole("link", { name: "Feijão carioca" })).toBeVisible();
    expect(address()).toBe("/");
  });

  it("searches everything again when the term is erased", async () => {
    const fetchMock = renderCatalog("/?q=couve", pageOf([couve]));
    await screen.findByText("1 produto");

    await userEvent.clear(screen.getByRole("searchbox", { name: "Buscar produto" }));
    await userEvent.keyboard("{Enter}");

    expect(address()).toBe("/");
    expect(requested(fetchMock)[1]).toBe("/api/products?page=1");
  });
});
