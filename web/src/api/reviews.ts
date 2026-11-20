import { apiFetch } from "./client";

export interface FarmerReview {
  rating: number;
  comment: string;
  public_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface Review extends FarmerReview {
  purchase_public_id: string;
  farmer_public_id: string;
  apartment_public_id: string | null;
  buyer_public_id: string | null;
}

export interface FarmerReviews {
  average_rating: number | null;
  reviews_count: number;
  reviews: FarmerReview[];
}

export interface ReviewablePurchase {
  purchase_public_id: string;
  farmer_public_id: string;
  farmer_short_name: string;
}

export interface ReviewInput {
  rating: number;
  comment?: string;
}

export function getFarmerReviews(farmerPublicId: string): Promise<FarmerReviews> {
  return apiFetch<FarmerReviews>(`/farmers/${farmerPublicId}/reviews`);
}

export function listReviewablePurchases(): Promise<ReviewablePurchase[]> {
  return apiFetch<ReviewablePurchase[]>("/purchases/reviewable");
}

export function createReview(
  purchasePublicId: string,
  farmerPublicId: string,
  review: ReviewInput,
): Promise<Review> {
  return apiFetch<Review>(
    `/purchases/${purchasePublicId}/farmers/${farmerPublicId}/reviews`,
    { method: "POST", body: JSON.stringify(review) },
  );
}
