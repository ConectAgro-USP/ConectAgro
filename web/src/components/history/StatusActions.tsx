import { useState } from "react";
import { useAction } from "../../hooks/useAction";
import { useFocusWithoutScroll } from "../../hooks/useFocusWithoutScroll";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { DangerButton, PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";

const ACTIONS_CLASSES = "mt-6 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
// os rótulos são compridos, então no celular um botão fica sobre o outro
const BUTTON_ROW_CLASSES = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row";
const DELIVERED = "Venda marcada como entregue";

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
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { error, setError, pending, run } = useAction();
  const backId = useFocusWithoutScroll(open && confirming);
  const guard = useWriteGuard();
  const buttonProps = {
    "aria-describedby": describedBy,
    disabled: disabled || pending,
    size: "compact" as const,
  };

  function send(request: () => Promise<unknown>, done: string) {
    run(async () => {
      await guard(request());
      setAnnouncement(done);
      reload();
    });
  }

  function openConfirmation() {
    setError("");
    setConfirming(true);
  }

  function goBack() {
    setError("");
    setConfirming(false);
  }

  // fechado o pedido, o motivo da recusa continua no cartão
  const actions = (open || error) && (
    <div className={ACTIONS_CLASSES}>
      {/* em duas linhas os botões descem, e um clique duplo não cancela */}
      {open && confirming && (
        <div className="w-full space-y-3 sm:text-right">
          <p className="font-bold">{cancel.question}</p>
          <p>{cancel.hint}</p>
        </div>
      )}
      <FormError message={error} />
      {open && confirming && (
        <div className={BUTTON_ROW_CLASSES}>
          <DangerButton {...buttonProps} onClick={() => send(onCancel, cancel.done)}>
            {cancel.label}
          </DangerButton>
          <SecondaryButton id={backId} {...buttonProps} onClick={goBack}>
            Voltar
          </SecondaryButton>
        </div>
      )}
      {open && !confirming && (
        <div className={BUTTON_ROW_CLASSES}>
          <SecondaryButton {...buttonProps} onClick={openConfirmation}>
            {cancel.label}
          </SecondaryButton>
          {onDeliver && (
            <PrimaryButton
              type="button"
              {...buttonProps}
              onClick={() => send(onDeliver, DELIVERED)}
            >
              Marcar como entregue
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
