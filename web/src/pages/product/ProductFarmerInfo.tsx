import type { ProductFarmer } from "../../api/products";

interface ProductFarmerInfoProps {
  farmer: ProductFarmer;
}

export function ProductFarmerInfo({ farmer }: Readonly<ProductFarmerInfoProps>) {
  return (
    <div className="mt-6 flex items-center gap-3 border-t border-stone-200 pt-4">
      <span className="text-sm text-stone-600">Vendido por</span>
      <div className="flex items-center gap-2 font-semibold text-stone-900">
        {farmer.picture_url ? (
          <img
            src={farmer.picture_url}
            alt={farmer.short_name}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-lime-100 text-sm font-bold text-lime-800"
          >
            {farmer.short_name.charAt(0)}
          </div>
        )}
        <span>{farmer.short_name}</span>
        {farmer.farm_name && (
          <span className="text-sm font-normal text-stone-500">({farmer.farm_name})</span>
        )}
      </div>
    </div>
  );
}
