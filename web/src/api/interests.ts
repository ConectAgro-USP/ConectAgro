import { apiFetch, ignoreNotFound } from "./client";
import { fetchAllPages, LARGEST_PAGE, pageQuery, type Page } from "./pagination";
import type { ProductDetail, ProductUnit } from "./products";

export interface InterestInput {
  product_public_id: string;
  quantity: number;
}

// só a parte em andamento ou entregue, a cancelada devolve o interesse aberto
export interface InterestPurchase {
  public_id: string;
  created_at: string;
  expected_delivery_date: string;
  status: "EM PROGRESSO" | "ENTREGUE";
  closed_at: string | null;
}

export interface InterestProduct {
  picture_url: string | null;
  price: string;
  unit: ProductUnit;
  quantity: number;
  expiration_date: string;
  is_available: boolean;
  farmer: { public_id: string; short_name: string; farm_name: string | null };
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
  purchase: InterestPurchase | null;
  // nulo quando o agricultor apagou o produto
  product: InterestProduct | null;
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

export interface MyInterestsPage extends Page<Interest> {
  // soma dos interesses abertos em produtos à venda, de todas as páginas
  estimated_total: string;
}

export function listMyInterests(page: number, pageSize?: number): Promise<MyInterestsPage> {
  return apiFetch<MyInterestsPage>(`/interests/me?${pageQuery(page, pageSize)}`);
}

export function listAllMyInterests(): Promise<Interest[]> {
  return fetchAllPages((page) => listMyInterests(page, LARGEST_PAGE));
}

// o morador tem no máximo um interesse por produto
export async function findMyInterest(productPublicId: string): Promise<Interest | null> {
  const query = pageQuery(1);
  query.set("product_public_id", productPublicId);
  const { items } = await apiFetch<MyInterestsPage>(`/interests/me?${query}`);
  return items[0] ?? null;
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

export function listBuildingNeeds(descending: boolean, page: number): Promise<Page<BuildingNeed>> {
  const query = pageQuery(page);
  query.set("descending", String(descending));
  return apiFetch<Page<BuildingNeed>>(`/apartments/me/needs?${query}`);
}
