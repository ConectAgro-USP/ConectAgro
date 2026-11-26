import type { ReceivedReviews } from "../../api/reviews";

// sem nenhuma avaliação não há média para mostrar
export function averageOf(reviews: ReceivedReviews): number | null {
  return reviews.reviews_count === 0 ? null : reviews.average_rating;
}
