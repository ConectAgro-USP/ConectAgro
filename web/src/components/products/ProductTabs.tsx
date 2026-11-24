import type { MyProduct } from "../../api/products";
import { inTab, type ProductTab } from "./productState";

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
  products: MyProduct[];
  chosen: ProductTab;
  onChoose: (tab: ProductTab) => void;
}

export function ProductTabs({ products, chosen, onChoose }: Readonly<ProductTabsProps>) {
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
          <span className="tabular-nums">
            {products.filter((product) => inTab(tab.id, product)).length}
          </span>
        </button>
      ))}
    </div>
  );
}
