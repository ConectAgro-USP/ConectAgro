import { useState } from "react";
import { Link } from "react-router";
import { RATINGS, type Reviewable } from "../../api/reviews";
import { formatCount } from "../../format";
import { FROM_APP, newReviewPath } from "./paths";
import { Star } from "./StarRating";

const STAR_LINK_CLASSES =
  "rounded-full p-1 focus-visible:outline-2 focus-visible:outline-lime-800";

interface RateLinksProps {
  reviewable: Reviewable;
  label?: string;
}

export function RateLinks({ reviewable, label = "Avalie a compra" }: Readonly<RateLinksProps>) {
  const [hovered, setHovered] = useState(0);

  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-2">
      <legend className="float-left">{label}</legend>
      <div className="flex" onMouseLeave={() => setHovered(0)}>
        {RATINGS.map((rating) => (
          <Link
            key={rating}
            to={newReviewPath(reviewable, rating)}
            state={FROM_APP}
            onMouseEnter={() => setHovered(rating)}
            className={STAR_LINK_CLASSES}
          >
            <Star filled={rating <= hovered} className="size-7" />
            <span className="sr-only">{formatCount(rating, "estrela", "estrelas")}</span>
          </Link>
        ))}
      </div>
    </fieldset>
  );
}
