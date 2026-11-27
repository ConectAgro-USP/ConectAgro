import { QUANTITY_CLASSES, digitsOnly } from "./buyBox";

interface QuantityFieldProps {
  stock: string;
  value: string;
  disabled: boolean;
  // sem dica quando o produto não pode ser escolhido
  hint: string | null;
  exceeds: boolean;
  onChange: (value: string) => void;
}

export function QuantityField({
  stock,
  value,
  disabled,
  hint,
  exceeds,
  onChange,
}: Readonly<QuantityFieldProps>) {
  return (
    <>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor="quantity-input" className="font-bold text-stone-900">
          Quantidade
        </label>
        <span className="font-medium text-stone-700">{stock}</span>
      </div>
      <input
        id="quantity-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          if (digitsOnly(event.target.value)) onChange(event.target.value);
        }}
        className={QUANTITY_CLASSES}
      />
      {hint && <p className="mt-1 text-stone-700">{hint}</p>}
      {exceeds && (
        <p role="alert" className="mt-1 font-bold text-red-700">
          A quantidade informada excede o estoque disponível.
        </p>
      )}
    </>
  );
}
