import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { couve, feijao } from "../test/catalog";
import { pageOf } from "../test/farmers";
import { closedCalls, renderVisitorApp } from "../test/visitor";

function requested(fetchMock: ReturnType<typeof renderVisitorApp>["fetchMock"]): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

describe("catalog for a visitor", () => {
  it("opens the home with the products and the slogan", async () => {
    const { fetchMock } = renderVisitorApp("/", { catalog: [pageOf([feijao, couve])] });

    expect(await screen.findByRole("link", { name: "Feijão carioca" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Couve" })).toBeVisible();
    expect(screen.getByText("Conectando residências à agricultura familiar")).toBeVisible();
    expect(screen.queryByText(/Comprando para/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Produtos disponíveis");
    expect(document.title).toBe("Produtos · ConectAgro");
    expect(closedCalls(fetchMock)).toEqual([]);
  });

  it("shows no cart button and no interest mark", async () => {
    const { fetchMock } = renderVisitorApp("/", { catalog: [pageOf([feijao])] });

    const row = (await screen.findByRole("link", { name: "Feijão carioca" })).closest("li")!;
    expect(within(row).getByText("R$ 9,00")).toBeVisible();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /carrinho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Carrinho/ })).not.toBeInTheDocument();
    expect(requested(fetchMock).some((url) => url.startsWith("/api/interests"))).toBe(false);
  });

  it("searches from the band", async () => {
    const { fetchMock } = renderVisitorApp("/", { catalog: [pageOf([feijao]), pageOf([couve])] });
    await screen.findByText("1 produto");

    const band = screen.getAllByRole("searchbox", { name: "Buscar produto" }).at(-1)!;
    await userEvent.type(band, "couve{Enter}");

    expect(await screen.findByRole("link", { name: "Couve" })).toBeVisible();
    expect(requested(fetchMock)).toContain("/api/products?q=couve&page=1");
    expect(screen.getByTestId("address")).toHaveTextContent(/^\/\?q=couve$/);
  });

  it("sorts and shows the chips of the filters", async () => {
    const { fetchMock } = renderVisitorApp("/?min_quantity=5", {
      catalog: [pageOf([feijao]), pageOf([couve, feijao])],
    });
    await screen.findByText("1 produto");
    expect(screen.getByRole("button", { name: /^Remover / })).toBeVisible();

    const sort = screen.getByRole("combobox", { name: "Ordenar por" });
    await userEvent.selectOptions(sort, "Menor preço");

    expect(await screen.findByText("2 produtos")).toBeVisible();
    expect(requested(fetchMock)[1]).toBe("/api/products?min_quantity=5&sort=lowest_price&page=1");
    expect(closedCalls(fetchMock)).toEqual([]);
  });

  it("loads more products", async () => {
    const { fetchMock } = renderVisitorApp("/", {
      catalog: [pageOf([feijao], 1, 2, 2), pageOf([couve], 2, 2, 2)],
    });
    await screen.findByRole("link", { name: "Feijão carioca" });

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais produtos" }));

    expect(await screen.findByRole("link", { name: "Couve" })).toBeVisible();
    expect(requested(fetchMock)[1]).toBe("/api/products?page=2");
    expect(closedCalls(fetchMock)).toEqual([]);
  });
});
