import { useState } from "react";
import { ApiError } from "../api/client";
import {
  deleteInterest,
  listMyInterests,
  updateInterest,
  type Interest,
  type MyInterestsPage,
} from "../api/interests";
import { openCostInCents } from "../interestState";
import { removeItem, replaceItem } from "./pageEdits";
import { usePages } from "./usePages";
import { useWriteGuard } from "./useWriteGuard";

// a busca é só um contador, que relê a lista da primeira página
function loadMyInterests(_reading: number, page: number): Promise<MyInterestsPage> {
  return listMyInterests(page);
}

function keyOf(interest: Interest): string {
  return interest.public_id;
}

// o total que chegou da API e o que segue as escritas feitas depois
interface Total {
  from: string;
  cents: number;
}

export function useMyInterests() {
  const guard = useWriteGuard();
  const pages = usePages(loadMyInterests, 0 as number, { keepPrevious: true, keyOf });
  const [total, setTotal] = useState<Total | null>(null);
  const latest = pages.lastPage?.estimated_total;
  if (latest !== undefined && latest !== total?.from) {
    setTotal({ from: latest, cents: Math.round(Number(latest) * 100) });
  }

  function track(before: Interest, after: Interest | null) {
    const change = (after ? openCostInCents(after) : 0) - openCostInCents(before);
    setTotal((current) => current && { ...current, cents: current.cents + change });
  }

  const same = (publicId: string) => (interest: Interest) => interest.public_id === publicId;

  // outra aba ou a compra mudou o interesse, então a lista é relida
  async function rereadOnConflict<T>(request: Promise<T>): Promise<T> {
    try {
      return await guard(request);
    } catch (writeError) {
      if (writeError instanceof ApiError && writeError.status === 409) {
        pages.changeSearch(pages.search + 1);
      }
      throw writeError;
    }
  }

  async function update(before: Interest, quantity: number): Promise<void> {
    const saved = await rereadOnConflict(updateInterest(before.public_id, quantity));
    pages.editPages(replaceItem(same(before.public_id), saved));
    track(before, saved);
  }

  async function remove(before: Interest): Promise<void> {
    await guard(deleteInterest(before.public_id));
    pages.editPages(removeItem(same(before.public_id)));
    track(before, null);
  }

  return {
    items: pages.items,
    totalInCents: total?.cents ?? 0,
    loading: pages.loading,
    error: pages.error,
    hasMore: pages.hasMore,
    loadMore: pages.loadMore,
    retry: pages.retry,
    update,
    remove,
  };
}
