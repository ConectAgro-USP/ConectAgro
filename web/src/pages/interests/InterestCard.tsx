import { useId, useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import type { Interest } from "../../api/interests";
import { DangerButton, PrimaryButton, SecondaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { useAction } from "../../hooks/useAction";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";

const CARD_CLASSES = "rounded-3xl border border-stone-200 bg-stone-100 p-5 sm:px-6";
const NAME_LINK_CLASSES =
  "rounded text-lime-800 underline focus-visible:outline-2 focus-visible:outline-lime-800";
const STATUS_CLASSES = "shrink-0 rounded-full px-3 py-1 text-sm font-bold";
const AVAILABLE_COLORS = "bg-lime-100 text-lime-800";
const UNAVAILABLE_COLORS = "bg-stone-200 text-stone-700";
const QUANTITY_CLASSES =
  "h-14 w-full min-w-0 rounded-xl border border-stone-400 bg-white px-4 text-lg font-bold " +
  "text-stone-900 tabular-nums focus:border-lime-800 focus:outline-1 focus:outline-lime-800 " +
  "disabled:cursor-not-allowed disabled:bg-stone-100 sm:w-36";
const BODY_CLASSES = "mt-4 sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-x-6";
const ACTIONS_CLASSES = "mt-4 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
const CONFIRM_ROW_CLASSES = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row";
const AVAILABLE = "Disponível";
// nove dígitos sempre cabem no inteiro da API
const MAX_DIGITS = 9;

interface InterestCardProps {
  interest: Interest;
  onSave: (quantity: number) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function InterestCard({ interest, onSave, onRemove }: Readonly<InterestCardProps>) {
  const name = interest.product_name ?? "Produto removido";
  const available = interest.product_status === AVAILABLE;
  const [quantity, setQuantity] = useState(String(interest.quantity));
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = useAction();
  const removal = useAction();
  const nameId = useId();
  const quantityId = useId();
  const backId = useFocusWithoutScroll(confirming);
  const requested = Number(quantity);
  const invalid = requested < 1;
  const removalProps = { "aria-describedby": nameId, disabled: removal.pending };
  // abaixo do rótulo, o Remover fica na altura do campo e não das mensagens
  const idleActions = available ? "sm:self-start sm:mt-7" : "sm:mt-0";

  function change(value: string) {
    if (/\D/.test(value)) {
      return;
    }
    setQuantity(value);
    setSaved(false);
    save.setError("");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    save.run(async () => {
      await onSave(requested);
      setSaved(true);
    });
  }

  function goBack() {
    removal.setError("");
    setConfirming(false);
  }

  return (
    <li className={CARD_CLASSES}>
      <div className="flex items-start justify-between gap-4">
        <h2 id={nameId} className="min-w-0 text-xl font-bold break-words">
          {interest.product_public_id ? (
            <Link to={`/produtos/${interest.product_public_id}`} className={NAME_LINK_CLASSES}>
              {name}
            </Link>
          ) : (
            name
          )}
        </h2>
        <span className={`${STATUS_CLASSES} ${available ? AVAILABLE_COLORS : UNAVAILABLE_COLORS}`}>
          {interest.product_status}
        </span>
      </div>
      <div className={BODY_CLASSES}>
        {available ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor={quantityId} className="block text-sm font-bold">
              Quantidade (kg)
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
                aria-describedby={nameId}
                disabled={invalid || requested === interest.quantity || save.pending}
              >
                Salvar
              </PrimaryButton>
            </div>
            {invalid && <FormError message="Informe uma quantidade de pelo menos 1 kg" />}
            <FormError message={save.error} />
          </form>
        ) : (
          <div className="text-stone-600">
            <p className="text-lg font-bold text-stone-900 tabular-nums">{interest.quantity} kg</p>
            <p>Como o produto está indisponível, o interesse só pode ser removido.</p>
          </div>
        )}
        <div className={`${ACTIONS_CLASSES} ${confirming ? "sm:col-span-2" : idleActions}`}>
          {confirming ? (
            <>
              {/* em duas linhas os botões descem, longe do primeiro toque */}
              <div className="w-full space-y-3 sm:text-right">
                <p className="font-bold">Remover o interesse em {name}?</p>
                <p>O síndico deixa de contar a sua quantidade nas necessidades do prédio.</p>
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
      <output className={saved ? "mt-4 block font-bold text-lime-800" : "block"}>
        {saved ? "Quantidade atualizada" : ""}
      </output>
    </li>
  );
}
