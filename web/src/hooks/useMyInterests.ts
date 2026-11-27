import { ApiError } from "../api/client";
import {
  deleteInterest,
  findMyInterest,
  listMyInterests,
  updateInterest,
  type Interest,
  type MyInterestsPage,
} from "../api/interests";
import { centsOf, openCostInCents } from "../interestState";
import { removeItem, replaceItem } from "./pageEdits";
import { usePages } from "./usePages";
import { useTracked } from "./useTracked";
import { useWriteGuard } from "./useWriteGuard";

// a lista não tem busca, só as páginas
function loadMyInterests(_search: null, page: number): Promise<MyInterestsPage> {
  return listMyInterests(page);
}

function keyOf(interest: Interest): string {
  return interest.public_id;
}

export function useMyInterests() {
  const guard = useWriteGuard();
  const pages = usePages(loadMyInterests, null, { keyOf });
  const latest = pages.lastPage?.estimated_total;
  const [total, adjustTotal] = useTracked(
    pages.received,
    latest === undefined ? undefined : centsOf(latest),
  );

  function track(before: Interest, after: Interest | null) {
    const change = (after ? openCostInCents(after) : 0) - openCostInCents(before);
    adjustTotal((cents) => cents + change);
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
    return centsOf(first.estimated_total);
  }

  // sem o total da API, a diferença do cartão relido ainda serve
  async function reread(before: Interest): Promise<void> {
    const [card, sum] = await Promise.allSettled([rereadCard(before), rereadTotal()]);
    if (sum.status === "fulfilled") {
      adjustTotal(() => sum.value);
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
    totalInCents: total ?? 0,
    loading: pages.loading,
    error: pages.error,
    hasMore: pages.hasMore,
    loadMore: pages.loadMore,
    retry: pages.retry,
    update,
    remove,
  };
}
