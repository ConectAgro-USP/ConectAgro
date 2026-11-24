import { ShoppingCartIcon } from "lucide-react";
import { NavLink } from "react-router";
import { formatCount } from "../format";
import { useCart } from "../hooks/useCart";

const LINK_CLASSES =
  "flex h-12 shrink-0 items-center gap-2 rounded-full px-3 font-bold whitespace-nowrap " +
  "text-stone-800 hover:bg-stone-100 aria-[current=page]:bg-lime-100 " +
  "aria-[current=page]:text-lime-900 focus-visible:outline-2 focus-visible:outline-lime-800";
const COUNT_CLASSES =
  "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm tabular-nums";

// só o síndico tem carrinho, e o número diz quantos produtos estão nele
export function CartLink() {
  const cart = useCart();
  if (!cart.enabled) return null;
  const count = cart.items.length;

  return (
    <NavLink
      to="/carrinho"
      aria-label={`Carrinho, ${formatCount(count, "item", "itens")}`}
      className={LINK_CLASSES}
    >
      <ShoppingCartIcon aria-hidden="true" className="size-6 shrink-0" />
      <span className="hidden md:inline">Carrinho</span>
      <span
        className={`${COUNT_CLASSES} ${count > 0 ? "bg-lime-800 text-white" : "bg-stone-200"}`}
      >
        {count}
      </span>
    </NavLink>
  );
}
