import type { AuthoredReview, Review, Reviewable } from "../api/reviews";
import { Reviews } from "../pages/Reviews";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "./helpers";

export const lastDelivery: Reviewable = {
  purchase_public_id: "compra-2",
  farmer_public_id: "agricultor-1",
  farmer_short_name: "Osvaldo S.",
  delivered_at: "2026-11-19T15:00:00Z",
  product_names: ["Mandioca", "Alface"],
};

export const fromMaria: Reviewable = {
  purchase_public_id: "compra-3",
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  delivered_at: "2026-11-12T15:00:00Z",
  product_names: ["Laranja"],
};

export const savedReview: Review = {
  public_id: "avaliacao-1",
  purchase_public_id: "compra-1",
  farmer_public_id: "agricultor-1",
  apartment_public_id: "predio-1",
  buyer_public_id: null,
  rating: 4,
  comment: "Boa mandioca",
  created_at: "2026-10-20T14:00:00Z",
  updated_at: null,
};

export const mine: AuthoredReview = { ...savedReview, farmer_short_name: "Osvaldo S." };

export function renderReviewsAnswering(url: string, ...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  const auth = fakeAuth({ user: anaAsManager });
  renderWithAuth(<Reviews />, auth, url);
  return { fetchMock, auth };
}

export function renderReviews(
  url: string,
  reviewables: Reviewable[],
  authored: AuthoredReview[],
  ...more: Response[]
) {
  return renderReviewsAnswering(url, jsonResponse(reviewables), jsonResponse(authored), ...more);
}
