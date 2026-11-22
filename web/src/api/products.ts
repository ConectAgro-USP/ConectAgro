import { apiFetch } from "./client";
import type { Page } from "./pagination";

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

export interface CatalogProduct extends Product {
  farmer_short_name: string;
  farmer_farm_name: string | null;
}

export function listMyProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/products/me");
}

// o usePages manda a busca antes da página, e o catálogo não tem busca
export function listCatalog(_search: null, page: number): Promise<Page<CatalogProduct>> {
  return apiFetch<Page<CatalogProduct>>(`/products?page=${page}`);
}

export function getProduct(publicId: string): Promise<ProductDetail> {
  // o id vem do endereço da página, então não pode virar outro caminho da API
  return apiFetch<ProductDetail>(`/products/${encodeURIComponent(publicId)}`);
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
