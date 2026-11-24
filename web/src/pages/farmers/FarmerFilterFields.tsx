import { XIcon } from "lucide-react";
import { useId, type FormEvent } from "react";
import {
  DISTANCES,
  MAX_PRODUCTS,
  type Distance,
  type FarmerFilters,
  type FarmerSort,
} from "../../api/farmers";
import { SecondaryButton } from "../../components/Button";
import { useSyncedValue } from "../../hooks/useSyncedValue";
import { withProduct } from "./farmerParams";

const INPUT_CLASSES =
  "h-14 min-w-0 flex-1 rounded-lg border border-stone-400 bg-white px-4 text-lg " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800";
const TOGGLE_CLASSES =
  "h-11 flex-1 rounded-full border border-stone-400 bg-white px-3 font-bold whitespace-nowrap " +
  "sm:flex-none sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-pressed:border-lime-800 aria-pressed:bg-lime-100 " +
  "aria-pressed:text-lime-800";
const CHIP_CLASSES =
  "flex min-h-11 items-center gap-2 rounded-full border border-lime-800 bg-lime-100 py-1 " +
  "pr-3 pl-4 text-left font-bold wrap-anywhere text-lime-900 hover:bg-lime-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-800";

function without(products: string[], product: string): string[] {
  return products.filter((item) => item !== product);
}

interface Option<Value> {
  value: Value;
  label: string;
}

const DISTANCE_OPTIONS: Option<Distance | null>[] = [
  ...DISTANCES.map((distance) => ({ value: distance, label: `Até ${distance} km` })),
  { value: null, label: "Qualquer distância" },
];
const SORT_OPTIONS: Option<FarmerSort>[] = [
  { value: "reputation", label: "Melhor avaliados" },
  { value: "distance", label: "Mais próximos" },
];

interface ToggleGroupProps<Value> {
  label: string;
  options: Option<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

function ToggleGroup<Value>({
  label,
  options,
  value,
  onChange,
}: Readonly<ToggleGroupProps<Value>>) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
      <span id={labelId} className="w-full text-lg font-bold sm:mr-2 sm:w-28">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={TOGGLE_CLASSES}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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

  function submit(event: FormEvent<HTMLFormElement>) {
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
          maxLength={200}
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
                  <button
                    type="button"
                    aria-label={`Remover ${product}`}
                    onClick={() => change({ products: without(products, product) })}
                    className={CHIP_CLASSES}
                  >
                    {product}
                    <XIcon aria-hidden="true" className="size-5 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ToggleGroup
        label="Distância"
        options={DISTANCE_OPTIONS}
        value={filters.distance}
        onChange={(distance) => change({ distance })}
      />
      <ToggleGroup
        label="Ordem"
        options={SORT_OPTIONS}
        value={filters.sort}
        onChange={(sort) => change({ sort })}
      />
    </div>
  );
}
