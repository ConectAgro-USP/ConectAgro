import type { ReactNode } from "react";
import { groupByMonth } from "../../format";

interface HistoryMonthsProps<Item> {
  items: Item[];
  dateOf: (item: Item) => string;
  children: (item: Item) => ReactNode;
}

export function HistoryMonths<Item>({
  items,
  dateOf,
  children,
}: Readonly<HistoryMonthsProps<Item>>) {
  return groupByMonth(items, dateOf).map(([month, monthItems]) => (
    <section key={month} className="pt-14">
      <h2 className="border-b border-stone-400 pb-3 text-center text-2xl font-bold first-letter:uppercase">
        {month}
      </h2>
      <ul className="space-y-4 pt-6">{monthItems.map((item) => children(item))}</ul>
    </section>
  ));
}
