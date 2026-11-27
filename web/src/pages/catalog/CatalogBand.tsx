import { useAuth } from "../../auth/AuthContext";
import { ProductSearch } from "../../components/ProductSearch";

function useBuildingName(): string | null {
  const { user, profileType } = useAuth();
  const building = profileType === "apartment" ? user?.apartment : user?.buyer?.apartment;
  return building?.building_name ?? null;
}

// a partir de 1024 px a busca fica no cabeçalho
export function CatalogBand() {
  const building = useBuildingName();

  return (
    <div className="bg-lime-700 px-4 py-3 text-white sm:px-6 sm:py-4">
      <div className="mx-auto max-w-5xl">
        <p className="font-bold text-balance sm:text-xl">
          Conectando residências à agricultura familiar
        </p>
        {building && (
          <p title={building} className="truncate text-lime-50">
            Comprando para <span className="font-bold">{building}</span>
          </p>
        )}
        <ProductSearch className="mt-2 lg:hidden" />
      </div>
    </div>
  );
}
