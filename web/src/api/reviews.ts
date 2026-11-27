import { apiFetch } from "./client";
import { fetchAllPages, LARGEST_PAGE, pageQuery, type Page } from "./pagination";

export const RATINGS = [1, 2, 3, 4, 5];
export const COMMENT_MAX_LENGTH = 500;

export interface Reviewable {
  purchase_public_id: string;
  farmer_public_id: string;
  farmer_short_name: string;
  delivered_at: string | null;
  product_names: string[];
}

export interface ReviewCreate {
  rating: number;
  comment: string;
}

export interface Review extends ReviewCreate {
  public_id: string;
  purchase_public_id: string;
  farmer_public_id: string;
  apartment_public_id: string | null;
  buyer_public_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AuthoredReview extends Review {
  farmer_short_name: string;
}

// a API não diz quem avaliou, para o agricultor não saber quem compra de quem
export interface ReceivedReview extends ReviewCreate {
  public_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface ReceivedReviews {
  average_rating: number | null;
  reviews_count: number;
  reviews: ReceivedReview[];
}

export function listReceivedReviews(): Promise<ReceivedReviews> {
  return apiFetch<ReceivedReviews>("/farmers/me/reviews");
}

export function listReviewable(page: number, pageSize?: number): Promise<Page<Reviewable>> {
  return apiFetch<Page<Reviewable>>(`/purchases/reviewable?${pageQuery(page, pageSize)}`);
}

// o histórico de compras procura a entrega de cada pedido na tela
export function listAllReviewables(): Promise<Reviewable[]> {
  return fetchAllPages((page) => listReviewable(page, LARGEST_PAGE));
}

export function listAuthoredReviews(page: number): Promise<Page<AuthoredReview>> {
  return apiFetch<Page<AuthoredReview>>(`/reviews/me?${pageQuery(page)}`);
}

export function createReview(reviewable: Reviewable, review: ReviewCreate): Promise<Review> {
  const { purchase_public_id, farmer_public_id } = reviewable;
  return apiFetch<Review>(
    `/purchases/${purchase_public_id}/farmers/${farmer_public_id}/reviews`,
    { method: "POST", body: JSON.stringify(review) },
  );
}

export function updateReview(publicId: string, review: ReviewCreate): Promise<Review> {
  return apiFetch<Review>(`/reviews/${publicId}`, {
    method: "PATCH",
    body: JSON.stringify(review),
  });
}
