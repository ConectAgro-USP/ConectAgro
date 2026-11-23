import {
  fetchHistory,
  type HistoryFilters,
  type HistoryPage,
  type PurchaseItem,
  type PurchaseStatus,
} from "./history";

export interface Sale {
  purchase_public_id: string;
  apartment_public_id: string;
  building_name: string;
  purchased_at: string;
  expected_delivery_date: string;
  status: PurchaseStatus;
  closed_at: string | null;
  total: string;
  purchase_products: PurchaseItem[];
}

export function listSales(filters: HistoryFilters, page: number): Promise<HistoryPage<Sale>> {
  return fetchHistory("/farmers/me/sales", "apartment_public_id", filters, page);
}
