import { useSearchParams } from "react-router";
import {
  catalogQueryOf,
  listCatalog,
  type CatalogFilters,
  type CatalogProduct,
} from "../api/products";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ShowMore } from "../components/ShowMore";
import { ProductRow } from "../components/farmers/ProductRow";
import { formatCount } from "../format";
import { useInterestLookup } from "../hooks/useInterestLookup";
import { usePages } from "../hooks/usePages";
import { CatalogBand } from "./catalog/CatalogBand";
import { CatalogControls } from "./catalog/CatalogControls";
import { catalogFiltersOf, clearFilters, hasFilters } from "./catalog/catalogParams";
import { FilterChips } from "./catalog/FilterChips";

function sellerOf(product: CatalogProduct): string {
  const names = [product.farmer_short_name, product.farmer_farm_name].filter(Boolean);
  return names.join(", ") || "Agricultor";
}

// a busca vai como texto, que o usePages compara pelo valor
function loadCatalogPage(search: string, page: number) {
  return listCatalog(catalogFiltersOf(new URLSearchParams(search)), page);
}

function emptyMessage(filters: CatalogFilters): string {
  const others = filters.expirationFrom !== "" || filters.minQuantity !== null;
  if (filters.q === "") {
    return "Nenhum produto encontrado com esses filtros.";
  }
  const found = `Nenhum produto encontrado para “${filters.q}”`;
  if (others) {
    return `${found} com esses filtros.`;
  }
  return `${found}. Confira a escrita ou busque outra palavra.`;
}

export function Catalog() {
  const [params, setParams] = useSearchParams();
  const filters = catalogFiltersOf(params);
  const search = catalogQueryOf(filters).toString();
  const products = usePages(loadCatalogPage, search, { keyOf: (product) => product.public_id });
  const interests = useInterestLookup();
  // voltar ou buscar no cabeçalho troca o endereço, e a lista segue
  if (products.search !== search) {
    products.changeSearch(search);
  }
  const ready = !products.loading && products.error === "";
  const empty = ready && products.items.length === 0;
  const filtered = hasFilters(filters);

  function changeFilters(next: CatalogFilters) {
    setParams(catalogQueryOf(next));
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <CatalogBand />
      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold wrap-anywhere sm:text-4xl">
            {filters.q ? `Resultados para “${filters.q}”` : "Produtos disponíveis"}
          </h1>
          {products.lastPage && (
            <p className="text-lg text-stone-700">
              {formatCount(products.lastPage.total, "produto", "produtos")}
            </p>
          )}
        </div>
        <div className="pt-5">
          <CatalogControls filters={filters} onChange={changeFilters} />
        </div>
        <FilterChips filters={filters} onChange={changeFilters} />
        {products.items.length > 0 && (
          <ul className="mt-6 space-y-4">
            {products.items.map((product) => (
              <ProductRow
                key={product.public_id}
                product={product}
                interest={interests.get(product.public_id)}
                seller={sellerOf(product)}
                rating={{
                  average: product.farmer_average_rating,
                  count: product.farmer_reviews_count,
                }}
              />
            ))}
          </ul>
        )}
        {empty && !filtered && <p className="mt-6 text-lg">Nenhum produto disponível agora.</p>}
        {empty && filtered && (
          <div className="flex flex-col items-center gap-6 pt-12 text-center text-xl">
            <p className="max-w-xl wrap-anywhere">{emptyMessage(filters)}</p>
            <SecondaryButton onClick={() => changeFilters(clearFilters(filters))}>
              Limpar filtros
            </SecondaryButton>
          </div>
        )}
        <div className="flex flex-col items-center gap-3 pt-6">
          <output className="text-stone-600">
            {products.loading ? "Carregando os produtos..." : ""}
          </output>
          <FormError message={products.error} />
          {products.error && (
            <SecondaryButton onClick={products.retry}>Tentar de novo</SecondaryButton>
          )}
          <ShowMore list={products} label="Mostrar mais produtos" />
        </div>
      </section>
    </main>
  );
}
