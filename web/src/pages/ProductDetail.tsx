import { Link, useParams } from "react-router";
import { FormError } from "../components/FormError";
import { formatMoney } from "../format";
import { useProductDetail } from "../hooks/useProductDetail";
import { ProductActions } from "./product/ProductActions";
import { ProductDescription } from "./product/ProductDescription";
import { ProductFarmerInfo } from "./product/ProductFarmerInfo";
import { ProductImage } from "./product/ProductImage";

function productDate(date: string): string {
  return date.split("-").reverse().join("/");
}

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
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-stone-400 bg-white px-6 py-2.5 font-bold hover:bg-stone-50"
            >
              Tentar novamente
            </button>
            <Link
              to="/"
              className="rounded-full bg-lime-800 px-6 py-2.5 font-bold text-white hover:bg-lime-900"
            >
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
          <ProductImage pictureUrl={product.picture_url} productName={product.name} />

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
                {productDate(product.expiration_date)}
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
