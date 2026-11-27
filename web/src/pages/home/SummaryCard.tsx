import { useId, type ReactNode } from "react";
import { Link } from "react-router";
import { SecondaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { CARD_SURFACE } from "../../components/surface";
import type { LoadedState } from "../../hooks/useLoaded";

const MORE_CLASSES =
  "mt-auto w-fit rounded-sm pt-2 text-lg font-bold text-lime-800 underline " +
  "underline-offset-4 hover:text-lime-900 focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-lime-800";

interface SummaryCardProps<T> {
  title: string;
  state: LoadedState<T>;
  more: { to: string; label: string };
  className?: string;
  children: (data: T) => ReactNode;
}

export function SummaryCard<T>({
  title,
  state,
  more,
  className = "",
  children,
}: Readonly<SummaryCardProps<T>>) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`flex flex-col gap-4 px-6 py-6 sm:px-8 ${CARD_SURFACE} ${className}`}
    >
      <h2 id={titleId} className="text-2xl font-bold">
        {title}
      </h2>
      <output className={state.loading ? "text-lg text-stone-600" : "sr-only"}>
        {state.loading ? "Carregando..." : ""}
      </output>
      {state.error && (
        <div className="space-y-4">
          <FormError message={state.error} />
          <SecondaryButton size="compact" onClick={state.retry}>
            Tentar de novo
          </SecondaryButton>
        </div>
      )}
      {state.data !== null && children(state.data)}
      <Link to={more.to} className={MORE_CLASSES}>
        {more.label}
      </Link>
    </section>
  );
}
