import { useMemo, useState } from "react";
import { StarIcon } from "lucide-react";
import type { FarmerReviews } from "../../api/reviews";
import { useReviewablePurchase } from "../../hooks/useReviewablePurchase";
import { FarmerReviewForm } from "./FarmerReviewForm";
import { RatingStars } from "./RatingStars";

interface ProductReviewsSectionProps {
  farmerPublicId: string;
  data: FarmerReviews | null;
  loading: boolean;
  error: string;
  onReviewSubmitted: () => void;
}

function reviewDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

type ReviewSort = "newest" | "highest" | "lowest";

export function ProductReviewsSection({
  farmerPublicId,
  data,
  loading,
  error,
  onReviewSubmitted,
}: Readonly<ProductReviewsSectionProps>) {
  const reviewable = useReviewablePurchase(farmerPublicId);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const sortedReviews = useMemo(() => {
    const reviews = [...(data?.reviews ?? [])];
    if (sort === "highest") return reviews.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") return reviews.sort((a, b) => a.rating - b.rating);
    return reviews.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [data, sort]);

  return (
    <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <h2 className="text-2xl font-bold text-stone-900">Avaliações</h2>
        {data && data.reviews.length > 1 && (
          <label className="text-sm text-stone-600">
            <span className="sr-only">Ordenar avaliações</span>
            <select
              aria-label="Ordenar avaliações"
              value={sort}
              onChange={(event) => setSort(event.target.value as ReviewSort)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5"
            >
              <option value="newest">Mais recentes</option>
              <option value="highest">Maior nota</option>
              <option value="lowest">Menor nota</option>
            </select>
          </label>
        )}
      </div>

      {reviewable.purchase && (
        <FarmerReviewForm
          key={`${farmerPublicId}:${reviewable.purchase.purchase_public_id}`}
          purchasePublicId={reviewable.purchase.purchase_public_id}
          farmerPublicId={farmerPublicId}
          onSubmitted={onReviewSubmitted}
        />
      )}
      {reviewable.loading && <p className="mt-4 text-sm text-stone-500">Verificando avaliações pendentes...</p>}
      {reviewable.error && (
        <p role="status" className="mt-4 text-sm text-stone-500">
          Não foi possível verificar se há compras para avaliar.
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-stone-600">Carregando avaliações...</p>
      ) : error || !data || data.reviews_count === 0 ? (
        <div className="mt-6 rounded-xl bg-stone-50 p-6 text-center text-stone-600">
          <div className="mb-2 flex justify-center text-stone-300" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <StarIcon key={i} className="size-6 fill-stone-200 stroke-stone-300" />
            ))}
          </div>
          <p className="font-semibold text-stone-800">Avaliações em breve</p>
          <p className="mt-2 text-sm text-stone-500">
            {error
              ? "Não foi possível carregar as avaliações."
              : "Este agricultor ainda não recebeu avaliações."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {sortedReviews.map((review) => (
            <article key={review.public_id} className="rounded-xl border border-stone-200 p-4">
              <RatingStars rating={review.rating} />
              {review.comment && <p className="mt-3 text-stone-800">{review.comment}</p>}
              <p className="mt-3 text-sm font-medium text-stone-500">
                Feita em {reviewDate(review.created_at)}
              </p>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
