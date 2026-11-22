import { useId, useState } from "react";
import type { BuildingNeed } from "../api/interests";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { TitleBar } from "../components/TitleBar";
import { formatCount } from "../format";
import { useBuildingNeeds } from "../hooks/useBuildingNeeds";

const ORDER_BUTTON_CLASSES =
  "h-11 flex-1 rounded-full border border-stone-400 bg-white px-2 font-bold sm:flex-none " +
  "sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-pressed:border-lime-800 aria-pressed:bg-lime-100 " +
  "aria-pressed:text-lime-800";
const CARD_CLASSES =
  "flex items-start gap-4 rounded-3xl border border-stone-200 bg-stone-100 p-5 sm:px-6";
const ORDERS = [
  { descending: true, label: "Maior primeiro" },
  { descending: false, label: "Menor primeiro" },
];

function sellerOf({ product }: BuildingNeed): string {
  const names = [product.farmer.short_name, product.farmer.farm_name].filter(Boolean);
  return names.join(", ") || "Agricultor";
}

function totalOf(need: BuildingNeed): string {
  const residents = formatCount(
    need.interested_buyers_count,
    "morador interessado",
    "moradores interessados",
  );
  return `${need.total_quantity} kg no total, de ${residents}`;
}

export function BuildingNeeds() {
  const list = useBuildingNeeds();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const orderLabelId = useId();
  const needs = list.needs ?? [];
  const selected = needs.filter((need) => selectedIds.includes(need.product.public_id));
  const farmers = new Set(selected.map((need) => need.product.farmer.public_id)).size;

  function select(publicId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, publicId] : current.filter((id) => id !== publicId),
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Necessidades do prédio" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div
          role="group"
          aria-labelledby={orderLabelId}
          className="flex flex-wrap items-center gap-2 border-b border-stone-300 py-8"
        >
          <span id={orderLabelId} className="w-full text-lg font-bold sm:mr-2 sm:w-auto">
            Ordenar por quantidade total
          </span>
          {ORDERS.map(({ descending, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={descending === list.descending}
              onClick={() => list.sort(descending)}
              className={ORDER_BUTTON_CLASSES}
            >
              {label}
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <p className="pt-8 text-lg font-bold">
            {formatCount(selected.length, "produto selecionado", "produtos selecionados")}, de{" "}
            {formatCount(farmers, "agricultor", "agricultores")}
          </p>
        )}
        {list.needs?.length === 0 && (
          <p className="pt-12 text-center text-xl text-balance">
            Ainda não há interesses dos moradores. Quando um morador registrar interesse em um
            produto, ele aparece aqui.
          </p>
        )}
        {needs.length > 0 && (
          <ul className="space-y-4 pt-8">
            {needs.map((need) => (
              <li key={need.product.public_id} className={CARD_CLASSES}>
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${need.product.name} de ${sellerOf(need)}`}
                  checked={selectedIds.includes(need.product.public_id)}
                  onChange={(event) => select(need.product.public_id, event.target.checked)}
                  className="mt-0.5 size-6 shrink-0 accent-lime-800"
                />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold break-words">{need.product.name}</h2>
                  <p className="break-words text-stone-700">{sellerOf(need)}</p>
                  <p className="text-stone-600">{totalOf(need)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">{list.loading ? "Carregando..." : ""}</output>
          <FormError message={list.error} />
          {list.error && <SecondaryButton onClick={list.reload}>Tentar de novo</SecondaryButton>}
        </div>
      </div>
    </main>
  );
}
