import { useEffect, useState } from "react";
import { getFarmerReviews, type FarmerReviews } from "../api/farmers";

interface FarmerReviewsResult {
  farmerPublicId: string;
  reviews: FarmerReviews | null;
}

export function useFarmerReviews(farmerPublicId: string) {
  const [result, setResult] = useState<FarmerReviewsResult | null>(null);

  useEffect(() => {
    let outdated = false;
    getFarmerReviews(farmerPublicId)
      .then((reviews) => {
        if (!outdated) setResult({ farmerPublicId, reviews });
      })
      .catch(() => {
        if (!outdated) setResult({ farmerPublicId, reviews: null });
      });

    return () => {
      outdated = true;
    };
  }, [farmerPublicId]);

  const currentResult = result?.farmerPublicId === farmerPublicId ? result : null;
  return {
    reviews: currentResult?.reviews ?? null,
    loading: currentResult === null,
  };
}
