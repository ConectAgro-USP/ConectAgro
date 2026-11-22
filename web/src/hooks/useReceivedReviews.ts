import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import { listReceivedReviews, type ReceivedReviews } from "../api/reviews";
import { useAuth } from "../auth/AuthContext";

interface Loaded {
  request: object;
  reviews: ReceivedReviews;
}

export function useReceivedReviews() {
  const { refreshUser } = useAuth();
  const [request, setRequest] = useState({});
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");

  function retry() {
    setError("");
    setRequest({});
  }

  useEffect(() => {
    let outdated = false;

    async function load() {
      try {
        const reviews = await listReceivedReviews();
        if (!outdated) setLoaded({ request, reviews });
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

  return {
    reviews: loaded?.reviews ?? null,
    loading: loaded?.request !== request && error === "",
    error,
    retry,
  };
}
