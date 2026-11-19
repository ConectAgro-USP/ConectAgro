import { useState, type SubmitEvent } from "react";
import type { Product, ProductInput } from "../api/products";
import { formatMoney } from "../format";
import { PrimaryButton, SecondaryButton, DangerButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { TextField } from "../components/TextField";
import { useAction } from "../hooks/useAction";
import { useProducts } from "../hooks/useProducts";

function productDate(date: string): string {
  return date.split("-").reverse().join("/");
}

function readProduct(form: FormData): ProductInput {
  const optionalText = (key: string) => {
    const value = String(form.get(key) ?? "").trim();
    return value || null;
  };
  return {
    name: String(form.get("name") ?? "").trim(),
    description: optionalText("description"),
    picture_url: optionalText("picture_url"),
    quantity: Number(form.get("quantity")),
    price: String(form.get("price")),
    expiration_date: String(form.get("expiration_date")),
  };
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: Readonly<{
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row">
        {product.picture_url ? (
          <img
            src={product.picture_url}
            alt={product.name}
            className="size-32 rounded-xl object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={`Sem foto para ${product.name}`}
            className="flex size-32 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"
          >
            Sem foto
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold">{product.name}</h2>
          {product.description && <p className="mt-2 text-stone-700">{product.description}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-stone-600">Preço</dt>
              <dd className="font-bold">{formatMoney(product.price)}</dd>
            </div>
            <div>
              <dt className="text-stone-600">Quantidade</dt>
              <dd className="font-bold">{product.quantity} kg</dd>
            </div>
            <div>
              <dt className="text-stone-600">Validade</dt>
              <dd className="font-bold">{productDate(product.expiration_date)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <SecondaryButton onClick={onEdit}>Editar {product.name}</SecondaryButton>
            <DangerButton onClick={onDelete}>Remover {product.name}</DangerButton>
          </div>
        </div>
      </div>
    </li>
  );
}

export function MyProducts() {
  const products = useProducts();
  const { error: actionError, pending, run, setError: setActionError } = useAction();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  function startCreate() {
    setActionError("");
    setEditing(null);
    setShowForm(true);
  }

  function startEdit(product: Product) {
    setActionError("");
    setEditing(product);
    setShowForm(true);
  }

  function cancelForm() {
    setActionError("");
    setShowForm(false);
    setEditing(null);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = readProduct(new FormData(event.currentTarget));
    run(async () => {
      if (editing) {
        await products.update(editing.public_id, input);
      } else {
        await products.create(input);
      }
      cancelForm();
    });
  }

  function handleDelete() {
    if (!deleting) return;
    run(async () => {
      await products.remove(deleting.public_id);
      setDeleting(null);
    });
  }

  return (
    <main className="px-6 py-12 text-stone-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-extrabold">Meus produtos</h1>
          {!showForm && (
            <PrimaryButton type="button" onClick={startCreate}>
              Cadastrar produto
            </PrimaryButton>
          )}
        </div>

        {products.loading && <p role="status">Carregando produtos...</p>}
        {!products.loading && products.error && (
          <div className="space-y-3">
            <FormError message={products.error} />
            <SecondaryButton onClick={products.retry}>Tentar novamente</SecondaryButton>
          </div>
        )}
        {!products.loading && !products.error && products.data.length === 0 && !showForm && (
          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
            <p>Você ainda não cadastrou produtos.</p>
            <PrimaryButton type="button" className="mt-5" onClick={startCreate}>
              Cadastrar produto
            </PrimaryButton>
          </section>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 space-y-5 rounded-2xl border border-stone-200 bg-stone-50 p-6 sm:p-8"
          >
            <h2 className="text-2xl font-bold">
              {editing ? "Editar produto" : "Cadastrar produto"}
            </h2>
            <fieldset disabled={pending} className="space-y-5">
              <TextField
                label="Nome do produto"
                name="name"
                maxLength={100}
                defaultValue={editing?.name ?? ""}
              />
              <div>
                <label htmlFor="product-description" className="mb-2 block font-bold">
                  Descrição <span className="font-normal">(opcional)</span>
                </label>
                <textarea
                  id="product-description"
                  name="description"
                  maxLength={1000}
                  defaultValue={editing?.description ?? ""}
                  className="min-h-24 w-full rounded-lg border border-stone-400 px-4 py-3 focus:border-lime-800 focus:outline-1 focus:outline-lime-800"
                />
              </div>
              <TextField
                label="URL da foto"
                name="picture_url"
                type="url"
                maxLength={2048}
                optional
                defaultValue={editing?.picture_url ?? ""}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Quantidade (kg)"
                  name="quantity"
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  defaultValue={editing?.quantity ?? ""}
                />
                <TextField
                  label="Preço (R$)"
                  name="price"
                  type="number"
                  min={0}
                  max={999999.99}
                  step="0.01"
                  defaultValue={editing?.price ?? ""}
                />
              </div>
              <TextField
                label="Data de vencimento"
                name="expiration_date"
                type="date"
                defaultValue={editing?.expiration_date ?? ""}
              />
            </fieldset>
            <FormError message={actionError} />
            <div className="flex justify-end gap-3">
              <SecondaryButton disabled={pending} onClick={cancelForm}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton disabled={pending}>{pending ? "Salvando..." : "Salvar"}</PrimaryButton>
            </div>
          </form>
        )}

        {!products.loading && !products.error && products.data.length > 0 && (
          <ul className="space-y-4">
            {products.data.map((product) => (
              <ProductCard
                key={product.public_id}
                product={product}
                onEdit={() => startEdit(product)}
                onDelete={() => setDeleting(product)}
              />
            ))}
          </ul>
        )}

        {deleting && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          >
            <section className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-xl">
              <h2 id="delete-product-title" className="text-2xl font-bold">
                Remover produto?
              </h2>
              <p>Tem certeza de que deseja remover {deleting.name}?</p>
              <FormError message={actionError} />
              <div className="flex justify-end gap-3">
                <SecondaryButton disabled={pending} onClick={() => setDeleting(null)}>
                  Cancelar
                </SecondaryButton>
                <DangerButton disabled={pending} onClick={handleDelete}>
                  Remover
                </DangerButton>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
