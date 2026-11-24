import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { address, couve, feijao, renderCatalog, requested } from "../test/catalog";
import { pageOf } from "../test/farmers";

function sortField(): HTMLElement {
  return screen.getByRole("combobox", { name: "Ordenar por" });
}

async function applyFilters(day: string, quantity: string) {
  fireEvent.change(screen.getByLabelText("Vence depois de"), { target: { value: day } });
  const minimum = screen.getByLabelText("Quantidade mínima");
  await userEvent.clear(minimum);
  if (quantity) await userEvent.type(minimum, quantity);
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
}

describe("Catalog, sorting and filtering", () => {
  it.each([
    ["Menor preço", "lowest_price"],
    ["Validade mais longa", "latest_expiration"],
    ["Melhor avaliados", "highest_rating"],
  ])("sorts by %s", async (label, sort) => {
    const fetchMock = renderCatalog("/", pageOf([feijao]), pageOf([couve, feijao]));
    await screen.findByText("1 produto");

    await userEvent.selectOptions(sortField(), label);

    expect(await screen.findByText("2 produtos")).toBeVisible();
    expect(requested(fetchMock)[1]).toBe(`/api/products?sort=${sort}&page=1`);
    expect(address()).toBe(`/?sort=${sort}`);
    expect(sortField()).toHaveValue(sort);
  });

  it("starts with the most relevant and sends no order", async () => {
    const fetchMock = renderCatalog("/?sort=lowest_price", pageOf([feijao]));
    await screen.findByText("1 produto");

    await userEvent.selectOptions(sortField(), "Mais relevantes");

    expect(requested(fetchMock)[1]).toBe("/api/products?page=1");
    expect(address()).toBe("/");
  });

  it("filters by expiration day", async () => {
    const fetchMock = renderCatalog("/", pageOf([feijao]), pageOf([couve]));
    await screen.findByText("1 produto");

    await applyFilters("2026-12-20", "");

    expect(await screen.findByRole("link", { name: "Couve" })).toBeVisible();
    expect(requested(fetchMock)[1]).toBe("/api/products?expiration_from=2026-12-20&page=1");
    const chip = screen.getByRole("button", { name: "Remover Vence depois de 20/12/2026" });
    expect(chip).toBeVisible();
  });

  it("filters by minimum quantity", async () => {
    const fetchMock = renderCatalog("/", pageOf([feijao]), pageOf([couve]));
    await screen.findByText("1 produto");

    await applyFilters("", "12");

    expect(await screen.findByRole("link", { name: "Couve" })).toBeVisible();
    expect(requested(fetchMock)[1]).toBe("/api/products?min_quantity=12&page=1");
    expect(screen.getByRole("button", { name: "Remover Quantidade mínima: 12" })).toBeVisible();
  });

  it("removes each filter with its chip", async () => {
    const url = "/?q=couve&expiration_from=2026-12-20&min_quantity=5";
    const fetchMock = renderCatalog(url, pageOf([couve]));
    await screen.findByText("1 produto");

    await userEvent.click(screen.getByRole("button", { name: "Remover Quantidade mínima: 5" }));
    expect(address()).toBe("/?q=couve&expiration_from=2026-12-20");
    await userEvent.click(screen.getByRole("button", { name: /Remover Vence depois de/ }));

    expect(address()).toBe("/?q=couve");
    expect(requested(fetchMock)[2]).toBe("/api/products?q=couve&page=1");
    expect(screen.getByLabelText("Vence depois de")).toHaveValue("");
  });

  it("clears every filter and keeps the order", async () => {
    renderCatalog("/?q=couve&min_quantity=5&sort=lowest_price", pageOf([couve]));
    await screen.findByText("1 produto");

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(address()).toBe("/?sort=lowest_price");
    expect(screen.queryByRole("list", { name: "Filtros aplicados" })).not.toBeInTheDocument();
  });

  it("says why the filters found nothing", async () => {
    renderCatalog("/?min_quantity=500", pageOf([]));

    expect(await screen.findByText("Nenhum produto encontrado com esses filtros.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Limpar filtros" })).toHaveLength(2);
  });

  it("hides the filters of the phone behind one button", async () => {
    renderCatalog("/?min_quantity=5", pageOf([couve]));
    const button = screen.getByRole("button", { name: "Filtros (1)" });
    const panel = screen.getByRole("form", { name: "Filtros" });
    expect(panel).toHaveClass("hidden", "sm:flex");

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveClass("hidden");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the focus on the button that applied the filters", async () => {
    renderCatalog("/", pageOf([feijao]), pageOf([couve]));
    await screen.findByText("1 produto");

    await applyFilters("2026-12-20", "3");

    expect(await screen.findByRole("link", { name: "Couve" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toHaveFocus();
    expect(screen.getByLabelText("Quantidade mínima")).toHaveValue(3);
  });

  it("starts again from the first page when the order changes", async () => {
    const fetchMock = renderCatalog("/", pageOf([feijao], 1, 2), pageOf([couve], 2, 2));
    await screen.findByText("1 produto");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais produtos" }));
    await screen.findByRole("link", { name: "Couve" });

    await userEvent.selectOptions(sortField(), "Menor preço");

    expect(requested(fetchMock)[2]).toBe("/api/products?sort=lowest_price&page=1");
  });
});
