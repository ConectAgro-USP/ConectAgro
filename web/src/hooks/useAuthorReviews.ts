import type { Page } from "../api/pagination";
import {
  listAuthoredReviews,
  listReviewable,
  type AuthoredReview,
  type Review,
  type Reviewable,
} from "../api/reviews";
import { addItem, removeItem, replaceItem } from "./pageEdits";
import { usePages } from "./usePages";

function reviewableKey(reviewable: Reviewable): string {
  return `${reviewable.purchase_public_id}/${reviewable.farmer_public_id}`;
}

function reviewKey(review: AuthoredReview): string {
  return review.public_id;
}

// as duas listas não têm busca, só as páginas
function loadReviewables(_search: null, page: number): Promise<Page<Reviewable>> {
  return listReviewable(page);
}

function loadAuthored(_search: null, page: number): Promise<Page<AuthoredReview>> {
  return listAuthoredReviews(page);
}

export function useAuthorReviews() {
  const pending = usePages(loadReviewables, null, { keyOf: reviewableKey });
  const authored = usePages(loadAuthored, null, { keyOf: reviewKey });
  const loaded = pending.lastPage !== undefined && authored.lastPage !== undefined;
  const error = pending.error || authored.error;

  // pede de novo só a página que falhou
  function retry() {
    if (pending.error) pending.retry();
    if (authored.error) authored.retry();
  }

  // com o item recusado fora do lugar, as listas voltam da primeira página
  function reload() {
    pending.restart();
    authored.restart();
  }

  function markReviewed(reviewable: Reviewable, review: Review) {
    const same = (item: Reviewable) => reviewableKey(item) === reviewableKey(reviewable);
    const listed = { ...review, farmer_short_name: reviewable.farmer_short_name };
    pending.editPages(removeItem(same), { dropped: 1 });
    authored.editPages(addItem(listed, "first"));
  }

  function markEdited(review: Review) {
    const current = authored.items.find((item) => item.public_id === review.public_id);
    if (current === undefined) return;
    const same = (item: AuthoredReview) => item.public_id === review.public_id;
    authored.editPages(replaceItem(same, { ...current, ...review }));
  }

  return {
    reviewables: pending.items,
    authored: authored.items,
    pendingPages: pending,
    authoredPages: authored,
    loaded,
    loading: !loaded && error === "",
    error,
    retry,
    reload,
    markReviewed,
    markEdited,
  };
}
