import { StarIcon } from "lucide-react";
import { useId, useState } from "react";
import { RATINGS } from "../../api/reviews";
import { formatCount } from "../../format";

const RATING_WORDS = ["Péssimo", "Ruim", "Regular", "Bom", "Incrível"];

const STAR_LABEL_CLASSES =
  "cursor-pointer rounded-full p-1 has-[:focus-visible]:outline-2 " +
  "has-[:focus-visible]:outline-lime-800 has-[:disabled]:cursor-not-allowed";

export function Star({ filled, className = "" }: Readonly<{ filled: boolean; className?: string }>) {
  const color = filled ? "fill-amber-400 text-amber-400" : "text-stone-500";
  return <StarIcon aria-hidden="true" className={`${color} ${className}`} />;
}

interface RatingStarsProps {
  rating: number;
  label?: string;
  starClassName?: string;
}

export function RatingStars({ rating, label, starClassName = "size-6" }: Readonly<RatingStarsProps>) {
  const filled = Math.round(rating);
  return (
    <span className="flex gap-0.5">
      {label && <span className="sr-only">{label}</span>}
      {RATINGS.map((star) => (
        <Star key={star} filled={star <= filled} className={starClassName} />
      ))}
    </span>
  );
}

interface StarRatingFieldProps {
  legend: string;
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export function StarRatingField({
  legend,
  value,
  onChange,
  disabled = false,
}: Readonly<StarRatingFieldProps>) {
  const [hovered, setHovered] = useState(0);
  const name = useId();
  const shown = hovered || value;

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-lg font-bold">{legend}</legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex" onMouseLeave={() => setHovered(0)}>
          {RATINGS.map((rating) => (
            <label
              key={rating}
              onMouseEnter={() => setHovered(rating)}
              className={STAR_LABEL_CLASSES}
            >
              <input
                type="radio"
                name={name}
                value={rating}
                checked={value === rating}
                onChange={() => onChange(rating)}
                className="sr-only"
              />
              <Star filled={rating <= shown} className="size-10" />
              <span className="sr-only">
                {formatCount(rating, "estrela", "estrelas")}, {RATING_WORDS[rating - 1]}
              </span>
            </label>
          ))}
        </div>
        <p aria-hidden="true" className="text-lg font-bold text-amber-700">
          {shown > 0 && RATING_WORDS[shown - 1]}
        </p>
      </div>
    </fieldset>
  );
}
