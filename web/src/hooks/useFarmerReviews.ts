import { getFarmerReviews } from "../api/farmers";
import type { ReceivedReview } from "../api/reviews";
import { usePages } from "./usePages";

function keyOf(review: ReceivedReview): string {
  return review.public_id;
}

// lê o id só ao montar, outro agricultor pede outra key no componente
export function useFarmerReviews(farmerPublicId: string) {
  const pages = usePages(getFarmerReviews, farmerPublicId, { keyOf });
  const page = pages.lastPage;

  return {
    // a média e a contagem valem para todas, e vêm em qualquer página
    rating: page ? { average: page.average_rating, count: page.reviews_count } : null,
    written: pages.items,
    loading: page === undefined && pages.error === "",
    pages,
  };
}
