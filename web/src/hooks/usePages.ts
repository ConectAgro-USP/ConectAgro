import { useEffect, useState } from "react";
import { ApiError, errorMessage, lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// o que toda página da API tem, seja qual for o resto
interface PageOf {
  items: unknown[];
  page: number;
  total_pages: number;
}

type ItemOf<P extends PageOf> = P["items"][number];

interface Query<Search> {
  search: Search;
  page: number;
}

// as páginas na tela e o pedido que elas respondem
interface Loaded<Search, P> {
  query: Query<Search> | null;
  pages: P[];
}

type LoadPage<Search, P> = (search: Search, page: number) => Promise<P>;

interface Options<P extends PageOf> {
  // a lista da busca anterior fica na tela até a resposta da nova chegar
  keepPrevious?: boolean;
  // a lista pode mudar entre um pedido e outro, então a página seguinte pode repetir um item
  keyOf?: (item: ItemOf<P>) => string;
}

export interface Pages<Search, P extends PageOf> {
  search: Search;
  changeSearch: (search: Search) => void;
  items: ItemOf<P>[];
  lastPage: P | undefined;
  hasMore: boolean;
  loading: boolean;
  // a primeira página carregando, que vai trocar a lista inteira
  replacing: boolean;
  error: string;
  // o código HTTP do erro, nulo sem erro ou sem resposta do servidor
  errorStatus: number | null;
  loadMore: () => void;
  retry: () => void;
}

// a busca é o que muda a lista inteira, como a distância; as páginas só a continuam
export function usePages<Search, P extends PageOf>(
  loadPage: LoadPage<Search, P>,
  // só é lida ao montar, como o valor inicial do useState: para trocar de busca, chame
  // changeSearch ou monte de novo com outra key
  firstSearch: Search,
  { keepPrevious = false, keyOf }: Options<P> = {},
): Pages<Search, P> {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState<Query<Search>>({ search: firstSearch, page: 1 });
  const [loaded, setLoaded] = useState<Loaded<Search, P>>({ query: null, pages: [] });
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  // sem keepPrevious a lista de outra busca sai da tela, para ninguém achar que ela responde à nova
  const pages = keepPrevious || loaded.query?.search === query.search ? loaded.pages : [];
  const lastPage = pages.at(-1);
  const items: ItemOf<P>[] = pages.flatMap((page) => page.items);
  const loading = loaded.query !== query;

  function changeSearch(search: Search) {
    if (search === query.search) return;
    setError("");
    setErrorStatus(null);
    setQuery({ search, page: 1 });
  }

  function loadMore() {
    setQuery({ ...query, page: query.page + 1 });
  }

  function retry() {
    setError("");
    setErrorStatus(null);
    // a cópia faz o efeito pedir a mesma página de novo
    setQuery({ ...query });
  }

  useEffect(() => {
    let outdated = false;

    // as páginas antes desta ficam na tela, as outras dão lugar à resposta
    function replaceFromThisPage(newPages: P[]) {
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
        setErrorStatus(loadError instanceof ApiError ? loadError.status : null);
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
    // o Map deixa cada chave no lugar em que ela apareceu primeiro
    items: keyOf ? [...new Map(items.map((item) => [keyOf(item), item])).values()] : items,
    lastPage,
    hasMore: lastPage !== undefined && lastPage.page < lastPage.total_pages,
    loading,
    replacing: loading && query.page === 1,
    error,
    errorStatus,
    loadMore,
    retry,
  };
}
