import { FunnelIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { CATALOG_SORTS, type CatalogFilters, type CatalogSort } from "../../api/products";
import { PrimaryButton } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { useSyncedValue } from "../../hooks/useSyncedValue";
import { parseQuantity, SORT_LABELS } from "./catalogParams";

const SELECT_CLASSES =
  "h-14 w-full rounded-lg border border-stone-400 bg-white px-4 text-lg focus:border-lime-800 " +
  "focus:outline-1 focus:outline-lime-800 sm:w-60";
const FILTER_BUTTON_CLASSES =
  "flex h-14 shrink-0 items-center gap-2 rounded-full border border-stone-400 bg-white px-5 " +
  "font-bold focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-expanded:border-lime-800 aria-expanded:bg-lime-100 " +
  "aria-expanded:text-lime-900 sm:hidden";
const PANEL_CLASSES = "w-full gap-4 sm:flex sm:w-auto sm:flex-1 sm:flex-wrap sm:items-end";

interface CatalogControlsProps {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
}

function activeCount(filters: CatalogFilters): number {
  return [filters.expirationFrom !== "", filters.minQuantity !== null].filter(Boolean).length;
}

export function CatalogControls({ filters, onChange }: Readonly<CatalogControlsProps>) {
  const [open, setOpen] = useState(false);
  const sortId = useId();
  const panelId = useId();
  const active = activeCount(filters);
  const [day, setDay] = useSyncedValue(filters.expirationFrom);
  const [quantity, setQuantity] = useSyncedValue(String(filters.minQuantity ?? ""));

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onChange({ ...filters, expirationFrom: day, minQuantity: parseQuantity(quantity) });
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* até 1024 px a ordem fica numa linha e os filtros na de baixo */}
      <div className="min-w-0 flex-1 sm:w-full sm:flex-none lg:w-60">
        <label htmlFor={sortId} className="mb-2 block font-bold">
          Ordenar por
        </label>
        <select
          id={sortId}
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value as CatalogSort })}
          className={SELECT_CLASSES}
        >
          {CATALOG_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={FILTER_BUTTON_CLASSES}
      >
        <FunnelIcon aria-hidden="true" className="size-5" />
        {active === 0 ? "Filtrar" : `Filtros (${active})`}
      </button>
      <form
        id={panelId}
        aria-label="Filtros"
        onSubmit={apply}
        className={`${open ? "grid" : "hidden"} ${PANEL_CLASSES}`}
      >
        <div className="sm:w-52">
          <TextField
            label="Vence depois de"
            type="date"
            required={false}
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
        <div className="sm:w-44">
          <TextField
            label="Quantidade mínima"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required={false}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <PrimaryButton>Aplicar filtros</PrimaryButton>
      </form>
    </div>
  );
}
