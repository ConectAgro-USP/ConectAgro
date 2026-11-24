import { Link, useParams } from "react-router";
import { SecondaryButton } from "../components/Button";
import { buttonClasses } from "../components/buttonClasses";
import { FormError } from "../components/FormError";
import { ProductPicture } from "../components/ProductPicture";
import { CARD_SURFACE } from "../components/surface";
import { formatFullDate, formatMoney, pricePer } from "../format";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useProductDetail } from "../hooks/useProductDetail";
import { ProductActions } from "./product/ProductActions";
import { ProductDescription } from "./product/ProductDescription";
import { ProductFarmerInfo } from "./product/ProductFarmerInfo";

const PICTURE_CLASSES = "w-full shrink-0 rounded-2xl md:w-72 lg:w-80";
const HOME_LINK_CLASSES = `flex items-center ${buttonClasses("primary")}`;

export function ProductDetail() {
  const { publicId } = useParams<{ publicId: string }>();
  const { product, loading, error, retry, refresh } = useProductDetail(publicId);
  useDocumentTitle(product?.name ?? "Produto");

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-stone-600">Carregando produto...</p>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <FormError message={error || "Produto não encontrado"} />
          <div className="flex gap-4">
            <SecondaryButton onClick={retry}>Tentar de novo</SecondaryButton>
            <Link to="/" className={HOME_LINK_CLASSES}>
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className={`flex flex-col gap-8 p-6 md:flex-row ${CARD_SURFACE}`}>
          <ProductPicture url={product.picture_url} className={PICTURE_CLASSES} />

          <div className="flex flex-1 flex-col">
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              {product.name}
            </h1>

            {/* a caixa de compra junta preço, estoque e ações */}
            <div className={`mt-6 p-5 sm:p-6 ${CARD_SURFACE}`}>
              <p className="text-3xl font-bold text-stone-900">
                {formatMoney(product.price)}{" "}
                <span className="text-xl font-semibold text-stone-700">
                  {pricePer(product.unit)}
                </span>
              </p>
              <p className="mt-1 text-stone-700">
                Validade{" "}
                <span className="font-semibold text-stone-900 tabular-nums">
                  {formatFullDate(product.expiration_date)}
                </span>
              </p>
              <ProductActions product={product} onConflict={refresh} />
            </div>

            <ProductFarmerInfo farmer={product.farmer} />
          </div>
        </div>

        <ProductDescription description={product.description} />
      </div>
    </main>
  );
}
