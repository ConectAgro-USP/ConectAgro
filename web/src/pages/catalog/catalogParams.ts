import { MAX_SEARCH_TERM } from "../../api/pagination";
import {
  CATALOG_SORTS,
  NO_CATALOG_FILTERS,
  type CatalogFilters,
  type CatalogSort,
} from "../../api/products";

// o maior inteiro que a API aceita
const INT4_MAX = 2_147_483_647;

export const SORT_LABELS: Record<CatalogSort, string> = {
  relevance: "Mais relevantes",
  lowest_price: "Menor preço",
  latest_expiration: "Validade mais longa",
  highest_rating: "Melhor avaliados",
};

function isSort(value: string | null): value is CatalogSort {
  return CATALOG_SORTS.some((sort) => sort === value);
}

function isDay(value: string): boolean {
  const moment = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(moment.getTime()) && moment.toISOString().startsWith(value);
}

export function parseQuantity(value: string | null): number | null {
  const quantity = Number(value);
  const valid = value !== null && Number.isInteger(quantity) && quantity >= 1;
  return valid && quantity <= INT4_MAX ? quantity : null;
}

// um link editado à mão vira a busca válida mais próxima, sem erro da API
export function catalogFiltersOf(params: URLSearchParams): CatalogFilters {
  const sort = params.get("sort");
  const expirationFrom = params.get("expiration_from") ?? "";
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_SEARCH_TERM),
    sort: isSort(sort) ? sort : "relevance",
    expirationFrom: isDay(expirationFrom) ? expirationFrom : "",
    minQuantity: parseQuantity(params.get("min_quantity")),
  };
}

export function hasFilters(filters: CatalogFilters): boolean {
  return filters.q !== "" || filters.expirationFrom !== "" || filters.minQuantity !== null;
}

// a ordem escolhida fica, porque ela não esconde nenhum produto
export function clearFilters(filters: CatalogFilters): CatalogFilters {
  return { ...NO_CATALOG_FILTERS, sort: filters.sort };
}
