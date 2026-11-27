import { ShoppingCartIcon } from "lucide-react";
import { NavLink } from "react-router";
import { formatCount } from "../format";
import { useCart } from "../hooks/useCart";
import { HEADER_ACTION_CLASSES } from "./headerClasses";

const LINK_CLASSES = `${HEADER_ACTION_CLASSES} shrink-0`;
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
