import { useId, type SubmitEvent } from "react";
import {
  DISTANCES,
  MAX_PRODUCTS,
  type Distance,
  type FarmerFilters,
  type FarmerSort,
} from "../../api/farmers";
import { MAX_SEARCH_TERM } from "../../api/pagination";
import { SecondaryButton } from "../../components/Button";
import { FilterChip } from "../../components/FilterChip";
import { ToggleGroup, type ToggleOption } from "../../components/ToggleGroup";
import { useSyncedValue } from "../../hooks/useSyncedValue";
import { withProduct } from "./farmerParams";

const INPUT_CLASSES =
  "h-14 min-w-0 flex-1 rounded-lg border border-stone-400 bg-white px-4 text-lg " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800";
// as duas escolhas alinham os botões pela largura do rótulo
const LABEL_CLASSES = "sm:w-28";

function without(products: string[], product: string): string[] {
  return products.filter((item) => item !== product);
}

const DISTANCE_OPTIONS: ToggleOption<Distance | null>[] = [
  ...DISTANCES.map((distance) => ({ value: distance, label: `Até ${distance} km` })),
  { value: null, label: "Qualquer distância" },
];
const SORT_OPTIONS: ToggleOption<FarmerSort>[] = [
  { value: "reputation", label: "Melhor avaliados" },
  { value: "distance", label: "Mais próximos" },
];

interface TextSearchProps {
  label: string;
  // o valor aplicado, que o campo mostra de novo quando o endereço muda
  applied: string;
  action: string;
  clearOnSubmit?: boolean;
  onSubmit: (value: string) => void;
}

function TextSearch({
  label,
  applied,
  action,
  clearOnSubmit = false,
  onSubmit,
}: Readonly<TextSearchProps>) {
  const id = useId();
  const [value, setValue] = useSyncedValue(applied);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(value);
    if (clearOnSubmit) setValue("");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={id} className="mb-2 block text-lg font-bold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="search"
          maxLength={MAX_SEARCH_TERM}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={INPUT_CLASSES}
        />
        <SecondaryButton type="submit" className="shrink-0">
          {action}
        </SecondaryButton>
      </div>
    </form>
  );
}

interface FarmerFilterFieldsProps {
  filters: FarmerFilters;
  onChange: (filters: FarmerFilters) => void;
}

export function FarmerFilterFields({ filters, onChange }: Readonly<FarmerFilterFieldsProps>) {
  const { products } = filters;

  function change(changes: Partial<FarmerFilters>) {
    onChange({ ...filters, ...changes });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextSearch
          label="Nome do agricultor ou do sítio"
          applied={filters.name}
          action="Buscar"
          onSubmit={(name) => change({ name: name.trim() })}
        />
        <div>
          {products.length < MAX_PRODUCTS ? (
            <TextSearch
              label="Vende"
              applied=""
              clearOnSubmit
              action="Adicionar"
              onSubmit={(product) => change({ products: withProduct(products, product) })}
            />
          ) : (
            <p className="text-lg">Você já escolheu {MAX_PRODUCTS} produtos, o máximo.</p>
          )}
          {products.length > 0 && (
            <ul aria-label="Produtos procurados" className="flex flex-wrap gap-2 pt-3">
              {products.map((product) => (
                <li key={product}>
                  <FilterChip
                    label={product}
                    onRemove={() => change({ products: without(products, product) })}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ToggleGroup
        label="Distância"
        labelClassName={LABEL_CLASSES}
        options={DISTANCE_OPTIONS}
        value={filters.distance}
        onChange={(distance) => change({ distance })}
      />
      <ToggleGroup
        label="Ordem"
        labelClassName={LABEL_CLASSES}
        options={SORT_OPTIONS}
        value={filters.sort}
        onChange={(sort) => change({ sort })}
      />
    </div>
  );
}
