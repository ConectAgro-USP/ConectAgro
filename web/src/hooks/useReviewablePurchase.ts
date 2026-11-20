import { useEffect, useState } from "react";
import { errorMessage } from "../api/client";
import {
  listReviewablePurchases,
  type ReviewablePurchase,
} from "../api/reviews";
import { useAuth } from "../auth/AuthContext";

interface ReviewablePurchaseResult {
  farmerPublicId: string;
  purchase: ReviewablePurchase | null;
  error: string;
}

export function useReviewablePurchase(farmerPublicId: string) {
  const { profileType } = useAuth();
  const canReview = profileType === "buyer" || profileType === "apartment";
  const [result, setResult] = useState<ReviewablePurchaseResult | null>(null);

  useEffect(() => {
    let outdated = false;
    if (!farmerPublicId || !canReview) {
      return () => {
        outdated = true;
      };
    }

    listReviewablePurchases()
      .then((purchases) => {
        if (outdated)
          return;

        const purchase = purchases.find((item) => item.farmer_public_id === farmerPublicId) ?? null;
        setResult({ farmerPublicId, purchase, error: "" });
      })
      .catch((err: unknown) => {
        if (!outdated) 
          setResult({ farmerPublicId, purchase: null, error: errorMessage(err) });
      });

    return () => {
      outdated = true;
    };
  }, [canReview, farmerPublicId]);

  const currentResult = result?.farmerPublicId === farmerPublicId ? result : null;
  return {
    purchase: currentResult?.purchase ?? null,
    loading: Boolean(farmerPublicId && canReview) && currentResult === null,
    error: currentResult?.error ?? "",
  };
}
