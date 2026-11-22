import { apiFetch } from "./client";
import {
  fetchHistory,
  type HistoryFilters,
  type HistoryPage,
  type PurchaseItem,
  type PurchaseStatus,
} from "./history";

export interface PurchasePart {
  public_id: string;
  farmer_public_id: string;
  farmer_short_name: string;
  status: PurchaseStatus;
  closed_at: string | null;
  total: string;
  purchase_products: PurchaseItem[];
}

export interface BuildingPurchase {
  public_id: string;
  status: PurchaseStatus;
  created_at: string;
  expected_delivery_date: string;
  closed_at: string | null;
  total: string;
  purchase_parts: PurchasePart[];
}

export interface PurchaseInput {
  expected_delivery_date: string;
  items: { product_public_id: string; quantity: number }[];
}

export function listBuildingPurchases(
  filters: HistoryFilters,
  page: number,
): Promise<HistoryPage<BuildingPurchase>> {
  return fetchHistory("/apartments/me/purchases", "farmer_public_id", filters, page);
}

export function createPurchase(purchase: PurchaseInput): Promise<unknown> {
  return apiFetch<unknown>("/purchases", { method: "POST", body: JSON.stringify(purchase) });
}
