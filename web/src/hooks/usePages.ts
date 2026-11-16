import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import type { Page } from "../api/pagination";
import { useAuth } from "../auth/AuthContext";

interface Query<Search> {
  search: Search;
  page: number;
}

// as páginas na tela e o pedido que elas respondem
interface Loaded<Search, Item> {
  query: Query<Search> | null;
  pages: Page<Item>[];
}

type LoadPage<Search, Item> = (search: Search, page: number) => Promise<Page<Item>>;

export interface Pages<Search, Item> {
  search: Search;
  changeSearch: (search: Search) => void;
  items: Item[];
  // null até chegar a primeira página da busca atual
  total: number | null;
  hasMore: boolean;
  loading: boolean;
  error: string;
  loadMore: () => void;
  retry: () => void;
}

// a busca é o que muda a lista inteira, como a distância; as páginas só a continuam
export function usePages<Search, Item>(
  loadPage: LoadPage<Search, Item>,
  firstSearch: Search,
): Pages<Search, Item> {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState<Query<Search>>({ search: firstSearch, page: 1 });
  const [loaded, setLoaded] = useState<Loaded<Search, Item>>({ query: null, pages: [] });
  const [error, setError] = useState("");
  // a lista de outra busca sai da tela, para ninguém achar que ela responde à nova
  const pages = loaded.query?.search === query.search ? loaded.pages : [];
  const lastPage = pages.at(-1);

  function changeSearch(search: Search) {
    if (search === query.search) return;
    setError("");
    setQuery({ search, page: 1 });
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
    function replaceFromThisPage(newPages: Page<Item>[]) {
      setLoaded((previous) => ({
        query,
        pages: [...previous.pages.slice(0, query.page - 1), ...newPages],
      }));
    }

    async function load() {
      try {
        const result = await loadPage(query.search, query.page);
        if (outdated) return;
        replaceFromThisPage([result]);
      } catch (loadError) {
        if (outdated) return;
        replaceFromThisPage([]);
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
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
    search: query.search,
    changeSearch,
    items: pages.flatMap((page) => page.items),
    total: lastPage?.total ?? null,
    hasMore: lastPage !== undefined && lastPage.page < lastPage.total_pages,
    loading: loaded.query !== query,
    error,
    loadMore,
    retry,
  };
}
