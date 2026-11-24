import { XIcon } from "lucide-react";
import type { CatalogFilters } from "../../api/products";
import { formatFullDate } from "../../format";
import { clearFilters } from "./catalogParams";

const CHIP_CLASSES =
  "flex min-h-11 items-center gap-2 rounded-full border border-lime-800 bg-lime-100 py-1 " +
  "pr-3 pl-4 text-left font-bold wrap-anywhere text-lime-900 hover:bg-lime-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-800";
const CLEAR_CLASSES =
  "min-h-11 rounded px-2 font-bold text-lime-800 underline focus-visible:outline-2 " +
  "focus-visible:outline-lime-800";

interface Chip {
  label: string;
  without: Partial<CatalogFilters>;
}

function chipsOf(filters: CatalogFilters): Chip[] {
  const chips: Chip[] = [];
  if (filters.q) {
    chips.push({ label: `Busca: ${filters.q}`, without: { q: "" } });
  }
  if (filters.expirationFrom) {
    const day = formatFullDate(filters.expirationFrom);
    chips.push({ label: `Vence depois de ${day}`, without: { expirationFrom: "" } });
  }
  if (filters.minQuantity !== null) {
    const label = `Quantidade mínima: ${filters.minQuantity}`;
    chips.push({ label, without: { minQuantity: null } });
  }
  return chips;
}

interface FilterChipsProps {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
}

export function FilterChips({ filters, onChange }: Readonly<FilterChipsProps>) {
  const chips = chipsOf(filters);
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-5">
      <ul aria-label="Filtros aplicados" className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.label}>
            <button
              type="button"
              aria-label={`Remover ${chip.label}`}
              onClick={() => onChange({ ...filters, ...chip.without })}
              className={CHIP_CLASSES}
            >
              {chip.label}
              <XIcon aria-hidden="true" className="size-5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange(clearFilters(filters))}
        className={CLEAR_CLASSES}
      >
        Limpar filtros
      </button>
    </div>
  );
}
