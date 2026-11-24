import { screen } from "@testing-library/react";
import type { MyProduct } from "../api/products";
import type { ReceivedReviews } from "../api/reviews";
import type { Sale } from "../api/sales";
import { FarmerHome } from "../pages/FarmerHome";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth } from "./helpers";

export const NO_REVIEWS: ReceivedReviews = { average_rating: null, reviews_count: 0, reviews: [] };

export function salesPage(sales: Sale[], total = sales.length, expected = "0.00"): Response {
  return jsonResponse({
    items: sales,
    total,
    page: 1,
    page_size: 20,
    total_pages: total > 0 ? 1 : 0,
    realized_total: "0.00",
    expected_total: expected,
    counterparts: [],
  });
}

interface HomeAnswers {
  // uma lista responde um pedido de cada vez, para testar o tentar de novo
  sales?: Response | Response[];
  products?: MyProduct[] | Response;
  reviews?: ReceivedReviews;
}

// cada resumo pede a sua rota, e a ordem dos pedidos não importa
export function renderHome(answers: HomeAnswers = {}) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/farmers/me/sales")) {
      const sales = Array.isArray(answers.sales) ? answers.sales.shift() : answers.sales;
      return sales ?? salesPage([]);
    }
    if (url === "/api/farmers/me/reviews") return jsonResponse(answers.reviews ?? NO_REVIEWS);
    const products = answers.products ?? [];
    return products instanceof Response ? products : jsonResponse(products);
  });
  vi.stubGlobal("fetch", fetchMock);
  renderWithAuth(<FarmerHome />, fakeAuth({ user: anaAsFarmer }));
  return fetchMock;
}

export async function findSummary(title: string): Promise<HTMLElement> {
  return screen.findByRole("region", { name: title });
}
