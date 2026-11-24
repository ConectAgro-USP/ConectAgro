import { screen } from "@testing-library/react";
import type { CatalogProduct } from "../api/products";
import { Dashboard } from "../pages/Dashboard";
import { pageOf } from "./farmers";
import { anaAsBuyer, fakeAuth, renderWithAuth } from "./helpers";
import { answerMyInterests } from "./interests";
import { Address, BackButton } from "./RouterProbe";

export const feijao: CatalogProduct = {
  public_id: "produto-1",
  name: "Feijão carioca",
  description: "Colhido nesta semana",
  picture_url: null,
  quantity: 30,
  price: "9.00",
  expiration_date: "2099-12-10",
  farmer_public_id: "agricultor-1",
  created_at: "2026-11-20T12:00:00Z",
  farmer_short_name: "João S.",
  farmer_farm_name: "Sítio Borba",
  farmer_average_rating: 4.5,
  farmer_reviews_count: 2,
};

export const couve: CatalogProduct = { ...feijao, public_id: "produto-2", name: "Couve" };

// cada resposta vai para um pedido, e os que sobram recebem uma lista vazia
export function renderCatalog(url: string, ...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>(async () => pageOf([]));
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  answerMyInterests();
  const auth = fakeAuth({ user: anaAsBuyer("APROVADO") });
  renderWithAuth(
    <>
      <Dashboard />
      <Address />
      <BackButton />
    </>,
    auth,
    url,
  );
  return fetchMock;
}

export function address(): string | null {
  return screen.getByTestId("address").textContent;
}

export function requested(fetchMock: ReturnType<typeof renderCatalog>): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}
