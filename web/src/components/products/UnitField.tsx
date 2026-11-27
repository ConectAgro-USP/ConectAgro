import { useId } from "react";
import type { ProductUnit } from "../../api/products";

const SELECT_CLASSES =
  "h-14 w-full rounded-lg border border-stone-400 bg-white px-4 focus:border-lime-800 " +
  "focus:outline-1 focus:outline-lime-800 disabled:cursor-not-allowed " +
  "disabled:bg-stone-100 disabled:text-stone-700";
const LOCKED = "A unidade não muda depois que o produto recebeu interesse ou foi vendido.";

const UNIT_LABELS: Record<ProductUnit, string> = {
  kg: "Quilo (kg)",
  unidade: "Unidade",
  duzia: "Dúzia",
  maco: "Maço",
  litro: "Litro",
};

interface UnitFieldProps {
  value: ProductUnit;
  onChange: (unit: ProductUnit) => void;
  locked?: boolean;
}

export function UnitField({ value, onChange, locked = false }: Readonly<UnitFieldProps>) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold">
        Vendido por
      </label>
      <select
        id={id}
        value={value}
        disabled={locked}
        aria-describedby={locked ? hintId : undefined}
        onChange={(event) => onChange(event.target.value as ProductUnit)}
        className={SELECT_CLASSES}
      >
        {Object.entries(UNIT_LABELS).map(([unit, label]) => (
          <option key={unit} value={unit}>
            {label}
          </option>
        ))}
      </select>
      {locked && (
        <p id={hintId} className="mt-2 text-stone-600">
          {LOCKED}
        </p>
      )}
    </div>
  );
}
