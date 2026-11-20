import { useState, type SubmitEvent } from "react";
import { errorMessage } from "../../api/client";
import { createReview } from "../../api/reviews";
import { PrimaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";

interface FarmerReviewFormProps {
  purchasePublicId: string;
  farmerPublicId: string;
  onSubmitted: () => void;
}

export function FarmerReviewForm({
  purchasePublicId,
  farmerPublicId,
  onSubmitted,
}: Readonly<FarmerReviewFormProps>) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await createReview(purchasePublicId, farmerPublicId, { rating, comment });
      setSuccess(true);
      onSubmitted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl bg-stone-50 p-4">
      <h3 className="font-bold text-stone-900">Avalie este agricultor</h3>
      <label className="block text-sm font-semibold text-stone-800">
        Nota
        <select
          aria-label="Nota da avaliação"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="mt-1 block h-11 w-full rounded-lg border border-stone-400 bg-white px-3"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "estrela" : "estrelas"}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-stone-800">
        Comentário (opcional)
        <textarea
          aria-label="Comentário da avaliação"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-stone-400 bg-white p-3 font-normal"
        />
      </label>
      <FormError message={error} />
      {success && <p role="status" className="text-sm font-semibold text-lime-800">Avaliação enviada.</p>}
      <PrimaryButton type="submit" disabled={pending || success}>
        {pending ? "Enviando avaliação..." : "Enviar avaliação"}
      </PrimaryButton>
    </form>
  );
}
