import { useEffect, useRef, useState } from "react";
import { ApiError, errorMessage, lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// o que toda página da API tem, seja qual for o resto
interface PageOf {
  items: unknown[];
  page: number;
  page_size?: number;
  total_pages: number;
}

type ItemOf<P extends PageOf> = P["items"][number];

interface Query<Search> {
  search: Search;
  page: number;
  // quantas linhas saíram antes de pedir de novo a página, que entra no fim
  catchUp?: number;
}

// as páginas na tela e o último pedido respondido, com página ou com erro
interface Loaded<Search, P> {
  query: Query<Search> | null;
  pages: P[];
  // o último pedido que trouxe uma página, as falhas não contam
  arrived: Query<Search> | null;
}

type LoadPage<Search, P> = (search: Search, page: number) => Promise<P>;
type Edit<P> = (pages: P[]) => P[];

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
  // relê da primeira página, e a lista de agora fica até a resposta
  restart: () => void;
  // muda a cada página que chega, mas não com as falhas nem com as escritas
  received: object | null;
  // muda as páginas na tela depois de uma escrita, sem pedir de novo
  editPages: (edit: Edit<P>, change?: Change) => void;
}

interface Change {
  // quantas linhas a escrita tirou da lista do servidor
  dropped?: number;
}

// as linhas tiradas puxam as seguintes para trás, então a busca volta
function catchUpPage(page: number, size: number, dropped: number): number {
  return Math.max(1, Math.floor((page * size - dropped) / size) + 1);
}

// tira do fim as páginas desta em diante, as de antes ficam
function pagesBefore<P extends PageOf>(pages: P[], page: number): P[] {
  let end = pages.length;
  while (end > 0 && pages[end - 1].page >= page) end--;
  return pages.slice(0, end);
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
  const [loaded, setLoaded] = useState<Loaded<Search, P>>({
    query: null,
    pages: [],
    arrived: null,
  });
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [dropped, setDropped] = useState(0);
  // as escritas feitas enquanto a página vinha, para valerem também nela
  const edits = useRef<Edit<P>[]>([]);
  // sem keepPrevious a lista de outra busca sai da tela, para ninguém achar que ela responde à nova
  const pages = keepPrevious || loaded.query?.search === query.search ? loaded.pages : [];
  const lastPage = pages.at(-1);
  const items: ItemOf<P>[] = pages.flatMap((page) => page.items);
  const loading = loaded.query !== query;

  function changeSearch(search: Search) {
    if (search === query.search) return;
    clearError();
    setDropped(0);
    setQuery({ search, page: 1 });
  }

  function clearError() {
    setError("");
    setErrorStatus(null);
  }

  // conta da última página na tela, não da última pedida, que pode ter falhado
  function loadMore() {
    clearError();
    const base = lastPage?.page ?? 0;
    const size = lastPage?.page_size;
    if (dropped > 0 && size !== undefined && keyOf) {
      // a conta só desce quando a página chega, o keyOf junta as repetidas
      setQuery({ search: query.search, page: catchUpPage(base, size, dropped), catchUp: dropped });
      return;
    }
    setQuery({ search: query.search, page: base + 1 });
  }

  function retry() {
    clearError();
    // a cópia faz o efeito pedir a mesma página de novo
    setQuery({ ...query });
  }

  function restart() {
    clearError();
    setDropped(0);
    setQuery({ search: query.search, page: 1 });
  }

  // a escrita cala o erro da página que falhou, e o Mostrar mais volta
  function editPages(edit: Edit<P>, { dropped: count = 0 }: Change = {}) {
    clearError();
    edits.current.push(edit);
    setLoaded((previous) => ({ ...previous, pages: edit(previous.pages) }));
    if (count > 0) setDropped((current) => current + count);
  }

  useEffect(() => {
    let outdated = false;

    edits.current = [];

    // as páginas antes desta ficam na tela, as outras dão lugar à resposta
    function replaceFromThisPage(result: P) {
      const fresh = edits.current.reduce((pages, edit) => edit(pages), [result]);
      const used = query.catchUp ?? 0;
      // as linhas que saíram enquanto a página vinha continuam na conta
      if (used > 0) setDropped((current) => Math.max(0, current - used));
      setLoaded((previous) => {
        const kept = query.catchUp ? previous.pages : pagesBefore(previous.pages, query.page);
        return { query, pages: [...kept, ...fresh], arrived: query };
      });
    }

    // ao reler a mesma busca a lista fica, a de outra busca sai
    function keepAfterError() {
      setLoaded((previous) => {
        const same = previous.query?.search === query.search;
        return { ...previous, query, pages: same ? previous.pages : [] };
      });
    }

    async function load() {
      try {
        const result = await loadPage(query.search, query.page);
        if (outdated) return;
        replaceFromThisPage(result);
      } catch (loadError) {
        if (outdated) return;
        keepAfterError();
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
    replacing: loading && query.page === 1 && !query.catchUp,
    error,
    errorStatus,
    loadMore,
    retry,
    restart,
    received: loaded.arrived,
    editPages,
  };
}
