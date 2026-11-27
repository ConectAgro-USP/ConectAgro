import { XIcon } from "lucide-react";

const CHIP_CLASSES =
  "flex min-h-11 items-center gap-2 rounded-full border border-lime-800 bg-lime-100 py-1 " +
  "pr-3 pl-4 text-left font-bold wrap-anywhere text-lime-900 hover:bg-lime-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-800";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

// um filtro aplicado, que sai com um toque
export function FilterChip({ label, onRemove }: Readonly<FilterChipProps>) {
  return (
    <button
      type="button"
      aria-label={`Remover ${label}`}
      onClick={onRemove}
      className={CHIP_CLASSES}
    >
      {label}
      <XIcon aria-hidden="true" className="size-5 shrink-0" />
    </button>
  );
}
