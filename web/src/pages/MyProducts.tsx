import { useState } from "react";
import type { Product, ProductInput } from "../api/products";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ProductCard } from "../components/products/ProductCard";
import { ProductForm } from "../components/products/ProductForm";
import { TitleBar } from "../components/TitleBar";
import { useProducts } from "../hooks/useProducts";

export function MyProducts() {
  const products = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const empty = !products.loading && products.error === "" && products.data.length === 0;

  function openForm(product: Product | null) {
    setEditing(product);
    setShowForm(true);
  }

  function save(input: ProductInput) {
    if (editing) {
      return products.update(editing.public_id, input);
    }
    return products.create(input);
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar
        title="Meus produtos"
        back={
          showForm
            ? { label: "Voltar aos meus produtos", onClick: () => setShowForm(false) }
            : undefined
        }
      />
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        {showForm ? (
          <ProductForm product={editing} onSave={save} onClose={() => setShowForm(false)} />
        ) : (
          <>
            <PrimaryButton type="button" onClick={() => openForm(null)}>
              Cadastrar produto
            </PrimaryButton>
            <output className="mt-4 block text-lg text-stone-600">
              {products.loading ? "Carregando..." : ""}
            </output>
            <div className="space-y-4">
              <FormError message={products.error} />
              {products.error && (
                <SecondaryButton onClick={products.retry}>Tentar de novo</SecondaryButton>
              )}
            </div>
            {empty && <p className="text-lg">Você ainda não cadastrou produtos.</p>}
            {products.data.length > 0 && (
              <ul className="mt-2 space-y-6">
                {products.data.map((product) => (
                  <ProductCard
                    key={product.public_id}
                    product={product}
                    onEdit={() => openForm(product)}
                    onRemove={() => products.remove(product.public_id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
