import { apiFetch } from "./client";
import { pageQuery, type Page } from "./pagination";
import type { ProductUnit } from "./products";
import type { ReceivedReview } from "./reviews";

export const DISTANCES = [5, 10, 15] as const;
export type Distance = (typeof DISTANCES)[number];
export type FarmerSort = "reputation" | "distance";
// a API aceita até 10 produtos na busca
export const MAX_PRODUCTS = 10;

// sem distância a busca não tem raio, e a lista vem de toda parte
export interface FarmerFilters {
  name: string;
  products: string[];
  distance: Distance | null;
  sort: FarmerSort;
}

export interface NearbyFarmer {
  public_id: string;
  name: string;
  farm_name: string | null;
  // vazia quando o agricultor ou o prédio não tem o CEP no mapa
  distance_km: number | null;
  available_products_count: number;
  average_rating: number | null;
  reviews_count: number;
  on_time_delivery_percentage: number | null;
}

export interface FarmerProduct {
  public_id: string;
  name: string;
  description: string | null;
  picture_url: string | null;
  quantity: number;
  price: string;
  unit: ProductUnit;
  expiration_date: string;
}

// a média e a contagem valem para todas, a página traz só as escritas
export interface FarmerReviews extends Page<ReceivedReview> {
  average_rating: number | null;
  reviews_count: number;
}

// o servidor monta e ordena a lista inteira de novo a cada pedido, seja qual for a página,
// então páginas grandes fazem menos pedidos e dão menos chance de a lista mudar entre elas
const FARMERS_PER_PAGE = 100;

export function searchNearbyFarmers(
  filters: FarmerFilters,
  page: number,
): Promise<Page<NearbyFarmer>> {
  const query = new URLSearchParams();
  if (filters.name) query.set("name", filters.name);
  for (const product of filters.products) query.append("products", product);
  if (filters.distance !== null) query.set("max_distance_km", String(filters.distance));
  if (filters.sort !== "reputation") query.set("sort", filters.sort);
  query.set("page", String(page));
  query.set("page_size", String(FARMERS_PER_PAGE));
  return apiFetch<Page<NearbyFarmer>>(`/farmers?${query}`);
}

export function listFarmerProducts(
  farmerPublicId: string,
  page: number,
): Promise<Page<FarmerProduct>> {
  const query = new URLSearchParams({ farmer_public_id: farmerPublicId, page: String(page) });
  return apiFetch<Page<FarmerProduct>>(`/products?${query}`);
}

export function getFarmerReviews(farmerPublicId: string, page: number): Promise<FarmerReviews> {
  const query = pageQuery(page);
  query.set("with_comment", "true");
  return apiFetch<FarmerReviews>(`/farmers/${farmerPublicId}/reviews?${query}`);
}
