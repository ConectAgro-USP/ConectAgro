import { useSearchParams } from "react-router";
import { DISTANCES, searchNearbyFarmers, type FarmerFilters } from "../api/farmers";
import { SecondaryButton } from "../components/Button";
import { FarmerCard } from "../components/farmers/FarmerCard";
import { FormError } from "../components/FormError";
import { TitleBar } from "../components/TitleBar";
import { formatCount } from "../format";
import { useInterestLookup } from "../hooks/useInterestLookup";
import { usePages } from "../hooks/usePages";
import { FarmerFilterFields } from "./farmers/FarmerFilterFields";
import { farmerFiltersOf, farmerParamsOf } from "./farmers/farmerParams";

// o prédio sem o CEP no mapa não tem de onde medir a distância
const NO_BUILDING_POINT = 409;

// a busca vai como texto, que o usePages compara pelo valor
function loadFarmersPage(search: string, page: number) {
  return searchNearbyFarmers(farmerFiltersOf(new URLSearchParams(search)), page);
}

function totalText(total: number, filters: FarmerFilters): string {
  const count = formatCount(total, "agricultor", "agricultores");
  if (filters.distance === null) {
    return `${count} ${total === 1 ? "encontrado" : "encontrados"}`;
  }
  return `${count} a até ${filters.distance} km do seu prédio`;
}

function emptyText(filters: FarmerFilters): string {
  const where =
    filters.distance === null ? "encontrado" : `a até ${filters.distance} km do seu prédio`;
  const filtered = filters.name !== "" || filters.products.length > 0;
  return `Nenhum agricultor ${where}${filtered ? " com esses filtros" : ""}`;
}

function loadingText(filters: FarmerFilters): string {
  const measures = filters.distance !== null || filters.sort === "distance";
  return measures ? "Calculando as distâncias..." : "Procurando os agricultores...";
}

export function NearbyFarmers() {
  const [params, setParams] = useSearchParams();
  const filters = farmerFiltersOf(params);
  const search = farmerParamsOf(filters).toString();
  const farmers = usePages(loadFarmersPage, search, { keyOf: (farmer) => farmer.public_id });
  const interests = useInterestLookup();
  // voltar ou abrir um link troca o endereço, e a lista segue
  if (farmers.search !== search) {
    farmers.changeSearch(search);
  }
  const { distance } = filters;
  const total = farmers.lastPage?.total ?? 0;
  const empty = !farmers.loading && farmers.error === "" && farmers.items.length === 0;
  const largerDistance = DISTANCES.find((option) => distance !== null && option > distance);
  const filtered = filters.name !== "" || filters.products.length > 0;
  const noBuildingPoint = farmers.errorStatus === NO_BUILDING_POINT;

  function changeFilters(next: FarmerFilters) {
    const nextSearch = farmerParamsOf(next);
    if (nextSearch.toString() !== search) setParams(nextSearch);
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Agricultores" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="space-y-4 border-b border-stone-300 py-8">
          <FarmerFilterFields filters={filters} onChange={changeFilters} />
          {/* a BrasilAPI dá o centro da cidade para muitos CEPs, então a conta é aproximada */}
          <p className="text-stone-600">
            Distância em linha reta entre o centro da sua cidade e o centro da cidade do agricultor, aproximada.
          </p>
        </div>
        {total > 0 && <p className="pt-8 text-lg text-stone-600">{totalText(total, filters)}</p>}
        {farmers.items.length > 0 && (
          <ul className="space-y-4 pt-4">
            {farmers.items.map((farmer) => (
              <FarmerCard key={farmer.public_id} farmer={farmer} interests={interests} />
            ))}
          </ul>
        )}
        {empty && (
          <div className="flex flex-col items-center gap-6 pt-12 text-center text-xl">
            <p>{emptyText(filters)}</p>
            {largerDistance !== undefined && (
              <SecondaryButton
                onClick={() => changeFilters({ ...filters, distance: largerDistance })}
              >
                Procurar até {largerDistance} km
              </SecondaryButton>
            )}
            {distance === DISTANCES.at(-1) && (
              <SecondaryButton onClick={() => changeFilters({ ...filters, distance: null })}>
                Procurar em qualquer distância
              </SecondaryButton>
            )}
            {filtered && (
              <SecondaryButton
                onClick={() => changeFilters({ ...filters, name: "", products: [] })}
              >
                Limpar filtros
              </SecondaryButton>
            )}
          </div>
        )}
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">
            {farmers.loading ? loadingText(filters) : ""}
          </output>
          <FormError message={farmers.error} />
          {noBuildingPoint && (
            <SecondaryButton
              onClick={() => changeFilters({ ...filters, distance: null, sort: "reputation" })}
            >
              Ver agricultores sem a distância
            </SecondaryButton>
          )}
          {farmers.error && !noBuildingPoint && (
            <SecondaryButton onClick={farmers.retry}>Tentar de novo</SecondaryButton>
          )}
          {farmers.hasMore && !farmers.loading && !farmers.error && (
            <SecondaryButton onClick={farmers.loadMore}>Mostrar mais agricultores</SecondaryButton>
          )}
        </div>
      </div>
    </main>
  );
}
