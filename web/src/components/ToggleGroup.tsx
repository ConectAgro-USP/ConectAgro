import { useId } from "react";

// no celular os botões dividem a largura, e quebram de linha se não couberem
const TOGGLE_CLASSES =
  "h-11 flex-1 rounded-full border border-stone-400 bg-white px-2 font-bold whitespace-nowrap " +
  "sm:flex-none sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-pressed:border-lime-800 aria-pressed:bg-lime-100 " +
  "aria-pressed:text-lime-800 disabled:cursor-not-allowed disabled:opacity-60";

export interface ToggleOption<Value> {
  value: Value;
  label: string;
}

interface ToggleGroupProps<Value> {
  label: string;
  // sem rótulo à vista, quando os botões já dizem o que escolhem
  hideLabel?: boolean;
  labelClassName?: string;
  options: ToggleOption<Value>[];
  value: Value;
  disabled?: boolean;
  className?: string;
  onChange: (value: Value) => void;
}

export function ToggleGroup<Value>({
  label,
  hideLabel = false,
  labelClassName = "sm:w-auto",
  options,
  value,
  disabled = false,
  className = "",
  onChange,
}: Readonly<ToggleGroupProps<Value>>) {
  const labelId = useId();

  return (
    <div
      role="group"
      aria-labelledby={hideLabel ? undefined : labelId}
      aria-label={hideLabel ? label : undefined}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {!hideLabel && (
        <span id={labelId} className={`w-full text-lg font-bold sm:mr-2 ${labelClassName}`}>
          {label}
        </span>
      )}
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={TOGGLE_CLASSES}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
