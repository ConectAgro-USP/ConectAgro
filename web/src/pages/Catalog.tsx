import { listCatalog, type CatalogProduct } from "../api/products";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { Logo } from "../components/Logo";
import { ProductRow } from "../components/farmers/ProductRow";
import { usePages } from "../hooks/usePages";

const HERO_CLASSES =
  "border-b border-stone-200 bg-stone-100 px-4 py-10 text-center sm:px-6 sm:py-16";
const ROW_CLASSES = "border border-stone-200 bg-stone-100";

function sellerOf(product: CatalogProduct): string {
  const names = [product.farmer_short_name, product.farmer_farm_name].filter(Boolean);
  return names.join(", ") || "Agricultor";
}

export function Catalog() {
  const products = usePages(listCatalog, null, { keyOf: (product) => product.public_id });
  const empty = !products.loading && products.error === "" && products.items.length === 0;

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <div className={HERO_CLASSES}>
        <h1 className="text-5xl tracking-tight text-stone-800 sm:text-8xl lg:text-9xl">
          <Logo />
        </h1>
        <p className="mt-4 text-lg text-stone-700 sm:mt-8 sm:text-xl">
          Conectando residências à agricultura familiar
        </p>
      </div>
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Produtos em destaque</h2>
        {products.items.length > 0 && (
          <ul className="mt-6 space-y-4">
            {products.items.map((product) => (
              <ProductRow
                key={product.public_id}
                product={product}
                seller={sellerOf(product)}
                className={ROW_CLASSES}
              />
            ))}
          </ul>
        )}
        {empty && <p className="mt-6 text-lg">Nenhum produto disponível agora.</p>}
        <div className="flex flex-col items-center gap-3 pt-6">
          <output className="text-stone-600">
            {products.loading ? "Carregando os produtos..." : ""}
          </output>
          <FormError message={products.error} />
          {products.error && (
            <SecondaryButton onClick={products.retry}>Tentar de novo</SecondaryButton>
          )}
          {products.hasMore && !products.loading && !products.error && (
            <SecondaryButton onClick={products.loadMore}>Mostrar mais produtos</SecondaryButton>
          )}
        </div>
      </section>
    </main>
  );
}
