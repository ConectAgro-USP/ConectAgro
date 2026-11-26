import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { address } from "../test/address";
import { findCard, joao, maria, pageOf, renderFarmersAt } from "../test/farmers";

const PAGE = "page=1&page_size=100";

async function addProduct(product: string) {
  await userEvent.type(screen.getByRole("searchbox", { name: "Vende" }), `${product}{Enter}`);
}

describe("NearbyFarmers, searching by name and products", () => {
  it("searches by the name of the farmer or the farm", async () => {
    const { fetchMock } = renderFarmersAt("/agricultores", pageOf([maria, joao]), pageOf([maria]));
    await findCard("João V.");

    const field = screen.getByRole("searchbox", { name: "Nome do agricultor ou do sítio" });
    await userEvent.type(field, "  sitio boa  ");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(fetchMock.mock.calls[1][0]).toBe(
      `/api/farmers?name=sitio+boa&max_distance_km=15&${PAGE}`,
    );
    expect(address()).toBe("/agricultores?name=sitio+boa");
    expect(await screen.findByText("1 agricultor a até 15 km do seu prédio")).toBeVisible();
    expect(field).toHaveValue("sitio boa");
  });

  it("adds the products the farmer must sell as chips", async () => {
    const { fetchMock } = renderFarmersAt("/agricultores", pageOf([maria]));
    await findCard("Maria S.");

    await addProduct("Alface");
    await addProduct("Couve");
    await addProduct("alface");

    const chips = screen.getByRole("list", { name: "Produtos procurados" });
    expect(within(chips).getAllByRole("listitem").map((chip) => chip.textContent)).toEqual([
      "Alface",
      "Couve",
    ]);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      `/api/farmers?products=Alface&products=Couve&max_distance_km=15&${PAGE}`,
    );
    expect(screen.getByRole("searchbox", { name: "Vende" })).toHaveValue("");
  });

  it("removes a product chip", async () => {
    const url = "/agricultores?products=Alface&products=Couve";
    const { fetchMock } = renderFarmersAt(url, pageOf([maria]), pageOf([maria, joao]));
    await findCard("Maria S.");

    await userEvent.click(screen.getByRole("button", { name: "Remover Alface" }));

    expect(address()).toBe("/agricultores?products=Couve");
    expect(fetchMock.mock.calls[1][0]).toBe(
      `/api/farmers?products=Couve&max_distance_km=15&${PAGE}`,
    );
    expect(await findCard("João V.")).toBeVisible();
  });

  it("takes at most ten products", async () => {
    const products = Array.from({ length: 11 }, (_, index) => `products=item${index}`);
    renderFarmersAt(`/agricultores?${products.join("&")}`, pageOf([maria]));
    await findCard("Maria S.");

    const chips = screen.getByRole("list", { name: "Produtos procurados" });
    expect(within(chips).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByRole("searchbox", { name: "Vende" })).not.toBeInTheDocument();
    expect(screen.getByText("Você já escolheu 10 produtos, o máximo.")).toBeVisible();
  });

  it("fills the fields from a shared link", async () => {
    const url = "/agricultores?name=Maria&products=Alface&max_distance_km=5&sort=distance";
    const { fetchMock } = renderFarmersAt(url, pageOf([maria]));
    await findCard("Maria S.");

    expect(fetchMock.mock.calls[0][0]).toBe(
      `/api/farmers?name=Maria&products=Alface&max_distance_km=5&sort=distance&${PAGE}`,
    );
    expect(screen.getByRole("searchbox", { name: "Nome do agricultor ou do sítio" })).toHaveValue(
      "Maria",
    );
    const fiveKm = screen.getByRole("button", { name: "Até 5 km" });
    expect(fiveKm).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mais próximos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("explains an empty search and clears the name and the products", async () => {
    const url = "/agricultores?name=Zeca&products=Alface";
    const { fetchMock } = renderFarmersAt(url, pageOf([]), pageOf([maria]));

    expect(
      await screen.findByText("Nenhum agricultor a até 15 km do seu prédio com esses filtros"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(await findCard("Maria S.")).toBeVisible();
    expect(address()).toBe("/agricultores");
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/farmers?max_distance_km=15&${PAGE}`);
  });
});
