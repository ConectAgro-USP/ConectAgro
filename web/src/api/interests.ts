import { apiFetch } from "./client";

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

export function createInterest(interest: InterestInput): Promise<Interest> {
  return apiFetch<Interest>("/interests", {
    method: "POST",
    body: JSON.stringify(interest),
  });
}
