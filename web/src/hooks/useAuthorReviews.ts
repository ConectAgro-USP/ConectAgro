import { useEffect, useRef, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import type { Page } from "../api/pagination";
import {
  listAuthoredReviews,
  listReviewable,
  type AuthoredReview,
  type Review,
  type Reviewable,
} from "../api/reviews";
import { useAuth } from "../auth/AuthContext";
import type { PagedList } from "../components/ShowMore";

// os itens na tela e a última página lida de cada lista
interface Listed<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

interface Lists {
  reviewables: Listed<Reviewable>;
  authored: Listed<AuthoredReview>;
}

type Kind = keyof Lists;

interface More {
  loading: boolean;
  error: string;
}

const IDLE: More = { loading: false, error: "" };
const NO_MORE: Record<Kind, More> = { reviewables: IDLE, authored: IDLE };

function reviewableKey(reviewable: Reviewable): string {
  return `${reviewable.purchase_public_id}/${reviewable.farmer_public_id}`;
}

function reviewKey(review: AuthoredReview): string {
  return review.public_id;
}

// a página seguinte pode repetir um item, se a lista mudou entre os pedidos
function listed<T>(page: Page<T>, keyOf: (item: T) => string, before: T[] = []): Listed<T> {
  const items = [...new Map([...before, ...page.items].map((item) => [keyOf(item), item]))];
  return {
    items: items.map(([, item]) => item),
    page: page.page,
    hasMore: page.page < page.total_pages,
  };
}

function sameReviewable(one: Reviewable, other: Reviewable): boolean {
  return reviewableKey(one) === reviewableKey(other);
}

export function useAuthorReviews() {
  const { refreshUser } = useAuth();
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(NO_MORE);
  const [request, setRequest] = useState({});
  // a lista que ainda chega não pode desfazer o que acabou de ser salvo
  const stopLoading = useRef(() => {});

  useEffect(() => {
    let outdated = false;
    const stop = () => {
      outdated = true;
    };
    stopLoading.current = stop;

    async function load() {
      try {
        const [reviewables, authored] = await Promise.all([
          listReviewable(1),
          listAuthoredReviews(1),
        ]);
        if (outdated) return;
        setLists({
          reviewables: listed(reviewables, reviewableKey),
          authored: listed(authored, reviewKey),
        });
        setMore(NO_MORE);
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
          await refreshUser();
        }
      }
    }

    load().catch((refreshError: unknown) => console.error(refreshError));
    return stop;
  }, [request, refreshUser]);

  function reload() {
    setError("");
    setRequest({});
  }

  function changeMore(kind: Kind, state: More) {
    setMore((current) => ({ ...current, [kind]: state }));
  }

  async function loadMore(kind: Kind) {
    const current = lists?.[kind];
    if (!current?.hasMore || more[kind].loading) return;
    changeMore(kind, { loading: true, error: "" });
    try {
      if (kind === "reviewables") {
        const page = await listReviewable(current.page + 1);
        setLists((now) => {
          if (now === null) return null;
          return { ...now, reviewables: listed(page, reviewableKey, now.reviewables.items) };
        });
      } else {
        const page = await listAuthoredReviews(current.page + 1);
        setLists((now) => now && { ...now, authored: listed(page, reviewKey, now.authored.items) });
      }
      changeMore(kind, IDLE);
    } catch (loadError) {
      changeMore(kind, { loading: false, error: errorMessage(loadError) });
      if (lostAccess(loadError)) {
        await refreshUser();
      }
    }
  }

  function pagesOf(kind: Kind): PagedList {
    return {
      hasMore: lists?.[kind].hasMore ?? false,
      loading: more[kind].loading,
      error: more[kind].error,
      loadMore: () => {
        loadMore(kind).catch((refreshError: unknown) => console.error(refreshError));
      },
    };
  }

  function markReviewed(reviewable: Reviewable, review: Review) {
    stopLoading.current();
    setError("");
    setLists((current) => {
      if (current === null) return null;
      const { reviewables, authored } = current;
      const listedReview = { ...review, farmer_short_name: reviewable.farmer_short_name };
      return {
        reviewables: {
          ...reviewables,
          items: reviewables.items.filter((item) => !sameReviewable(item, reviewable)),
        },
        authored: { ...authored, items: [listedReview, ...authored.items] },
      };
    });
  }

  function markEdited(review: Review) {
    stopLoading.current();
    setError("");
    setLists((current) => {
      if (current === null) return null;
      const items = current.authored.items.map((item) =>
        item.public_id === review.public_id ? { ...item, ...review } : item,
      );
      return { ...current, authored: { ...current.authored, items } };
    });
  }

  return {
    reviewables: lists?.reviewables.items ?? [],
    authored: lists?.authored.items ?? [],
    pendingPages: pagesOf("reviewables"),
    authoredPages: pagesOf("authored"),
    loaded: lists !== null,
    loading: lists === null && error === "",
    error,
    reload,
    markReviewed,
    markEdited,
  };
}
