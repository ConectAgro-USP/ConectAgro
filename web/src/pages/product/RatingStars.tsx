import { StarIcon } from "lucide-react";

interface RatingStarsProps {
  rating: number;
  size?: "small" | "medium";
}

export function RatingStars({ rating, size = "small" }: Readonly<RatingStarsProps>) {
  const iconSize = size === "medium" ? "size-6" : "size-5";

  return (
    <span className="flex" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon
          key={index}
          className={`${iconSize} ${index < Math.round(rating) ? "fill-amber-400 stroke-amber-500" : "fill-transparent stroke-stone-700"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
