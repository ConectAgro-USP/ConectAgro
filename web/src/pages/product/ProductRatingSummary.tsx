import { StarIcon } from "lucide-react";
import { RatingStars } from "./RatingStars";

interface ProductRatingSummaryProps {
  averageRating?: number | null;
  reviewsCount?: number;
  loading?: boolean;
  error?: string;
}

export function ProductRatingSummary({
  averageRating,
  reviewsCount,
  loading = false,
  error = "",
}: Readonly<ProductRatingSummaryProps>) {
  if (loading) {
    return <p className="mt-2 text-sm text-stone-500">Carregando avaliações...</p>;
  }

  if (error) {
    return <p className="mt-2 text-sm text-stone-500">Avaliações indisponíveis</p>;
  }

  if (averageRating == null || reviewsCount == null || reviewsCount === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 text-stone-600" aria-label="Avaliações do agricultor">
        <div className="flex text-stone-300" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon key={i} className="size-5 fill-stone-200 stroke-stone-300" />
          ))}
        </div>
        <span className="text-sm font-medium text-stone-500">(Sem avaliações)</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-stone-600" aria-label="Avaliações do agricultor">
      <span className="font-medium">{averageRating.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
      <RatingStars rating={averageRating} />
      <span className="text-sm text-stone-500">({reviewsCount})</span>
    </div>
  );
}
