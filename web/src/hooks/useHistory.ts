import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "../api/client";
import {
  NO_FILTERS,
  type Counterpart,
  type HistoryFilters,
  type HistoryPage,
} from "../api/history";
import { useAuth } from "../auth/AuthContext";

interface Query {
  filters: HistoryFilters;
  page: number;
}

// as páginas na tela e o pedido que elas respondem
interface Loaded<Item> {
  query: Query | null;
  pages: HistoryPage<Item>[];
}

type LoadPage<Item> = (filters: HistoryFilters, page: number) => Promise<HistoryPage<Item>>;

export interface History<Item> {
  filters: HistoryFilters;
  changeFilters: (filters: HistoryFilters) => void;
  items: Item[];
  counterparts: Counterpart[];
  lastPage: HistoryPage<Item> | undefined;
  hasMore: boolean;
  loading: boolean;
  replacing: boolean;
  error: string;
  loadMore: () => void;
  retry: () => void;
}

const NO_ACCESS = new Set([401, 403]);

export function useHistory<Item>(loadPage: LoadPage<Item>): History<Item> {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState<Query>({ filters: NO_FILTERS, page: 1 });
  const [loaded, setLoaded] = useState<Loaded<Item>>({ query: null, pages: [] });
  // fica fora das páginas, para o filtro não esvaziar quando um pedido falha
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [error, setError] = useState("");
  const lastPage = loaded.pages.at(-1);
  const loading = loaded.query !== query;

  function changeFilters(filters: HistoryFilters) {
    setError("");
    setQuery({ filters, page: 1 });
  }

  function loadMore() {
    setQuery({ ...query, page: query.page + 1 });
  }

  function retry() {
    setError("");
    // a cópia faz o efeito pedir a mesma página de novo
    setQuery({ ...query });
  }

  useEffect(() => {
    let outdated = false;

    // as páginas antes desta ficam na tela, as outras dão lugar à resposta
    function replaceFromThisPage(newPages: HistoryPage<Item>[]) {
      setLoaded((previous) => ({
        query,
        pages: [...previous.pages.slice(0, query.page - 1), ...newPages],
      }));
    }

    async function load() {
      try {
        const result = await loadPage(query.filters, query.page);
        if (outdated) return;
        replaceFromThisPage([result]);
        setCounterparts(result.counterparts);
      } catch (loadError) {
        if (outdated) return;
        replaceFromThisPage([]);
        setError(errorMessage(loadError));
        if (loadError instanceof ApiError && NO_ACCESS.has(loadError.status)) {
          // sem sessão ou com outra conta, recarregar o usuário tira a pessoa da tela
          await refreshUser();
        }
      }
    }

    load().catch((refreshError: unknown) => console.error(refreshError));
    return () => {
      outdated = true;
    };
  }, [loadPage, query, refreshUser]);

  return {
    filters: query.filters,
    changeFilters,
    items: loaded.pages.flatMap((page) => page.items),
    counterparts,
    lastPage,
    hasMore: lastPage !== undefined && lastPage.page < lastPage.total_pages,
    loading,
    replacing: loading && query.page === 1,
    error,
    loadMore,
    retry,
  };
}
