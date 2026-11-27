import { SearchIcon } from "lucide-react";
import type { SubmitEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { MAX_SEARCH_TERM } from "../api/pagination";
import { useSyncedValue } from "../hooks/useSyncedValue";

const INPUT_CLASSES =
  "h-12 min-w-0 flex-1 rounded-l-full border border-r-0 border-stone-400 bg-white pr-2 pl-5 " +
  "text-lg text-stone-900 placeholder:text-stone-600 focus:border-lime-800 " +
  "focus:outline-2 focus:-outline-offset-2 focus:outline-lime-800";
const BUTTON_CLASSES =
  "flex w-14 shrink-0 items-center justify-center rounded-r-full bg-lime-800 text-white " +
  "hover:bg-lime-900 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800";

export function ProductSearch({ className = "" }: Readonly<{ className?: string }>) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onCatalog = pathname === "/";
  const [term, setTerm] = useSyncedValue(onCatalog ? (params.get("q") ?? "") : "");

  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // no catálogo a busca nova mantém a ordem e os filtros escolhidos
    const next = new URLSearchParams(onCatalog ? params : undefined);
    next.delete("q");
    if (term.trim()) next.set("q", term.trim());
    const query = next.toString();
    void navigate({ pathname: "/", search: query ? `?${query}` : "" });
  }

  return (
    <form role="search" aria-label="Produtos" onSubmit={search} className={`flex ${className}`}>
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        aria-label="Buscar produto"
        placeholder="Buscar produto"
        maxLength={MAX_SEARCH_TERM}
        enterKeyHint="search"
        className={INPUT_CLASSES}
      />
      <button type="submit" aria-label="Buscar" className={BUTTON_CLASSES}>
        <SearchIcon aria-hidden="true" className="size-6" />
      </button>
    </form>
  );
}
