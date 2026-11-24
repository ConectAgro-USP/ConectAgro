import { EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import type { MyProduct } from "../../api/products";
import { daysUntil, formatFullDate, formatMoney, formatQuantity, pricePer } from "../../format";
import { useAction } from "../../hooks/useAction";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";
import { DangerButton, PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";
import { ProductPicture } from "../ProductPicture";
import { CARD_SURFACE, CARD_TAB } from "../surface";
import { STATE_LABELS, stateOf, type ProductState } from "./productState";

const CARD_CLASSES = `relative flex flex-col overflow-hidden sm:flex-row ${CARD_SURFACE}`;
const PICTURE_CLASSES = "w-full shrink-0 sm:my-6 sm:ml-6 sm:w-48 sm:rounded-2xl";
const NAME_LINK_CLASSES =
  "rounded-sm underline decoration-stone-300 decoration-2 underline-offset-4 " +
  "hover:decoration-lime-800 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800";
const CHIP_CLASSES = "rounded-full px-3 py-0.5 font-bold";
const STATE_CLASSES: Record<ProductState, string> = {
  available: "bg-lime-100 text-lime-900",
  paused: "bg-stone-200 text-stone-800",
  expired: "bg-red-100 text-red-900",
  soldOut: "bg-amber-100 text-amber-900",
};
// no celular os botões dividem a largura do cartão
const BUTTON_ROW_CLASSES = "flex w-full gap-3 sm:w-auto sm:justify-end";
const ACTION_ROW_CLASSES =
  "grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-end";
const BUTTON_CLASSES = "flex-1 sm:flex-none";

interface ProductCardProps {
  product: MyProduct;
  onEdit: () => void;
  onRemove: () => Promise<void>;
  onSetAvailable: (available: boolean) => Promise<void>;
}

export function ProductCard({
  product,
  onEdit,
  onRemove,
  onSetAvailable,
}: Readonly<ProductCardProps>) {
  const [confirming, setConfirming] = useState(false);
  const removal = useAction();
  const availability = useAction();
  const nameId = useId();
  const backId = useFocusWithoutScroll(confirming);
  const buttonProps = {
    "aria-describedby": nameId,
    disabled: removal.pending || availability.pending,
    size: "compact" as const,
  };
  const days = daysUntil(product.expiration_date);
  const state = stateOf(product);

  function goBack() {
    removal.setError("");
    setConfirming(false);
  }

  function askToRemove() {
    availability.setError("");
    setConfirming(true);
  }

  return (
    <li className={CARD_CLASSES}>
      <ProductPicture url={product.picture_url} className={PICTURE_CLASSES} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 sm:px-8">
        <div className="space-y-2 sm:pr-52">
          <h2 id={nameId} className="text-2xl break-words sm:text-3xl">
            <Link to={`/produtos/${product.public_id}`} className={NAME_LINK_CLASSES}>
              {product.name}
            </Link>
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`${CHIP_CLASSES} ${STATE_CLASSES[state]}`}>
              {STATE_LABELS[state]}
            </span>
            <span className="text-stone-600">
              Estoque: {formatQuantity(product.quantity, product.unit)}
            </span>
          </p>
          {state !== "available" && (
            <p className="flex items-center gap-2 font-bold text-stone-700">
              <EyeOffIcon aria-hidden="true" className="size-5 shrink-0" />
              Compradores não veem este produto
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <p className="text-xl font-bold">
            Valor <span className="tabular-nums">{formatMoney(product.price)}</span>{" "}
            <span className="font-normal">{pricePer(product.unit)}</span>
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
                  id={backId}
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
            <div className="w-full space-y-3 sm:w-auto">
              <FormError message={availability.error} />
              <div className={ACTION_ROW_CLASSES}>
                {/* longe do Remover vermelho que aparece na confirmação */}
                <SecondaryButton {...buttonProps} onClick={askToRemove}>
                  Remover
                </SecondaryButton>
                <SecondaryButton
                  {...buttonProps}
                  onClick={() => availability.run(() => onSetAvailable(!product.is_available))}
                  className="order-first col-span-2 sm:order-none"
                >
                  {product.is_available ? "Pausar vendas" : "Retomar vendas"}
                </SecondaryButton>
                <PrimaryButton type="button" {...buttonProps} onClick={onEdit}>
                  Editar
                </PrimaryButton>
              </div>
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
