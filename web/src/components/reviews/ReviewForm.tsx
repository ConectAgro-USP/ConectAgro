import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { COMMENT_MAX_LENGTH, type ReviewCreate } from "../../api/reviews";
import { useAction } from "../../hooks/useAction";
import { PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";
import { FarmerAvatar } from "./FarmerAvatar";
import { StarRatingField } from "./StarRating";

const TEXTAREA_CLASSES =
  "block min-h-40 w-full resize-y rounded-lg border border-stone-400 bg-white p-4 " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800 disabled:cursor-not-allowed";
const NO_RATING = "Escolha uma nota de 1 a 5 estrelas";

function submitLabel(editing: boolean, pending: boolean): string {
  if (editing) {
    return pending ? "Salvando..." : "Salvar";
  }
  return pending ? "Enviando..." : "Enviar";
}

interface ReviewFormProps {
  farmerName: string;
  context: string;
  initial: ReviewCreate;
  editing?: boolean;
  onSubmit: (review: ReviewCreate) => Promise<void>;
  onCancel: () => void;
}

export function ReviewForm({
  farmerName,
  context,
  initial,
  editing = false,
  onSubmit,
  onCancel,
}: Readonly<ReviewFormProps>) {
  const [rating, setRating] = useState(initial.rating);
  const [comment, setComment] = useState(initial.comment);
  const { error, setError, pending, run } = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const commentId = useId();
  const counterId = useId();

  useEffect(() => {
    heading.current?.focus();
  }, []);

  function chooseRating(chosen: number) {
    setRating(chosen);
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === 0) {
      setError(NO_RATING);
      return;
    }
    run(() => onSubmit({ rating, comment: comment.trim() }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-4xl border border-stone-200 bg-stone-100 px-6 sm:px-10"
    >
      <div className="flex items-center gap-5 py-8">
        <FarmerAvatar name={farmerName} />
        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="text-2xl outline-none sm:text-3xl">
            {farmerName}
          </h2>
          <p className="text-stone-600">{context}</p>
        </div>
      </div>
      <div className="space-y-8 border-t border-stone-300 py-8">
        <StarRatingField
          legend="Sua nota"
          value={rating}
          onChange={chooseRating}
          disabled={pending}
        />
        <div>
          <label htmlFor={commentId} className="mb-2 block text-lg font-bold">
            Comentário <span className="font-normal">(opcional)</span>
          </label>
          <textarea
            id={commentId}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            disabled={pending}
            aria-describedby={counterId}
            placeholder="Conte como foram os produtos e a entrega para ajudar outros prédios"
            className={TEXTAREA_CLASSES}
          />
          <p id={counterId} className="mt-2 text-right text-stone-600 tabular-nums">
            {comment.length}/{COMMENT_MAX_LENGTH} caracteres
          </p>
        </div>
      </div>
      <div className="space-y-4 border-t border-stone-300 py-6">
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-3">
          <SecondaryButton disabled={pending} onClick={onCancel}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton disabled={pending}>{submitLabel(editing, pending)}</PrimaryButton>
        </div>
      </div>
    </form>
  );
}
