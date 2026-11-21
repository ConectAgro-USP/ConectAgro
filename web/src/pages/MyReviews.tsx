import type { ReceivedReview, ReceivedReviews } from "../api/reviews";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { RatingStars } from "../components/reviews/StarRating";
import { formatFullDay, formatRating } from "../format";
import { useReceivedReviews } from "../hooks/useReceivedReviews";

function countText(count: number): string {
  return count === 1 ? "1 avaliação" : `${count} avaliações`;
}

function Summary({ reviews }: Readonly<{ reviews: ReceivedReviews }>) {
  const { average_rating: average, reviews_count: count } = reviews;
  if (average === null || count === 0) {
    return (
      <p className="mt-2 text-lg text-stone-600">
        Você ainda não recebeu avaliações. Quando alguém avaliar uma entrega sua, a avaliação
        aparecerá aqui.
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="sr-only">Nota média</span>
      <span className="text-4xl font-bold tabular-nums">{formatRating(average)}</span>
      <span className="sr-only">de 5</span>
      <RatingStars rating={average} starClassName="size-8" />
      <span className="text-lg text-stone-600">{countText(count)}</span>
    </p>
  );
}

function ReviewCard({ review }: Readonly<{ review: ReceivedReview }>) {
  return (
    <li className="space-y-4 rounded-2xl border border-stone-300 bg-white px-6 py-5">
      <RatingStars rating={review.rating} label={`Nota ${review.rating} de 5`} />
      {review.comment && <p className="text-lg break-words whitespace-pre-line">{review.comment}</p>}
      <p className="text-sm font-bold text-stone-500">
        Feita em <span className="tabular-nums">{formatFullDay(review.created_at)}</span>
      </p>
    </li>
  );
}

export function MyReviews() {
  const { reviews, loading, error, retry } = useReceivedReviews();

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-extrabold">Minhas avaliações</h1>
        <output className="mt-4 block text-lg text-stone-600">
          {loading ? "Carregando..." : ""}
        </output>
        {reviews && <Summary reviews={reviews} />}
        {error && (
          <div className="mt-4 space-y-4">
            <FormError message={error} />
            <SecondaryButton onClick={retry}>Tentar de novo</SecondaryButton>
          </div>
        )}
        {reviews && reviews.reviews.length > 0 && (
          <ul className="space-y-4 pt-8">
            {reviews.reviews.map((review) => (
              <ReviewCard key={review.public_id} review={review} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
