import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CatalogProduct } from "../api/products";
import { pageOf } from "../test/farmers";
import {
  anaAsBuyer,
  anaAsFarmer,
  anaAsManager,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  stubFetch,
} from "../test/helpers";
import { answerMyInterests } from "../test/interests";
import { Dashboard } from "./Dashboard";

const mandioca: CatalogProduct = {
  public_id: "produto-1",
  name: "Mandioca",
  description: "Colhida nesta semana",
  picture_url: "https://example.com/mandioca.jpg",
  quantity: 30,
  price: "7.00",
  unit: "kg",
  expiration_date: "2099-12-10",
  farmer_public_id: "agricultor-1",
  created_at: "2026-11-20T12:00:00Z",
  farmer_short_name: "João S.",
  farmer_farm_name: "Sítio Borba",
  farmer_average_rating: 4.5,
  farmer_reviews_count: 2,
};
const laranja: CatalogProduct = {
  ...mandioca,
  public_id: "produto-2",
  name: "Laranja",
  description: null,
  picture_url: null,
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  farmer_farm_name: null,
  farmer_average_rating: null,
  farmer_reviews_count: 0,
};
const resident = anaAsBuyer("APROVADO");

function renderHome(user = resident, ...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  answerMyInterests();
  renderWithAuth(<Dashboard />, fakeAuth({ user }));
  return fetchMock;
}

async function findRow(name: string): Promise<HTMLElement> {
  return (await screen.findByRole("link", { name })).closest("li")!;
}

describe("Dashboard, catalog of the resident and the manager", () => {
  it("opens with the slogan and lists the products on sale", async () => {
    const fetchMock = renderHome(resident, pageOf([mandioca, laranja]));

    expect(screen.getByText("Conectando residências à agricultura familiar")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Produtos disponíveis" })).toBeVisible();
    const row = await findRow("Mandioca");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/products?page=1", expect.anything());
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/produtos/produto-1");
    expect(row).toHaveTextContent("Vendido por João S., Sítio Borba");
    expect(row).toHaveTextContent("30 kg disponíveis · Vence 10/12/2099");
    expect(row).toHaveTextContent("R$ 7,00 por quilo");
    expect(row.querySelector("img")).toHaveAttribute("src", mandioca.picture_url);
  });

  it("shows how each farmer was rated", async () => {
    renderHome(resident, pageOf([mandioca, laranja]));

    expect(await findRow("Mandioca")).toHaveTextContent("4,5 de 5 (2 avaliações)");
    expect(await findRow("Laranja")).toHaveTextContent("Ainda sem avaliações");
  });

  it("names the seller with what the farmer filled in", async () => {
    const nameless = { ...laranja, public_id: "produto-3", name: "Alface", farmer_short_name: "" };
    const farmOnly = {
      ...nameless,
      public_id: "produto-4",
      name: "Couve",
      farmer_farm_name: "Sítio Rosa",
    };
    renderHome(resident, pageOf([laranja, nameless, farmOnly]));

    expect(within(await findRow("Laranja")).getByText("Maria F.")).toBeVisible();
    expect(within(await findRow("Alface")).getByText("Agricultor")).toBeVisible();
    expect(within(await findRow("Couve")).getByText("Sítio Rosa")).toBeVisible();
  });

  it("shows the same catalog to the manager", async () => {
    renderHome(anaAsManager, pageOf([mandioca]));

    expect(await findRow("Mandioca")).toBeVisible();
  });

  it("keeps the farmer's home without the catalog", () => {
    const fetchMock = renderHome(anaAsFarmer);

    expect(screen.getByRole("heading", { level: 1, name: "Início" })).toBeInTheDocument();
    expect(screen.queryByText("Produtos disponíveis")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/products\?/),
      expect.anything(),
    );
  });

  it("shows more products when asked", async () => {
    const fetchMock = renderHome(resident, pageOf([mandioca], 1, 2), pageOf([laranja], 2, 2));
    await findRow("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais produtos" }));

    expect(await findRow("Laranja")).toBeVisible();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products?page=2");
    expect(screen.queryByRole("button", { name: "Mostrar mais produtos" })).not.toBeInTheDocument();
  });

  it("says when nothing is on sale", async () => {
    renderHome(resident, pageOf([]));

    expect(await screen.findByText("Nenhum produto disponível agora.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the error and tries again", async () => {
    renderHome(resident, jsonResponse({}, 500), pageOf([mandioca]));

    expect(await screen.findByRole("alert")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await findRow("Mandioca")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
