import type { PurchaseItem } from "../../api/history";
import { formatMoney } from "../../format";

export function ItemLines({ items }: Readonly<{ items: PurchaseItem[] }>) {
  return (
    <ul className="divide-y divide-dashed divide-stone-400">
      {items.map((item) => (
        <li
          key={item.product_public_id}
          className="flex flex-wrap items-baseline justify-between gap-x-6 py-2"
        >
          <span>
            <span className="font-bold">{item.product_name}</span>{" "}
            <span className="text-stone-600">
              {item.quantity} × {formatMoney(item.unit_price)}
            </span>
          </span>
          <span className="font-bold tabular-nums">{formatMoney(item.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}
