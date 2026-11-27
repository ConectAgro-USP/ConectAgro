import { listReceivedReviews, type ReceivedReview, type ReceivedReviews } from "../api/reviews";
import { SecondaryButton } from "../components/Button";
import { CARD_SURFACE } from "../components/surface";
import { FormError } from "../components/FormError";
import { AverageRating } from "../components/reviews/AverageRating";
import { averageOf } from "../components/reviews/average";
import { RatingStars } from "../components/reviews/StarRating";
import { TitleBar } from "../components/TitleBar";
import { formatCount, formatFullDay } from "../format";
import { useLoaded } from "../hooks/useLoaded";

function Summary({ reviews }: Readonly<{ reviews: ReceivedReviews }>) {
  const average = averageOf(reviews);
  if (average === null) {
    return (
      <p className="mt-2 text-lg text-stone-600">
        Você ainda não recebeu avaliações. Quando alguém avaliar uma entrega sua, a avaliação
        aparecerá aqui.
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <AverageRating average={average} starClassName="size-8" />
      <span className="text-lg text-stone-600">
        {formatCount(reviews.reviews_count, "avaliação", "avaliações")}
      </span>
    </p>
  );
}

function ReviewCard({ review }: Readonly<{ review: ReceivedReview }>) {
  return (
    <li className={`space-y-4 px-6 py-5 ${CARD_SURFACE}`}>
      <RatingStars rating={review.rating} label={`Nota ${review.rating} de 5`} />
      {review.comment && <p className="text-lg break-words whitespace-pre-line">{review.comment}</p>}
      <p className="text-sm font-bold text-stone-500">
        Feita em <span className="tabular-nums">{formatFullDay(review.created_at)}</span>
      </p>
    </li>
  );
}

export function MyReviews() {
  const { data: reviews, loading, error, retry } = useLoaded(listReceivedReviews);

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Minhas avaliações" />
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
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
