import { useState } from "react";
import type { Interest } from "../../api/interests";
import type { ProductDetail } from "../../api/products";
import { DangerButton, PrimaryButton, SecondaryButton } from "../../components/Button";
import { formatQuantity } from "../../format";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";
import { chosenText, deliveredText } from "../../interestState";
import { NOTE_CLASSES, QUANTITY_CLASSES, digitsOnly } from "./buyBox";

// sem a compra em andamento, que só mostra o aviso
interface InterestFormProps {
  product: ProductDetail;
  interest: Interest | undefined;
  isAvailable: boolean;
  stock: string;
  pending: boolean;
  onSubmit: (quantity: number) => void;
  onRemove: () => void;
  onEdit: () => void;
}

export function InterestForm({
  product,
  interest,
  isAvailable,
  stock,
  pending,
  onSubmit,
  onRemove,
  onEdit,
}: Readonly<InterestFormProps>) {
  // com a compra o interesse foi entregue, e pode ser pedido de novo
  const delivery = interest?.purchase ?? null;
  const open = interest !== undefined && delivery === null;
  const [quantity, setQuantity] = useState(() => {
    if (interest) return String(interest.quantity);
    return isAvailable ? "1" : "";
  });
  const [confirming, setConfirming] = useState(false);
  const backId = useFocusWithoutScroll(confirming);
  const requested = Number(quantity);
  // diminuir um interesse aberto vale mesmo acima do estoque de agora
  const kept = open ? interest.quantity : 0;
  const exceeds = requested > Math.max(product.quantity, kept);
  const unchanged = open && requested === kept;
  const canSubmit = isAvailable && requested > 0 && !exceeds && !unchanged && !pending;
  let submitLabel = pending ? "Registrando interesse..." : "Registrar interesse";
  if (open) submitLabel = "Atualizar interesse";
  if (delivery) submitLabel = "Pedir de novo";

  return (
    <>
      <div className="mt-4">
        {open && (
          <p className="mb-3 font-bold text-lime-900">{chosenText(kept, product.unit)}</p>
        )}
        {delivery && <p className={`mb-3 ${NOTE_CLASSES}`}>{deliveredText(delivery)}</p>}
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="quantity-input" className="font-bold text-stone-900">
            Quantidade
          </label>
          <span className="font-medium text-stone-700">{stock}</span>
        </div>
        <input
          id="quantity-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={!isAvailable || pending}
          value={quantity}
          onChange={(event) => {
            if (!digitsOnly(event.target.value)) return;
            setQuantity(event.target.value);
            onEdit();
          }}
          className={QUANTITY_CLASSES}
        />
        {isAvailable && (
          <p className="mt-1 text-stone-700">
            Escolha uma quantidade de até {formatQuantity(product.quantity, product.unit)}.
          </p>
        )}
        {isAvailable && exceeds && (
          <p role="alert" className="mt-1 font-bold text-red-700">
            A quantidade informada excede o estoque disponível.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {confirming ? (
          <>
            {/* o texto vem antes, e o segundo toque cai nele ou no Voltar */}
            <div className="space-y-1">
              <p className="font-bold">Remover o seu interesse neste produto?</p>
              <p>O síndico deixa de contar a sua quantidade nas necessidades do prédio.</p>
            </div>
            <SecondaryButton
              id={backId}
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="w-full"
            >
              Voltar
            </SecondaryButton>
            <DangerButton disabled={pending} onClick={onRemove} className="w-full">
              Remover
            </DangerButton>
          </>
        ) : (
          <>
            <PrimaryButton
              type="button"
              disabled={!canSubmit}
              onClick={() => onSubmit(requested)}
              className="w-full"
            >
              {submitLabel}
            </PrimaryButton>
            {open && (
              <SecondaryButton
                disabled={pending}
                onClick={() => {
                  onEdit();
                  setConfirming(true);
                }}
                className="w-full"
              >
                Remover
              </SecondaryButton>
            )}
          </>
        )}
      </div>
    </>
  );
}
