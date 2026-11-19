import { useId } from "react";
import { DISTANCES, searchNearbyFarmers, type Distance } from "../api/farmers";
import { SecondaryButton } from "../components/Button";
import { FarmerCard } from "../components/farmers/FarmerCard";
import { FormError } from "../components/FormError";
import { TitleBar } from "../components/TitleBar";
import { formatCount } from "../format";
import { usePages } from "../hooks/usePages";

const FIRST_DISTANCE: Distance = 15;
const DISTANCE_BUTTON_CLASSES =
  "h-11 flex-1 rounded-full border border-stone-400 bg-white px-2 font-bold sm:flex-none " +
  "sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-pressed:border-lime-800 aria-pressed:bg-lime-100 " +
  "aria-pressed:text-lime-800";

interface DistanceFilterProps {
  value: Distance;
  onChange: (distance: Distance) => void;
}

function DistanceFilter({ value, onChange }: Readonly<DistanceFilterProps>) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
      <span id={labelId} className="w-full text-lg font-bold sm:mr-2 sm:w-auto">
        Distância
      </span>
      {DISTANCES.map((distance) => (
        <button
          key={distance}
          type="button"
          aria-pressed={distance === value}
          onClick={() => onChange(distance)}
          className={DISTANCE_BUTTON_CLASSES}
        >
          Até {distance} km
        </button>
      ))}
    </div>
  );
}

export function NearbyFarmers() {
  const farmers = usePages(searchNearbyFarmers, FIRST_DISTANCE, {
    keyOf: (farmer) => farmer.public_id,
  });
  const distance = farmers.search;
  const total = farmers.lastPage?.total ?? 0;
  const empty = !farmers.loading && farmers.error === "" && farmers.items.length === 0;
  const largerDistance = DISTANCES.find((option) => option > distance);

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Agricultores" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="space-y-3 border-b border-stone-300 py-8">
          <DistanceFilter value={distance} onChange={farmers.changeSearch} />
          {/* a BrasilAPI dá o centro da cidade para muitos CEPs, então a conta é aproximada */}
          <p className="text-stone-600">
            Distância em linha reta entre o centro da sua cidade e o centro da cidade do agricultor, aproximada.
          </p>
        </div>
        {total > 0 && (
          <p className="pt-8 text-lg text-stone-600">
            {formatCount(total, "agricultor", "agricultores")} a até {distance} km do seu
            prédio
          </p>
        )}
        {farmers.items.length > 0 && (
          <ul className="space-y-4 pt-4">
            {farmers.items.map((farmer) => (
              <FarmerCard key={farmer.public_id} farmer={farmer} />
            ))}
          </ul>
        )}
        {empty && (
          <div className="flex flex-col items-center gap-6 pt-12 text-center text-xl">
            <p>Nenhum agricultor a até {distance} km do seu prédio</p>
            {largerDistance !== undefined && (
              <SecondaryButton onClick={() => farmers.changeSearch(largerDistance)}>
                Procurar até {largerDistance} km
              </SecondaryButton>
            )}
          </div>
        )}
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">
            {farmers.loading ? "Calculando as distâncias..." : ""}
          </output>
          <FormError message={farmers.error} />
          {farmers.error && (
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
