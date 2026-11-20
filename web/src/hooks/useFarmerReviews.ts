import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";
import { getFarmerReviews, type FarmerReviews } from "../api/reviews";

interface FarmerReviewsResult {
  farmerPublicId: string;
  reviews: FarmerReviews | null;
  error: string;
}

export function useFarmerReviews(farmerPublicId: string) {
  const [result, setResult] = useState<FarmerReviewsResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let outdated = false;
    if (!farmerPublicId) {
      return () => {
        outdated = true;
      };
    }

    getFarmerReviews(farmerPublicId)
      .then((data) => {
        if (!outdated) setResult({ farmerPublicId, reviews: data, error: "" });
      })
      .catch((err: unknown) => {
        if (!outdated) setResult({ farmerPublicId, reviews: null, error: errorMessage(err) });
      });

    return () => {
      outdated = true;
    };
  }, [farmerPublicId, reloadKey]);

  const currentResult = result?.farmerPublicId === farmerPublicId ? result : null;
  return {
    reviews: currentResult?.reviews ?? null,
    loading: Boolean(farmerPublicId) && currentResult === null,
    error: currentResult?.error ?? "",
    reload,
  };
}
