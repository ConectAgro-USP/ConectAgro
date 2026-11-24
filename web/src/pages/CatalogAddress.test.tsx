import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { address, couve, feijao, renderCatalog, requested } from "../test/catalog";
import { pageOf } from "../test/farmers";

describe("Catalog, the search in the address", () => {
  it("fills every control from a shared link", async () => {
    const url = "/?q=couve&expiration_from=2026-12-20&min_quantity=5&sort=highest_rating";
    const fetchMock = renderCatalog(url, pageOf([couve]));

    await screen.findByText("1 produto");

    expect(requested(fetchMock)).toEqual([
      "/api/products?q=couve&expiration_from=2026-12-20&min_quantity=5&sort=highest_rating&page=1",
    ]);
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toHaveValue("highest_rating");
    expect(screen.getByLabelText("Vence depois de")).toHaveValue("2026-12-20");
    expect(screen.getByLabelText("Quantidade mínima")).toHaveValue(5);
    const chips = screen.getByRole("list", { name: "Filtros aplicados" });
    expect(chips).toHaveTextContent("Busca: couve");
    expect(chips).toHaveTextContent("Vence depois de 20/12/2026");
    expect(chips).toHaveTextContent("Quantidade mínima: 5");
  });

  it("ignores values the API would refuse", async () => {
    const url = "/?sort=cheapest&expiration_from=2026-02-30&min_quantity=0";
    const fetchMock = renderCatalog(url, pageOf([feijao]));

    await screen.findByText("1 produto");

    expect(requested(fetchMock)).toEqual(["/api/products?page=1"]);
    expect(screen.queryByRole("list", { name: "Filtros aplicados" })).not.toBeInTheDocument();
  });

  it("goes back to the previous search", async () => {
    const fetchMock = renderCatalog("/?q=couve", pageOf([couve]), pageOf([]), pageOf([couve]));
    await screen.findByRole("link", { name: "Couve" });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Ordenar por" }),
      "Menor preço",
    );
    await screen.findByText(/Nenhum produto encontrado/);

    await userEvent.click(screen.getByRole("button", { name: "Voltar no navegador" }));

    expect(await screen.findByRole("link", { name: "Couve" })).toBeVisible();
    expect(address()).toBe("/?q=couve");
    expect(requested(fetchMock)[2]).toBe("/api/products?q=couve&page=1");
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toHaveValue("relevance");
  });

  it("shows the old message when nothing is on sale at all", async () => {
    renderCatalog("/", pageOf([]));

    expect(await screen.findByText("Nenhum produto disponível agora.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });
});
