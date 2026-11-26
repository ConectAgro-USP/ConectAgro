import { useState } from "react";
import { ApiError } from "../api/client";
import {
  deleteInterest,
  findMyInterest,
  listMyInterests,
  updateInterest,
  type Interest,
  type MyInterestsPage,
} from "../api/interests";
import { openCostInCents } from "../interestState";
import { removeItem, replaceItem } from "./pageEdits";
import { usePages } from "./usePages";
import { useWriteGuard } from "./useWriteGuard";

// a lista não tem busca, só as páginas
function loadMyInterests(_search: null, page: number): Promise<MyInterestsPage> {
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
  const pages = usePages(loadMyInterests, null, { keyOf });
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

  // só o interesse é relido, e as páginas na tela ficam
  async function rereadCard(before: Interest): Promise<Interest | null> {
    if (before.product_public_id === null) return null;
    const now = await guard(findMyInterest(before.product_public_id));
    // sem achar pelo produto, o cartão fica como está
    if (now !== null) pages.editPages(replaceItem(same(before.public_id), now));
    return now;
  }

  // o total vem da API, que já pode ter tirado o interesse comprado
  async function rereadTotal(): Promise<number> {
    const first = await guard(listMyInterests(1, 1));
    return Math.round(Number(first.estimated_total) * 100);
  }

  // sem o total da API, a diferença do cartão relido ainda serve
  async function reread(before: Interest): Promise<void> {
    const [card, sum] = await Promise.allSettled([rereadCard(before), rereadTotal()]);
    if (sum.status === "fulfilled") {
      setTotal((current) => current && { ...current, cents: sum.value });
    } else if (card.status === "fulfilled" && card.value !== null) {
      track(before, card.value);
    }
    const reads = [card, sum];
    const failed = reads.filter((read): read is PromiseRejectedResult => read.status === "rejected");
    for (const failure of failed) console.error(failure.reason);
  }

  // outra aba ou a compra mudou o interesse, e a recusa fica no cartão
  async function rereadOnConflict<T>(before: Interest, request: Promise<T>): Promise<T> {
    try {
      return await guard(request);
    } catch (writeError) {
      if (writeError instanceof ApiError && writeError.status === 409) {
        await reread(before);
      }
      throw writeError;
    }
  }

  async function update(before: Interest, quantity: number): Promise<void> {
    const saved = await rereadOnConflict(
      before,
      updateInterest(before.public_id, quantity, before.product?.unit),
    );
    pages.editPages(replaceItem(same(before.public_id), saved));
    track(before, saved);
  }

  async function remove(before: Interest): Promise<void> {
    await guard(deleteInterest(before.public_id));
    pages.editPages(removeItem(same(before.public_id)), { dropped: 1 });
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
