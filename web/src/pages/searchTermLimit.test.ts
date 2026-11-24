import { MAX_SEARCH_TERM } from "../api/pagination";
import { catalogFiltersOf } from "./catalog/catalogParams";
import { farmerFiltersOf } from "./farmers/farmerParams";

const LONG = "a".repeat(MAX_SEARCH_TERM + 5);

describe("search term limit", () => {
  it("cuts the catalog search of an edited link to the API limit", () => {
    const filters = catalogFiltersOf(new URLSearchParams({ q: LONG }));

    expect(filters.q).toHaveLength(MAX_SEARCH_TERM);
  });

  it("cuts the farmer name and products of an edited link to the API limit", () => {
    const filters = farmerFiltersOf(new URLSearchParams({ name: LONG, products: LONG }));

    expect(filters.name).toHaveLength(MAX_SEARCH_TERM);
    expect(filters.products).toEqual(["a".repeat(MAX_SEARCH_TERM)]);
  });
});
