import { useState } from "react";
import type { Interest } from "../../api/interests";
import type { ProductDetail } from "../../api/products";
import { DangerButton, PrimaryButton, SecondaryButton } from "../../components/Button";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";
import { chosenText, deliveredText } from "../../interestState";
import { NOTE_CLASSES, upToHint } from "./buyBox";
import { QuantityField } from "./QuantityField";

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
        <QuantityField
          stock={stock}
          value={quantity}
          disabled={!isAvailable || pending}
          hint={isAvailable ? upToHint(product) : null}
          exceeds={isAvailable && exceeds}
          onChange={(value) => {
            setQuantity(value);
            onEdit();
          }}
        />
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
