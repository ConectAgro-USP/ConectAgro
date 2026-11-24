import { useState } from "react";
import { useAction } from "../../hooks/useAction";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { DangerButton, PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";

const ACTIONS_CLASSES = "mt-6 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
// os rótulos são compridos, então no celular um botão fica sobre o outro
const BUTTON_ROW_CLASSES = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row";
const DELIVER = {
  label: "Marcar como entregue",
  question: "Marcar esta venda como entregue?",
  hint: "A entrega não pode ser desfeita. Depois dela o prédio pode avaliar você.",
  confirm: "Confirmar entrega",
  done: "Venda marcada como entregue",
};

type Step = "cancel" | "deliver" | null;

interface StatusActionsProps {
  open: boolean;
  describedBy: string;
  disabled: boolean;
  cancel: { label: string; question: string; hint: string; done: string };
  onCancel: () => Promise<unknown>;
  onDeliver?: () => Promise<unknown>;
  reload: () => void;
}

export function StatusActions({
  open,
  describedBy,
  disabled,
  cancel,
  onCancel,
  onDeliver,
  reload,
}: Readonly<StatusActionsProps>) {
  const [confirming, setConfirming] = useState<Step>(null);
  const [announcement, setAnnouncement] = useState("");
  const { error, setError, pending, run } = useAction();
  const backId = useFocusWithoutScroll(open && confirming !== null);
  const guard = useWriteGuard();
  const buttonProps = {
    "aria-describedby": describedBy,
    disabled: disabled || pending,
    size: "compact" as const,
  };
  const asking = confirming === "deliver" ? DELIVER : cancel;

  function send(request: () => Promise<unknown>, done: string) {
    run(async () => {
      await guard(request());
      setAnnouncement(done);
      reload();
    });
  }

  function openConfirmation(step: Step) {
    setError("");
    setConfirming(step);
  }

  const back = (
    <SecondaryButton id={backId} {...buttonProps} onClick={() => openConfirmation(null)}>
      Voltar
    </SecondaryButton>
  );

  // fechado o pedido, o motivo da recusa continua no cartão
  const actions = (open || error) && (
    <div className={ACTIONS_CLASSES}>
      {/* em duas linhas os botões descem, e um clique duplo não confirma */}
      {open && confirming && (
        <div className="w-full space-y-3 sm:text-right">
          <p className="font-bold">{asking.question}</p>
          <p>{asking.hint}</p>
        </div>
      )}
      <FormError message={error} />
      {open && confirming === "deliver" && onDeliver && (
        <div className={BUTTON_ROW_CLASSES}>
          {/* no celular o segundo toque cai no Voltar, e não entrega */}
          {back}
          <PrimaryButton
            type="button"
            {...buttonProps}
            onClick={() => send(onDeliver, DELIVER.done)}
          >
            {DELIVER.confirm}
          </PrimaryButton>
        </div>
      )}
      {open && confirming === "cancel" && (
        <div className={BUTTON_ROW_CLASSES}>
          <DangerButton {...buttonProps} onClick={() => send(onCancel, cancel.done)}>
            {cancel.label}
          </DangerButton>
          {back}
        </div>
      )}
      {open && !confirming && (
        <div className={BUTTON_ROW_CLASSES}>
          <SecondaryButton {...buttonProps} onClick={() => openConfirmation("cancel")}>
            {cancel.label}
          </SecondaryButton>
          {onDeliver && (
            <PrimaryButton
              type="button"
              {...buttonProps}
              onClick={() => openConfirmation("deliver")}
            >
              {DELIVER.label}
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* sempre montado, para o leitor de tela anunciar o resultado */}
      <output className="sr-only">{announcement}</output>
      {actions}
    </>
  );
}
