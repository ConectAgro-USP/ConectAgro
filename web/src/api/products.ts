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

export interface ProductFarmer {
  public_id: string;
  farm_name: string | null;
  short_name: string;
  picture_url: string | null;
}

export interface ProductDetail extends Product {
  is_available: boolean;
  farmer: ProductFarmer;
}

export interface ProductContact {
  recipient_name: string;
  cellphone: string | null;
  message: string;
}

export function listMyProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/products/me");
}

export function getProduct(publicId: string): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${publicId}`);
}

export function getProductContact(publicId: string): Promise<ProductContact> {
  return apiFetch<ProductContact>(`/products/${publicId}/contact`);
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
