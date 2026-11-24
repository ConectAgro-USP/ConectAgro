import { cleanup, screen } from "@testing-library/react";
import type { CatalogProduct } from "../api/products";
import { CARD_SURFACE } from "../components/surface";
import { laranja, pageOf as productsPage } from "../test/farmers";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findCard as findInterest, mandioca, renderInterests } from "../test/interests";
import { pageLoad, renderDetail } from "../test/productDetail";
import { findCard as findResident, renderResidents, tita } from "../test/residents";
import { findCard as findSale, pageOf, pendingSale, renderSales } from "../test/sales";
import { Dashboard } from "./Dashboard";

const catalogLaranja: CatalogProduct = {
  ...laranja,
  farmer_public_id: "agricultor-1",
  created_at: "2026-11-20T12:00:00Z",
  farmer_short_name: "Maria S.",
  farmer_farm_name: null,
  farmer_average_rating: null,
  farmer_reviews_count: 0,
};

function expectSurface(element: HTMLElement) {
  expect(element).toHaveClass(...CARD_SURFACE.split(" "));
  expect(element.className).not.toMatch(/shadow/);
}

describe("superfície dos cartões", () => {
  it("vale para as linhas do catálogo, que continuam horizontais", async () => {
    stubFetch(productsPage([catalogLaranja]));
    renderWithAuth(<Dashboard />, fakeAuth({ user: anaAsBuyer("APROVADO") }));

    const row = (await screen.findByRole("link", { name: "Laranja" })).closest("li")!;
    expectSurface(row);
    expect(row).toHaveClass("flex");
    expect(row).not.toHaveClass("flex-col");
  });

  it("vale para os cartões do histórico", async () => {
    renderSales(pageOf(pendingSale));

    expectSurface(await findSale(pendingSale.building_name));
  });

  it("vale para as caixas da página do produto", async () => {
    stubFetch(...pageLoad());
    renderDetail();

    const name = await screen.findByRole("heading", { name: "Mandioca Natural" });
    expectSurface(name.parentElement!.parentElement!);
    expectSurface(screen.getByRole("heading", { name: "Descrição" }).closest("section")!);
  });

  it("vale para os cartões de moradores e de interesses", async () => {
    renderResidents(jsonResponse([tita]));
    expectSurface(await findResident("Tita Russell"));
    cleanup();

    renderInterests(jsonResponse([mandioca]));
    expectSurface(await findInterest("Mandioca"));
  });
});
