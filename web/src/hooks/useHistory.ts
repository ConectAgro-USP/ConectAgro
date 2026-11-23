import { useState } from "react";
import {
  NO_FILTERS,
  type Counterpart,
  type HistoryFilters,
  type HistoryPage,
} from "../api/history";
import { usePages } from "./usePages";

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
  reload: () => void;
}

export function useHistory<Item>(loadPage: LoadPage<Item>): History<Item> {
  const pages = usePages(loadPage, NO_FILTERS, { keepPrevious: true });
  // fica fora das páginas, para o filtro não esvaziar quando um pedido falha
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const latest = pages.lastPage?.counterparts;
  if (latest !== undefined && latest !== counterparts) {
    setCounterparts(latest);
  }

  function reload() {
    // a cópia dos filtros faz a lista pedir a primeira página de novo
    pages.changeSearch({ ...pages.search });
  }

  return {
    ...pages,
    filters: pages.search,
    changeFilters: pages.changeSearch,
    counterparts,
    reload,
  };
}
