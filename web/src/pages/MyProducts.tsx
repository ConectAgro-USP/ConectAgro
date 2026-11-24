import { useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError, errorMessage } from "../api/client";
import type { MyProduct, ProductInput } from "../api/products";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ProductCard } from "../components/products/ProductCard";
import { ProductForm } from "../components/products/ProductForm";
import { inTab, type ProductTab } from "../components/products/productState";
import { ProductTabs } from "../components/products/ProductTabs";
import { TitleBar } from "../components/TitleBar";
import { useProducts } from "../hooks/useProducts";

export function MyProducts() {
  const products = useProducts();
  const [params, setParams] = useSearchParams();
  // a página inicial abre o cadastro direto pelo endereço
  const [showForm, setShowForm] = useState(params.get("novo") === "1");
  const [editing, setEditing] = useState<MyProduct | null>(null);
  const [tab, setTab] = useState<ProductTab>("all");
  const empty = !products.loading && products.error === "" && products.data.length === 0;
  const shown = products.data.filter((product) => inTab(tab, product));

  function openForm(product: MyProduct | null) {
    setEditing(product);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    if (params.has("novo")) setParams({}, { replace: true });
  }

  async function save(input: ProductInput, picture: Blob | null) {
    const saved = editing
      ? await products.update(editing.public_id, input)
      : await products.create(input);
    // salvar de novo depois de a foto falhar altera o produto, sem duplicar
    setEditing(saved);
    if (picture) {
      await products.uploadPicture(saved.public_id, picture).catch((uploadError: unknown) => {
        const status = uploadError instanceof ApiError ? uploadError.status : 0;
        const reason = errorMessage(uploadError);
        throw new ApiError(status, `O produto foi salvo, mas a foto não foi enviada. ${reason}`);
      });
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar
        title="Meus produtos"
        back={
          showForm
            ? { label: "Voltar aos meus produtos", onClick: closeForm }
            : undefined
        }
      />
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        {showForm ? (
          <ProductForm product={editing} onSave={save} onClose={closeForm} />
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
              <>
                <ProductTabs products={products.data} chosen={tab} onChoose={setTab} />
                {shown.length === 0 && (
                  <p className="mt-6 text-lg">
                    {tab === "available"
                      ? "Nenhum produto à venda agora."
                      : "Todos os seus produtos estão à venda."}
                  </p>
                )}
                <ul className="mt-6 space-y-6">
                  {shown.map((product) => (
                    <ProductCard
                      key={product.public_id}
                      product={product}
                      onEdit={() => openForm(product)}
                      onRemove={() => products.remove(product.public_id)}
                      onSetAvailable={(available) =>
                        products.setAvailable(product.public_id, available)
                      }
                    />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
