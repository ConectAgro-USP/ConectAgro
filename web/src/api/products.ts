import { apiFetch, ignoreNotFound } from "./client";
import { pageQuery, type Page } from "./pagination";

export type ProductUnit = "kg" | "unidade" | "duzia" | "maco" | "litro";

export interface Product {
  public_id: string;
  name: string;
  description: string | null;
  picture_url: string | null;
  quantity: number;
  price: string;
  unit: ProductUnit;
  expiration_date: string;
  farmer_public_id: string;
  created_at: string;
}

// o produto visto pelo dono, que pode pausar o anúncio
export interface MyProduct extends Product {
  is_available: boolean;
  // a unidade fica presa depois do primeiro interesse ou da primeira venda
  unit_locked: boolean;
}

export interface ProductInput {
  name: string;
  description: string | null;
  picture_url: string | null;
  quantity: number;
  price: string;
  unit: ProductUnit;
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
  farmer_average_rating: number | null;
  farmer_reviews_count: number;
}

// fora do catálogo junta os pausados, os vencidos e os esgotados
export type Availability = "available" | "hidden";

// contam todos os produtos do agricultor, seja qual for a página
export interface MyProductCounts {
  all: number;
  available: number;
  hidden: number;
  sold_out: number;
  expiring_soon: number;
}

export interface MyProductsPage extends Page<MyProduct> {
  counts: MyProductCounts;
}

export function listMyProducts(
  availability: Availability | null,
  page: number,
  pageSize?: number,
): Promise<MyProductsPage> {
  const query = pageQuery(page, pageSize);
  if (availability) query.set("availability", availability);
  return apiFetch<MyProductsPage>(`/products/me?${query}`);
}

export async function countMyProducts(): Promise<MyProductCounts> {
  const { counts } = await listMyProducts(null, 1, 1);
  return counts;
}

export const CATALOG_SORTS = [
  "relevance",
  "lowest_price",
  "latest_expiration",
  "highest_rating",
] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

// texto vazio e null deixam o filtro de fora do pedido
export interface CatalogFilters {
  q: string;
  sort: CatalogSort;
  expirationFrom: string;
  minQuantity: number | null;
}

export const NO_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  sort: "relevance",
  expirationFrom: "",
  minQuantity: null,
};

// o endereço do catálogo usa estes nomes, e o link refaz a busca
export function catalogQueryOf(filters: CatalogFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.expirationFrom) query.set("expiration_from", filters.expirationFrom);
  if (filters.minQuantity !== null) query.set("min_quantity", String(filters.minQuantity));
  if (filters.sort !== "relevance") query.set("sort", filters.sort);
  return query;
}

export function listCatalog(filters: CatalogFilters, page: number): Promise<Page<CatalogProduct>> {
  const query = catalogQueryOf(filters);
  query.set("page", String(page));
  return apiFetch<Page<CatalogProduct>>(`/products?${query}`);
}

export function getProduct(publicId: string): Promise<ProductDetail> {
  // o id vem do endereço da página, então não pode virar outro caminho da API
  return apiFetch<ProductDetail>(`/products/${encodeURIComponent(publicId)}`);
}

export function getProductContact(publicId: string): Promise<ProductContact> {
  return apiFetch<ProductContact>(`/products/${publicId}/contact`);
}

export function createProduct(product: ProductInput): Promise<MyProduct> {
  return apiFetch<MyProduct>("/products", { method: "POST", body: JSON.stringify(product) });
}

// só o que mudou, para o estoque antigo do formulário não voltar
export function changedFields(before: MyProduct, input: ProductInput): Partial<ProductInput> {
  const changed = Object.entries(input).filter(
    ([field, value]) => value !== before[field as keyof ProductInput],
  );
  return Object.fromEntries(changed) as Partial<ProductInput>;
}

export function updateProduct(
  publicId: string,
  changes: Partial<ProductInput> | { is_available: boolean },
): Promise<MyProduct> {
  return apiFetch<MyProduct>(`/products/${publicId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

// o corpo é a foto, o servidor confere o tipo pelos bytes
export function uploadProductPicture(publicId: string, picture: Blob): Promise<MyProduct> {
  return apiFetch<MyProduct>(`/products/${publicId}/picture`, {
    method: "POST",
    body: picture,
    headers: { "Content-Type": "image/jpeg" },
  });
}

// a foto enviada fica na API, as outras são links de fora
export function isUploadedPicture(url: string | null | undefined): url is string {
  return url?.startsWith("/api/products/") ?? false;
}

export function deleteProduct(publicId: string): Promise<void> {
  return apiFetch<void>(`/products/${publicId}`, { method: "DELETE" }).catch(
    ignoreNotFound("Produto não encontrado"),
  );
}
