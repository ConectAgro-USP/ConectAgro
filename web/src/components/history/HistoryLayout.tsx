import { FunnelIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { NO_FILTERS, type HistoryFilters, type PurchaseStatus } from "../../api/history";
import type { History } from "../../hooks/useHistory";
import { SecondaryButton } from "../Button";
import { buttonClasses } from "../buttonClasses";
import { FormError } from "../FormError";
import { TitleBar } from "../TitleBar";
import { formatMoney } from "../../format";
import { HistoryFilterFields } from "./HistoryFilterFields";

const FILTER_BUTTON_CLASSES =
  "flex h-11 items-center gap-2 justify-self-end rounded-full border border-white " +
  "bg-lime-900 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-white aria-expanded:bg-white aria-expanded:text-lime-900";
const CLEAR_BUTTON_CLASSES =
  "mt-2 rounded py-2 font-bold text-lime-800 underline focus-visible:outline-2 " +
  "focus-visible:outline-lime-800";
const EMPTY_LINK_CLASSES = `flex items-center text-base ${buttonClasses("primary")}`;

interface EmptyLink {
  to: string;
  label: string;
}

const HOME: EmptyLink = { to: "/", label: "Ir para a página inicial" };

function countActive(filters: HistoryFilters): number {
  return Object.values(filters).filter((value) => value !== "").length;
}

function Total({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-stone-600">Total {label.toLowerCase()}</dt>
      <dd className="text-2xl font-bold tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

interface HistoryLayoutProps {
  title: string;
  history: History<unknown>;
  statusLabels: Record<PurchaseStatus, string>;
  counterpartLabel: string;
  emptyMessage: string;
  emptyLink?: EmptyLink;
  children: ReactNode;
}

export function HistoryLayout({
  title,
  history,
  statusLabels,
  counterpartLabel,
  emptyMessage,
  emptyLink = HOME,
  children,
}: Readonly<HistoryLayoutProps>) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const { filters, lastPage, loading, error } = history;
  const activeFilters = countActive(filters);
  const empty = !loading && error === "" && history.items.length === 0;

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title={title}>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={FILTER_BUTTON_CLASSES}
        >
          <FunnelIcon aria-hidden="true" className="size-5" />
          {activeFilters === 0 ? "Filtrar" : `Filtros (${activeFilters})`}
        </button>
      </TitleBar>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* fica sempre no HTML para o botão ter para onde apontar */}
        <div id={filtersId} hidden={!filtersOpen} className="border-b border-stone-300 py-6">
          <HistoryFilterFields
            filters={filters}
            onChange={history.changeFilters}
            statusLabels={statusLabels}
            counterpartLabel={counterpartLabel}
            counterparts={history.counterparts}
          />
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => history.changeFilters(NO_FILTERS)}
              className={CLEAR_BUTTON_CLASSES}
            >
              Limpar filtros
            </button>
          )}
        </div>
        {/* a lista antiga fica mais clara na tela até a nova chegar */}
        <div aria-busy={history.replacing} className={history.replacing ? "opacity-60" : undefined}>
          {lastPage && history.items.length > 0 && (
            <dl className="flex flex-wrap gap-x-10 gap-y-1 pt-8 text-lg">
              <Total label={statusLabels.ENTREGUE} value={lastPage.realized_total} />
              <Total label={statusLabels["EM PROGRESSO"]} value={lastPage.expected_total} />
            </dl>
          )}
          {children}
        </div>
        {empty && (
          <div className="flex flex-col items-center gap-6 pt-12 text-center text-xl">
            <p className="max-w-xl">
              {activeFilters === 0 ? emptyMessage : "Nenhum pedido com esses filtros"}
            </p>
            {activeFilters === 0 && (
              <Link to={emptyLink.to} className={EMPTY_LINK_CLASSES}>
                {emptyLink.label}
              </Link>
            )}
          </div>
        )}
        <div className="flex flex-col items-center gap-4 pt-10">
          {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
          <output className="text-stone-600">{loading ? "Carregando..." : ""}</output>
          <FormError message={error} />
          {error && <SecondaryButton onClick={history.retry}>Tentar de novo</SecondaryButton>}
          {history.hasMore && !loading && !error && (
            <SecondaryButton onClick={history.loadMore}>Mostrar pedidos mais antigos</SecondaryButton>
          )}
        </div>
      </div>
    </main>
  );
}
