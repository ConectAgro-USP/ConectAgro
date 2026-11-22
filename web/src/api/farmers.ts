import { apiFetch } from "./client";
import type { Page } from "./pagination";

export const DISTANCES = [5, 10, 15] as const;
export type Distance = (typeof DISTANCES)[number];

export interface NearbyFarmer {
  public_id: string;
  name: string;
  farm_name: string | null;
  distance_km: number;
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
  expiration_date: string;
}

// o servidor monta e ordena a lista inteira de novo a cada pedido, seja qual for a página,
// então páginas grandes fazem menos pedidos e dão menos chance de a lista mudar entre elas
const FARMERS_PER_PAGE = 100;

export function searchNearbyFarmers(distance: Distance, page: number): Promise<Page<NearbyFarmer>> {
  const query = new URLSearchParams({
    max_distance_km: String(distance),
    page: String(page),
    page_size: String(FARMERS_PER_PAGE),
  });
  return apiFetch<Page<NearbyFarmer>>(`/farmers?${query}`);
}

export function listFarmerProducts(
  farmerPublicId: string,
  page: number,
): Promise<Page<FarmerProduct>> {
  const query = new URLSearchParams({ farmer_public_id: farmerPublicId, page: String(page) });
  return apiFetch<Page<FarmerProduct>>(`/products?${query}`);
}
