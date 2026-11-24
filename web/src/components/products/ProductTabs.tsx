import type { MyProductCounts } from "../../api/products";
import type { ProductTab } from "./productState";

const TAB_CLASSES =
  "flex h-12 items-center gap-2 rounded-full border px-5 font-bold focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-lime-800";
const CHOSEN_CLASSES = "border-stone-800 bg-stone-800 text-white";
const OTHER_CLASSES = "border-stone-400 bg-white hover:bg-stone-100";
const TABS: { id: ProductTab; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "available", label: "Disponíveis" },
  { id: "hidden", label: "Fora do catálogo" },
];

interface ProductTabsProps {
  counts: MyProductCounts;
  chosen: ProductTab;
  onChoose: (tab: ProductTab) => void;
}

export function ProductTabs({ counts, chosen, onChoose }: Readonly<ProductTabsProps>) {
  return (
    <div role="group" aria-label="Mostrar produtos" className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={tab.id === chosen}
          onClick={() => onChoose(tab.id)}
          className={`${TAB_CLASSES} ${tab.id === chosen ? CHOSEN_CLASSES : OTHER_CLASSES}`}
        >
          {tab.label}
          <span className="tabular-nums">{counts[tab.id]}</span>
        </button>
      ))}
    </div>
  );
}
