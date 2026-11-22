import type { AuthoredReview, Reviewable } from "../../api/reviews";

export const REVIEWS_PATH = "/avaliar";

interface ReviewsState {
  fromApp?: boolean;
  message?: string;
}

export const FROM_APP: ReviewsState = { fromApp: true };

export function reviewsStateOf(state: unknown): ReviewsState {
  return typeof state === "object" && state !== null ? state : {};
}

export function newReviewPath(reviewable: Reviewable, rating: number): string {
  const params = new URLSearchParams({
    compra: reviewable.purchase_public_id,
    agricultor: reviewable.farmer_public_id,
    nota: String(rating),
  });
  return `${REVIEWS_PATH}?${params}`;
}

export function editReviewPath(review: AuthoredReview): string {
  return `${REVIEWS_PATH}?${new URLSearchParams({ editar: review.public_id })}`;
}
