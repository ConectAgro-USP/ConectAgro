import { useId, type ReactNode } from "react";
import type { HistoryFilters, PurchaseStatus } from "../../api/history";
import { TextField } from "../TextField";

const SELECT_CLASSES =
  "h-14 w-full rounded-lg border border-stone-400 bg-white px-4 focus:border-lime-800 " +
  "focus:outline-1 focus:outline-lime-800";

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

function SelectField({ label, value, onChange, children }: Readonly<SelectFieldProps>) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASSES}
      >
        <option value="">Todos</option>
        {children}
      </select>
    </div>
  );
}

interface HistoryFilterFieldsProps {
  filters: HistoryFilters;
  onChange: (filters: HistoryFilters) => void;
  statusLabels: Record<PurchaseStatus, string>;
  counterpartLabel: string;
  counterparts: Map<string, string>;
}

export function HistoryFilterFields({
  filters,
  onChange,
  statusLabels,
  counterpartLabel,
  counterparts,
}: Readonly<HistoryFilterFieldsProps>) {
  function change(changes: Partial<HistoryFilters>) {
    onChange({ ...filters, ...changes });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField
        label="Status"
        value={filters.status}
        onChange={(status) => change({ status })}
      >
        {Object.entries(statusLabels).map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Pedidos a partir de"
        type="date"
        required={false}
        max={filters.dateTo}
        value={filters.dateFrom}
        onChange={(event) => change({ dateFrom: event.target.value })}
      />
      <TextField
        label="Pedidos até"
        type="date"
        required={false}
        min={filters.dateFrom}
        value={filters.dateTo}
        onChange={(event) => change({ dateTo: event.target.value })}
      />
      <SelectField
        label={counterpartLabel}
        value={filters.counterpartId}
        onChange={(counterpartId) => change({ counterpartId })}
      >
        {[...counterparts].map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
