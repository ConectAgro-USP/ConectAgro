import { apiFetch } from "./client";

export interface Product {
  public_id: string;
  name: string;
  description: string | null;
  picture_url: string | null;
  quantity: number;
  price: string;
  expiration_date: string;
  farmer_public_id: string;
  created_at: string;
}

export interface ProductInput {
  name: string;
  description: string | null;
  picture_url: string | null;
  quantity: number;
  price: string;
  expiration_date: string;
}

export function listMyProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/products/me");
}

export function createProduct(product: ProductInput): Promise<Product> {
  return apiFetch<Product>("/products", { method: "POST", body: JSON.stringify(product) });
}

export function updateProduct(publicId: string, changes: ProductInput): Promise<Product> {
  return apiFetch<Product>(`/products/${publicId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function deleteProduct(publicId: string): Promise<void> {
  return apiFetch<void>(`/products/${publicId}`, { method: "DELETE" });
}
