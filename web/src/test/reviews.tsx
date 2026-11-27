import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { AuthoredReview, Review, Reviewable } from "../api/reviews";
import { ReviewForm } from "../components/reviews/ReviewForm";
import { Reviews } from "../pages/Reviews";
import {
  anaAsManager,
  fakeAuth,
  pageResponse,
  renderWithAuth,
  stubFetch,
} from "./helpers";

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
  return renderReviewsAnswering(url, pageResponse(reviewables), pageResponse(authored), ...more);
}

export const OSVALDO_URL = "/avaliar?compra=compra-2&agricultor=agricultor-1";

export function title(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

export function renderForm(props: Partial<ComponentProps<typeof ReviewForm>> = {}) {
  const onSubmit = vi.fn<(review: unknown) => Promise<void>>().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <ReviewForm
      farmerName="Osvaldo S."
      context="Entregue em 19/11 · Mandioca e Alface"
      initial={{ rating: 0, comment: "" }}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSubmit, onCancel };
}

export function star(rating: number): HTMLElement {
  return screen.getByRole("radio", { name: new RegExp(`^${rating} estrelas?,`) });
}

export function comment(): HTMLElement {
  return screen.getByLabelText("Comentário (opcional)");
}

export function send() {
  return userEvent.click(screen.getByRole("button", { name: "Enviar" }));
}
