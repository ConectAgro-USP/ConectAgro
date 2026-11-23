import type { ProductFarmer } from "../../api/products";
import { FarmerRating } from "../../components/farmers/FarmerRating";
import { useFarmerReviews } from "../../hooks/useFarmerReviews";

interface ProductFarmerInfoProps {
  farmer: ProductFarmer;
}

function Reviews({ farmerPublicId }: Readonly<{ farmerPublicId: string }>) {
  const { reviews, loading } = useFarmerReviews(farmerPublicId);

  if (loading) {
    return <p className="text-sm text-stone-500">Carregando avaliações...</p>;
  }
  if (reviews === null) {
    return <p className="text-sm text-stone-500">Avaliações indisponíveis</p>;
  }
  return <FarmerRating average={reviews.average_rating} count={reviews.reviews_count} />;
}

export function ProductFarmerInfo({ farmer }: Readonly<ProductFarmerInfoProps>) {
  const name = farmer.short_name || farmer.farm_name || "Agricultor";

  return (
    <div className="mt-6 space-y-2 border-t border-stone-200 pt-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600">Vendido por</span>
        <div className="flex items-center gap-2 font-semibold text-stone-900">
          {farmer.picture_url ? (
            <img
              src={farmer.picture_url}
              alt=""
              referrerPolicy="no-referrer"
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-lime-100 text-sm font-bold text-lime-800"
            >
              {name.charAt(0)}
            </div>
          )}
          <span>{name}</span>
          {farmer.short_name && farmer.farm_name && (
            <span className="text-sm font-normal text-stone-500">({farmer.farm_name})</span>
          )}
        </div>
      </div>
      <Reviews farmerPublicId={farmer.public_id} />
    </div>
  );
}
