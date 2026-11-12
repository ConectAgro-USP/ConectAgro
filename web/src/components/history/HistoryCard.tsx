import { ChevronDownIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { PurchaseItem, PurchaseStatus } from "../../api/history";
import { formatDate, formatDay, formatMoney, formatNames } from "./format";

const STATUS_CLASSES: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "bg-amber-700",
  ENTREGUE: "bg-lime-700",
  CANCELADA: "bg-stone-500",
};
const STATUS_TAB_CLASSES =
  "absolute top-0 right-0 rounded-tr-4xl rounded-bl-2xl px-5 py-1.5 text-lg font-bold text-white";
const AVATAR_CLASSES =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xl " +
  "text-white uppercase ring-4 ring-stone-200 sm:size-16";
const DETAILS_BUTTON_CLASSES =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg hover:bg-stone-300 " +
  "focus-visible:outline-2 focus-visible:outline-lime-800";

interface HistoryCardProps {
  names: string[];
  items: PurchaseItem[];
  status: PurchaseStatus;
  statusLabel: string;
  orderedAt: string;
  expectedOn: string;
  closedAt: string | null;
  total: string;
  children: ReactNode;
}

export function HistoryCard({
  names,
  items,
  status,
  statusLabel,
  orderedAt,
  expectedOn,
  closedAt,
  total,
  children,
}: Readonly<HistoryCardProps>) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  // dois agricultores da mesma compra podem ter o mesmo nome ou o mesmo produto
  const people = [...new Set(names)];
  const products = [...new Set(items.map((item) => item.product_name))];

  return (
    <li className="relative rounded-4xl bg-stone-200 px-6 pt-14 pb-4 sm:px-10 sm:pt-8">
      <p className={`${STATUS_TAB_CLASSES} ${STATUS_CLASSES[status]}`}>{statusLabel}</p>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-5">
          <div aria-hidden="true" className="flex -space-x-3">
            {people.map((name) => (
              <span key={name} className={AVATAR_CLASSES}>
                {name.charAt(0)}
              </span>
            ))}
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl">{formatNames(people)}</h3>
            <p className="line-clamp-2 text-stone-600">{formatNames(products)}</p>
          </div>
        </div>
        <dl className="text-lg sm:pt-8 sm:text-right">
          <div className="flex gap-2 sm:justify-end">
            <dt>Data do pedido:</dt>
            <dd className="tabular-nums">{formatDay(orderedAt)}</dd>
          </div>
          {status === "EM PROGRESSO" && (
            <div className="flex gap-2 sm:justify-end">
              <dt>Entrega prevista:</dt>
              <dd className="tabular-nums">{formatDate(expectedOn)}</dd>
            </div>
          )}
          {closedAt && (
            <div className="flex gap-2 sm:justify-end">
              <dt>{status === "CANCELADA" ? "Data do cancelamento:" : "Data de entrega:"}</dt>
              <dd className="tabular-nums">{formatDay(closedAt)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="mt-4 text-center">
        {/* pedido cancelado não tem valor a pagar, então a tela não mostra */}
        {status !== "CANCELADA" && (
          <p className="text-xl font-bold">
            {status === "EM PROGRESSO" ? "Valor combinado" : "Valor"}
            <span className="ml-2 tabular-nums">{formatMoney(total)}</span>
          </p>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
          className={DETAILS_BUTTON_CLASSES}
        >
          {open ? "Ocultar detalhes" : "Ver detalhes"}
          <ChevronDownIcon aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      </div>
      {/* fica sempre no HTML para o botão ter para onde apontar */}
      <div id={detailsId} hidden={!open} className="mt-2 border-t border-stone-400 py-4">
        {children}
      </div>
    </li>
  );
}
