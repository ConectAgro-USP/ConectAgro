import { Link, useParams } from "react-router";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ProductPicture } from "../components/ProductPicture";
import { formatFullDate, formatMoney } from "../format";
import { useProductDetail } from "../hooks/useProductDetail";
import { ProductActions } from "./product/ProductActions";
import { ProductDescription } from "./product/ProductDescription";
import { ProductFarmerInfo } from "./product/ProductFarmerInfo";

const PICTURE_CLASSES = "aspect-square w-full shrink-0 rounded-2xl shadow-xs md:w-72 lg:w-80";
const HOME_LINK_CLASSES =
  "flex h-14 items-center rounded-full bg-lime-800 px-8 font-bold text-white " +
  "hover:bg-lime-900 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800";

export function ProductDetail() {
  const { publicId } = useParams<{ publicId: string }>();
  const { product, loading, error, retry } = useProductDetail(publicId);

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
        <div className="flex flex-col gap-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:flex-row">
          <ProductPicture url={product.picture_url} className={PICTURE_CLASSES} />

          <div className="flex flex-1 flex-col">
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              {product.name}
            </h1>

            <p className="mt-4 text-3xl font-bold text-stone-900">
              {formatMoney(product.price)}/kg
            </p>

            <div className="mt-4">
              <span className="block text-sm text-stone-600">Data de validade:</span>
              <span className="text-base font-semibold text-stone-900">
                {formatFullDate(product.expiration_date)}
              </span>
            </div>

            <ProductActions product={product} />

            <ProductFarmerInfo farmer={product.farmer} />
          </div>
        </div>

        <ProductDescription description={product.description} />
      </div>
    </main>
  );
}
