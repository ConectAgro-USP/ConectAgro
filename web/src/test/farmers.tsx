import { screen } from "@testing-library/react";
import type { FarmerProduct, NearbyFarmer } from "../api/farmers";
import { NearbyFarmers } from "../pages/NearbyFarmers";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "./helpers";

export const RETRY = "Tentar de novo";
export const FIRST_SEARCH = "/api/farmers?max_distance_km=15&page=1&page_size=100";

export const maria: NearbyFarmer = {
  public_id: "agricultor-1",
  name: "Maria S.",
  farm_name: "Sítio Boa Vista",
  distance_km: 3.14,
  available_products_count: 2,
  average_rating: 4.5,
  reviews_count: 70,
  on_time_delivery_percentage: 95.5,
};
// recém-chegado: ninguém avaliou nem recebeu entrega dele
export const joao: NearbyFarmer = {
  public_id: "agricultor-2",
  name: "João V.",
  farm_name: null,
  distance_km: 12,
  available_products_count: 1,
  average_rating: null,
  reviews_count: 0,
  on_time_delivery_percentage: null,
};

export const laranja: FarmerProduct = {
  public_id: "produto-1",
  name: "Laranja",
  description: "Colhida nesta semana",
  picture_url: "https://example.com/laranja.jpg",
  quantity: 30,
  price: "4.99",
  expiration_date: "2026-12-10",
};
export const mandioca: FarmerProduct = {
  public_id: "produto-2",
  name: "Mandioca",
  description: null,
  picture_url: null,
  quantity: 1,
  price: "7.00",
  expiration_date: "2026-11-30",
};

export function pageOf<Item>(items: Item[], page = 1, totalPages = 1, total = items.length): Response {
  return jsonResponse({ items, total, page, page_size: 100, total_pages: totalPages });
}

// o erro simula a rede fora do ar, e a promessa deixa a resposta para depois
export function renderFarmers(...answers: (Response | Error | Promise<Response>)[]) {
  const fetchMock = stubFetch();
  for (const answer of answers) {
    if (answer instanceof Error) {
      fetchMock.mockRejectedValueOnce(answer);
    } else {
      fetchMock.mockReturnValueOnce(Promise.resolve(answer));
    }
  }
  const auth = fakeAuth({ user: anaAsBuyer("APROVADO") });
  renderWithAuth(<NearbyFarmers />, auth);
  return { fetchMock, auth };
}

export async function findCard(name: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { level: 2, name });
  return title.closest("li")!;
}

export function deferred(): { promise: Promise<Response>; resolve: (response: Response) => void } {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
