import { useEffect, useRef, type SubmitEvent } from "react";
import { isUploadedPicture, type Product, type ProductInput } from "../../api/products";
import { useAction } from "../../hooks/useAction";
import { usePictureChoice } from "../../hooks/usePictureChoice";
import { PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";
import { TextField } from "../TextField";
import { PictureField } from "./PictureField";

const DESCRIPTION_CLASSES =
  "min-h-28 w-full rounded-lg border border-stone-400 bg-white px-4 py-3 " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800";

function readProduct(form: FormData, current: string | null): ProductInput {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    name: text("name"),
    description: text("description") || null,
    // sem link novo, a foto enviada antes continua
    picture_url: text("picture_url") || (isUploadedPicture(current) ? current : null),
    quantity: Number(text("quantity")),
    price: text("price"),
    expiration_date: text("expiration_date"),
  };
}

interface ProductFormProps {
  product: Product | null;
  onSave: (input: ProductInput, picture: Blob | null) => Promise<unknown>;
  onClose: () => void;
}

export function ProductForm({ product, onSave, onClose }: Readonly<ProductFormProps>) {
  const { error, pending, run } = useAction();
  const choice = usePictureChoice();
  const current = product?.picture_url ?? null;
  const title = useRef<HTMLHeadingElement>(null);

  // a lista sai da tela e o foco no título leva ao começo do formulário
  useEffect(() => {
    title.current?.focus();
  }, []);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const picture = choice.chosen?.blob ?? null;
    const input = readProduct(new FormData(event.currentTarget), current);
    // a foto nova só troca o link depois de enviada
    if (picture) input.picture_url = current;
    run(async () => {
      await onSave(input, picture);
      onClose();
    });
  }

  return (
    <>
      <h2 ref={title} tabIndex={-1} className="text-3xl font-extrabold outline-none">
        {product ? "Editar produto" : "Cadastrar produto"}
      </h2>
      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-4xl border border-stone-200 bg-stone-100 px-6 sm:px-10"
      >
        <fieldset disabled={pending} className="divide-y divide-stone-300">
          <PictureField current={current} choice={choice} />
          <div className="space-y-6 py-8">
            <TextField
              label="Nome do produto"
              name="name"
              maxLength={100}
              defaultValue={product?.name ?? ""}
            />
            <div>
              <label htmlFor="product-description" className="mb-2 block font-bold">
                Descrição <span className="font-normal">(opcional)</span>
              </label>
              <textarea
                id="product-description"
                name="description"
                maxLength={1000}
                defaultValue={product?.description ?? ""}
                className={DESCRIPTION_CLASSES}
              />
            </div>
          </div>
          <div className="grid gap-6 py-8 sm:grid-cols-3">
            <TextField
              label="Preço (R$)"
              name="price"
              type="number"
              min={0}
              max={999999.99}
              step="0.01"
              defaultValue={product?.price ?? ""}
            />
            <TextField
              label="Quantidade (kg)"
              name="quantity"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              defaultValue={product?.quantity ?? ""}
            />
            <TextField
              label="Data de vencimento"
              name="expiration_date"
              type="date"
              defaultValue={product?.expiration_date ?? ""}
            />
          </div>
        </fieldset>
        <div className="space-y-4 border-t border-stone-300 py-6">
          <FormError message={error} />
          <div className="flex justify-end gap-3">
            <SecondaryButton disabled={pending} onClick={onClose}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton disabled={pending || choice.preparing}>
              {pending ? "Salvando..." : "Salvar"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </>
  );
}
