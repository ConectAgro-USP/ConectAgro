import { useId, useState, type SubmitEvent } from "react";
import type { Interest } from "../../api/interests";
import { DangerButton, PrimaryButton, SecondaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { CARD_SURFACE } from "../../components/surface";
import { formatQuantity, quantityLabel } from "../../format";
import { useAction } from "../../hooks/useAction";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";
import { AVAILABLE, deliveredText, interestState, purchaseText } from "../../interestState";
import { InterestSummary } from "./InterestSummary";

const CARD_CLASSES = `p-5 sm:px-6 ${CARD_SURFACE}`;
const QUANTITY_CLASSES =
  "h-11 w-full min-w-0 rounded-xl border border-stone-400 bg-white px-4 text-lg font-bold " +
  "text-stone-900 tabular-nums focus:border-lime-800 focus:outline-1 focus:outline-lime-800 " +
  "disabled:cursor-not-allowed disabled:bg-stone-100 sm:w-36";
const BODY_CLASSES = "mt-4 sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-x-6";
const ACTIONS_CLASSES = "mt-4 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
const CONFIRM_ROW_CLASSES = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row";
// nove dígitos sempre cabem no inteiro da API
const MAX_DIGITS = 9;
// o que muda para o morador ao remover, conforme o estado do pedido
const REMOVAL_EFFECTS = {
  open: "O síndico deixa de contar a sua quantidade nas necessidades do prédio.",
  purchase: "A compra do prédio continua, você só deixa de acompanhar o pedido aqui.",
  delivered: "Você deixa de ver esta entrega aqui.",
};

interface InterestCardProps {
  interest: Interest;
  onSave: (quantity: number) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function InterestCard({ interest, onSave, onRemove }: Readonly<InterestCardProps>) {
  const name = interest.product_name ?? "Produto removido";
  const state = interestState(interest);
  const unit = interest.product?.unit;
  const atLeastOne = `Informe uma quantidade de pelo menos ${formatQuantity(1, unit)}`;
  const available = interest.product_status === AVAILABLE;
  // em compra não se edita, e entregue se pede de novo se estiver à venda
  const editable = available && state !== "purchase";
  const [quantity, setQuantity] = useState(String(interest.quantity));
  const [saved, setSaved] = useState("");
  const [confirming, setConfirming] = useState(false);
  const save = useAction();
  const removal = useAction();
  const nameId = useId();
  const quantityId = useId();
  const backId = useFocusWithoutScroll(confirming);
  const requested = Number(quantity);
  const invalid = requested < 1;
  const reordering = state === "delivered";
  const unchanged = !reordering && requested === interest.quantity;
  const removalProps = {
    "aria-describedby": nameId,
    disabled: removal.pending,
    size: "compact" as const,
  };
  // abaixo do rótulo, o Remover fica na altura do campo e não das mensagens
  const idleActions = editable ? "sm:self-start sm:mt-7" : "sm:mt-0";

  function change(value: string) {
    if (/\D/.test(value)) {
      return;
    }
    setQuantity(value);
    setSaved("");
    save.setError("");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    save.run(async () => {
      await onSave(requested);
      setSaved(reordering ? "Interesse registrado de novo" : "Quantidade atualizada");
    });
  }

  function goBack() {
    removal.setError("");
    setConfirming(false);
  }

  let details = "Como o produto está indisponível, o interesse só pode ser removido.";
  if (interest.purchase && state === "purchase") details = purchaseText(interest.purchase);
  if (interest.purchase && reordering) {
    details = available
      ? deliveredText(interest.purchase)
      : `${deliveredText(interest.purchase)}. O produto não está à venda agora.`;
  }

  return (
    <li className={CARD_CLASSES}>
      <InterestSummary interest={interest} name={name} nameId={nameId} />
      <div className={BODY_CLASSES}>
        {editable ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            {reordering && <p className="font-bold text-stone-900">{details}</p>}
            <label htmlFor={quantityId} className="block text-sm font-bold">
              {quantityLabel(unit)}
            </label>
            <div className="flex gap-3">
              <input
                id={quantityId}
                type="text"
                inputMode="numeric"
                maxLength={MAX_DIGITS}
                value={quantity}
                disabled={save.pending}
                onChange={(event) => change(event.target.value)}
                className={QUANTITY_CLASSES}
              />
              <PrimaryButton
                size="compact"
                aria-describedby={nameId}
                disabled={invalid || unchanged || save.pending}
                className="shrink-0"
              >
                {reordering ? "Pedir de novo" : "Salvar"}
              </PrimaryButton>
            </div>
            {invalid && <FormError message={atLeastOne} />}
            <FormError message={save.error} />
          </form>
        ) : (
          <div className="text-stone-600">
            <p className="text-lg font-bold text-stone-900 tabular-nums">
              {formatQuantity(interest.quantity, unit)}
            </p>
            <p>{details}</p>
            {/* a recusa segue à vista depois da releitura */}
            <FormError message={save.error} />
          </div>
        )}
        <div className={`${ACTIONS_CLASSES} ${confirming ? "sm:col-span-2" : idleActions}`}>
          {confirming ? (
            <>
              {/* em duas linhas os botões descem, longe do primeiro toque */}
              <div className="w-full space-y-3 sm:text-right">
                <p className="font-bold">Remover o interesse em {name}?</p>
                <p>{REMOVAL_EFFECTS[state]}</p>
              </div>
              <FormError message={removal.error} />
              <div className={CONFIRM_ROW_CLASSES}>
                <DangerButton {...removalProps} onClick={() => removal.run(onRemove)}>
                  Remover
                </DangerButton>
                <SecondaryButton id={backId} {...removalProps} onClick={goBack}>
                  Voltar
                </SecondaryButton>
              </div>
            </>
          ) : (
            <SecondaryButton
              size="compact"
              aria-describedby={nameId}
              disabled={save.pending}
              onClick={() => setConfirming(true)}
            >
              Remover
            </SecondaryButton>
          )}
        </div>
      </div>
      {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
      <output className={saved ? "mt-4 block font-bold text-lime-800" : "block"}>{saved}</output>
    </li>
  );
}
