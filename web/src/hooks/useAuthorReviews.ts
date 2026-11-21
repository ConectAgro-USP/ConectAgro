import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import {
  listAuthoredReviews,
  listReviewable,
  type AuthoredReview,
  type Review,
  type Reviewable,
} from "../api/reviews";
import { useAuth } from "../auth/AuthContext";

interface Lists {
  reviewables: Reviewable[];
  authored: AuthoredReview[];
}

function sameReviewable(one: Reviewable, other: Reviewable): boolean {
  return (
    one.purchase_public_id === other.purchase_public_id &&
    one.farmer_public_id === other.farmer_public_id
  );
}

export function useAuthorReviews() {
  const { refreshUser } = useAuth();
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState("");
  const [request, setRequest] = useState({});

  useEffect(() => {
    let outdated = false;

    async function load() {
      try {
        const [reviewables, authored] = await Promise.all([
          listReviewable(),
          listAuthoredReviews(),
        ]);
        if (!outdated) setLists({ reviewables, authored });
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
          await refreshUser();
        }
      }
    }

    load().catch((refreshError: unknown) => console.error(refreshError));
    return () => {
      outdated = true;
    };
  }, [request, refreshUser]);

  function reload() {
    setError("");
    setRequest({});
  }

  function markReviewed(reviewable: Reviewable, review: Review) {
    setLists((current) => ({
      reviewables: (current?.reviewables ?? []).filter(
        (item) => !sameReviewable(item, reviewable),
      ),
      authored: [
        { ...review, farmer_short_name: reviewable.farmer_short_name },
        ...(current?.authored ?? []),
      ],
    }));
  }

  function markEdited(review: Review) {
    setLists((current) => ({
      reviewables: current?.reviewables ?? [],
      authored: (current?.authored ?? []).map((item) =>
        item.public_id === review.public_id ? { ...item, ...review } : item,
      ),
    }));
  }

  return {
    reviewables: lists?.reviewables ?? [],
    authored: lists?.authored ?? [],
    loaded: lists !== null,
    loading: lists === null && error === "",
    error,
    reload,
    markReviewed,
    markEdited,
  };
}
