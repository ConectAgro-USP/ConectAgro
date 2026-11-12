import { apiFetch } from "./client";

export type PurchaseStatus = "EM PROGRESSO" | "ENTREGUE" | "CANCELADA";

// a API manda os valores em reais como texto
export interface PurchaseItem {
  product_public_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface HistoryPage<Item> {
  items: Item[];
  page: number;
  total_pages: number;
  realized_total: string;
  expected_total: string;
}

// o que a pessoa escolheu nos filtros, vazio quer dizer sem filtro
export interface HistoryFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  counterpartId: string;
}

export const NO_FILTERS: HistoryFilters = {
  status: "",
  dateFrom: "",
  dateTo: "",
  counterpartId: "",
};

export function fetchHistory<Item>(
  path: string,
  counterpartParam: string,
  filters: HistoryFilters,
  page: number,
): Promise<HistoryPage<Item>> {
  const query = new URLSearchParams({ page: String(page) });
  const chosen = {
    status: filters.status,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    [counterpartParam]: filters.counterpartId,
  };
  for (const [name, value] of Object.entries(chosen)) {
    if (value !== "") {
      query.set(name, value);
    }
  }
  return apiFetch<HistoryPage<Item>>(`${path}?${query}`);
}
