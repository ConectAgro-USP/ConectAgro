import { apiFetch, ignoreNotFound } from "./client";
import type { ProductDetail } from "./products";

export interface InterestInput {
  product_public_id: string;
  quantity: number;
}

export interface Interest {
  public_id: string;
  buyer_public_id: string;
  product_public_id: string | null;
  product_name: string | null;
  product_status: string;
  quantity: number;
  created_at: string;
  updated_at: string | null;
}

export interface BuildingNeed {
  product: ProductDetail;
  total_quantity: number;
  interested_buyers_count: number;
}

export function createInterest(interest: InterestInput): Promise<Interest> {
  return apiFetch<Interest>("/interests", {
    method: "POST",
    body: JSON.stringify(interest),
  });
}

export function listMyInterests(): Promise<Interest[]> {
  return apiFetch<Interest[]>("/interests/me");
}

export function updateInterest(publicId: string, quantity: number): Promise<Interest> {
  return apiFetch<Interest>(`/interests/${publicId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function deleteInterest(publicId: string): Promise<void> {
  return apiFetch<void>(`/interests/${publicId}`, { method: "DELETE" }).catch(
    ignoreNotFound("Interesse não encontrado"),
  );
}

export function listBuildingNeeds(descending: boolean): Promise<BuildingNeed[]> {
  return apiFetch<BuildingNeed[]>(`/apartments/me/needs?descending=${descending}`);
}
