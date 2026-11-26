import { listFarmerProducts } from "../../api/farmers";
import { usePages } from "../../hooks/usePages";
import type { InterestLookup } from "../../hooks/useInterestLookup";
import { SecondaryButton } from "../Button";
import { FormError } from "../FormError";
import { ShowMore } from "../ShowMore";
import { ProductRow } from "./ProductRow";

interface FarmerProductsProps {
  farmerPublicId: string;
  interests: InterestLookup;
}

export function FarmerProducts({ farmerPublicId, interests }: Readonly<FarmerProductsProps>) {
  const products = usePages(listFarmerProducts, farmerPublicId, {
    keyOf: (product) => product.public_id,
  });
  // a contagem do cartão pode estar velha: produtos chegam, acabam ou vencem com a tela aberta
  const empty = !products.loading && products.error === "" && products.items.length === 0;

  return (
    <>
      {products.items.length > 0 && (
        <ul className="space-y-3">
          {products.items.map((product) => (
            <ProductRow
              key={product.public_id}
              product={product}
              interest={interests.get(product.public_id)}
            />
          ))}
        </ul>
      )}
      {empty && <p className="text-lg">Nenhum produto disponível agora.</p>}
      <div className="flex flex-col items-center gap-3 pt-3">
        {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
        <output className="text-stone-600">
          {products.loading ? "Carregando os produtos..." : ""}
        </output>
        <FormError message={products.error} />
        {products.error && (
          <SecondaryButton onClick={products.retry}>Tentar de novo</SecondaryButton>
        )}
        <ShowMore list={products} label="Mostrar mais produtos" />
      </div>
    </>
  );
}
