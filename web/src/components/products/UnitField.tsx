import { useId } from "react";
import type { ProductUnit } from "../../api/products";

const SELECT_CLASSES =
  "h-14 w-full rounded-lg border border-stone-400 bg-white px-4 focus:border-lime-800 " +
  "focus:outline-1 focus:outline-lime-800";

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
}

export function UnitField({ value, onChange }: Readonly<UnitFieldProps>) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold">
        Vendido por
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as ProductUnit)}
        className={SELECT_CLASSES}
      >
        {Object.entries(UNIT_LABELS).map(([unit, label]) => (
          <option key={unit} value={unit}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
