import { StarIcon } from "lucide-react";
import { formatCount, formatRating } from "../../format";

interface FarmerRatingProps {
  average: number | null;
  count: number;
}

export function FarmerRating({ average, count }: Readonly<FarmerRatingProps>) {
  if (average === null) {
    return <span className="text-stone-600">Ainda sem avaliações</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <StarIcon aria-hidden="true" className="size-5 fill-amber-400 text-amber-500" />
      <span className="font-bold tabular-nums">{formatRating(average)}</span>{" "}
      <span className="sr-only">de 5</span>{" "}
      <span className="text-stone-600">
        ({formatCount(count, "avaliação", "avaliações")})
      </span>
    </span>
  );
}
