import { useId, useState } from "react";
import type { Product } from "../../api/products";
import { daysUntil, formatFullDate, formatMoney } from "../../format";
import { useAction } from "../../hooks/useAction";
import { DangerButton, PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";
import { ProductPicture } from "../ProductPicture";
import { CARD_SURFACE, CARD_TAB } from "../surface";

const CARD_CLASSES = `relative flex flex-col overflow-hidden sm:flex-row ${CARD_SURFACE}`;
const PICTURE_CLASSES = "w-full shrink-0 sm:my-6 sm:ml-6 sm:w-48 sm:rounded-2xl";
// no celular os botões dividem a largura do cartão
const BUTTON_ROW_CLASSES = "flex w-full gap-3 sm:w-auto sm:justify-end";
const BUTTON_CLASSES = "flex-1 sm:flex-none";

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onRemove: () => Promise<void>;
}

export function ProductCard({ product, onEdit, onRemove }: Readonly<ProductCardProps>) {
  const [confirming, setConfirming] = useState(false);
  const removal = useAction();
  const nameId = useId();
  const buttonProps = {
    "aria-describedby": nameId,
    disabled: removal.pending,
    size: "compact" as const,
  };
  const days = daysUntil(product.expiration_date);

  function goBack() {
    removal.setError("");
    setConfirming(false);
  }

  return (
    <li className={CARD_CLASSES}>
      <ProductPicture url={product.picture_url} className={PICTURE_CLASSES} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 sm:px-8">
        <div className="sm:pr-52">
          <h2 id={nameId} className="text-2xl break-words sm:text-3xl">
            {product.name}
          </h2>
          <p className="text-stone-600">Estoque: {product.quantity} kg</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <p className="text-xl font-bold">
            Valor <span className="tabular-nums">{formatMoney(product.price)}</span>
          </p>
          {confirming ? (
            <div className="space-y-3 sm:text-right">
              <p>
                <span className="font-bold">Remover {product.name}?</span> O produto sai do
                catálogo e não pode ser recuperado.
              </p>
              <FormError message={removal.error} />
              <div className={BUTTON_ROW_CLASSES}>
                {/* um clique duplo em Remover cai aqui, e não remove */}
                <SecondaryButton
                  autoFocus
                  {...buttonProps}
                  onClick={goBack}
                  className={BUTTON_CLASSES}
                >
                  Voltar
                </SecondaryButton>
                <DangerButton
                  {...buttonProps}
                  onClick={() => removal.run(onRemove)}
                  className={BUTTON_CLASSES}
                >
                  Remover
                </DangerButton>
              </div>
            </div>
          ) : (
            <div className={BUTTON_ROW_CLASSES}>
              <SecondaryButton
                {...buttonProps}
                onClick={() => setConfirming(true)}
                className={BUTTON_CLASSES}
              >
                Remover
              </SecondaryButton>
              <PrimaryButton
                type="button"
                {...buttonProps}
                onClick={onEdit}
                className={BUTTON_CLASSES}
              >
                Editar
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
      <p className={`${CARD_TAB} tabular-nums ${days <= 7 ? "bg-amber-700" : "bg-lime-700"}`}>
        {days < 0 ? "Venceu" : "Vence"} {formatFullDate(product.expiration_date)}
      </p>
    </li>
  );
}
