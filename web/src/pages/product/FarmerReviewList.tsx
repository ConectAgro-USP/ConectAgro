import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ReceivedReview } from "../../api/reviews";
import { RatingStars } from "../../components/reviews/StarRating";
import { formatFullDay } from "../../format";

const FIRST_SHOWN = 3;
const TOGGLE_CLASSES =
  "-ml-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-bold " +
  "text-lime-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-lime-800";

interface FarmerReviewListProps {
  reviews: ReceivedReview[];
}

export function FarmerReviewList({ reviews }: Readonly<FarmerReviewListProps>) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  // a API manda da mais nova para a mais antiga, e só as escritas entram
  const written = reviews.filter((review) => review.comment.trim() !== "");

  if (written.length === 0) {
    return null;
  }
  const shown = open ? written : written.slice(0, FIRST_SHOWN);

  return (
    <section className="pt-3">
      <h2 className="text-lg font-bold text-stone-900">Avaliações com comentário</h2>
      <ul id={listId} className="divide-y divide-stone-200">
        {shown.map((review) => (
          <li key={review.public_id} className="py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <RatingStars
                rating={review.rating}
                label={`Nota ${review.rating} de 5`}
                starClassName="size-5"
              />
              <span className="text-stone-600 tabular-nums">
                {formatFullDay(review.created_at)}
              </span>
            </div>
            <p className="mt-2 leading-relaxed break-words whitespace-pre-line text-stone-800">
              {review.comment}
            </p>
          </li>
        ))}
      </ul>
      {written.length > FIRST_SHOWN && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className={TOGGLE_CLASSES}
        >
          {open ? "Ver menos" : "Ver todas"}
          <ChevronDownIcon aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      )}
    </section>
  );
}
