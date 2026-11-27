import { formatRating } from "../../format";
import { RatingStars } from "./StarRating";

interface AverageRatingProps {
  average: number;
  starClassName: string;
}

export function AverageRating({ average, starClassName }: Readonly<AverageRatingProps>) {
  return (
    <>
      <span className="sr-only">Nota média</span>
      <span className="text-4xl font-bold tabular-nums">{formatRating(average)}</span>
      <span className="sr-only">de 5</span>
      <RatingStars rating={average} starClassName={starClassName} />
    </>
  );
}
