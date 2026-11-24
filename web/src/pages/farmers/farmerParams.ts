import { MAX_SEARCH_TERM } from "../../api/pagination";
import {
  DISTANCES,
  MAX_PRODUCTS,
  type Distance,
  type FarmerFilters,
} from "../../api/farmers";

export const FIRST_DISTANCE: Distance = 15;
// no endereço, a busca sem raio fica marcada com esta palavra
const ANY_DISTANCE = "qualquer";

function distanceOf(value: string | null): Distance | null {
  if (value === ANY_DISTANCE) return null;
  return DISTANCES.find((distance) => String(distance) === value) ?? FIRST_DISTANCE;
}

export function sameProduct(first: string, second: string): boolean {
  return first.localeCompare(second, "pt-BR", { sensitivity: "accent" }) === 0;
}

export function withProduct(products: string[], product: string): string[] {
  const term = product.trim().slice(0, MAX_SEARCH_TERM);
  const known = products.some((current) => sameProduct(current, term));
  return term === "" || known || products.length >= MAX_PRODUCTS ? products : [...products, term];
}

// um link editado à mão vira a busca válida mais próxima, sem erro da API
export function farmerFiltersOf(params: URLSearchParams): FarmerFilters {
  return {
    name: (params.get("name") ?? "").trim().slice(0, MAX_SEARCH_TERM),
    products: params.getAll("products").reduce(withProduct, []),
    distance: distanceOf(params.get("max_distance_km")),
    sort: params.get("sort") === "distance" ? "distance" : "reputation",
  };
}

export function farmerParamsOf(filters: FarmerFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  for (const product of filters.products) params.append("products", product);
  if (filters.distance === null) params.set("max_distance_km", ANY_DISTANCE);
  if (filters.distance !== null && filters.distance !== FIRST_DISTANCE) {
    params.set("max_distance_km", String(filters.distance));
  }
  if (filters.sort === "distance") params.set("sort", "distance");
  return params;
}
