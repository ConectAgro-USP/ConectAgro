import { useState } from "react";
import { useAction } from "../../hooks/useAction";
import { DangerButton, PrimaryButton, SecondaryButton } from "../Button";
import { FormError } from "../FormError";

const ACTIONS_CLASSES = "mt-6 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
// os rótulos são compridos, então no celular um botão fica sobre o outro
const BUTTON_ROW_CLASSES = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row";

interface StatusActionsProps {
  open: boolean;
  describedBy: string;
  disabled: boolean;
  cancel: { label: string; question: string; hint: string };
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
  const { error, setError, pending, run } = useAction();
  const buttonProps = { "aria-describedby": describedBy, disabled: disabled || pending };

  // fechado o pedido, o motivo da recusa continua no cartão
  if (!open && !error) {
    return null;
  }

  function send(request: () => Promise<unknown>) {
    run(async () => {
      try {
        await request();
      } finally {
        // mesmo com erro, o pedido pode ter mudado em outra tela
        reload();
      }
    });
  }

  function goBack() {
    setError("");
    setConfirming(false);
  }

  return (
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
          <SecondaryButton autoFocus {...buttonProps} onClick={goBack}>
            Voltar
          </SecondaryButton>
          <DangerButton {...buttonProps} onClick={() => send(onCancel)}>
            {cancel.label}
          </DangerButton>
        </div>
      )}
      {open && !confirming && (
        <div className={BUTTON_ROW_CLASSES}>
          <SecondaryButton {...buttonProps} onClick={() => setConfirming(true)}>
            {cancel.label}
          </SecondaryButton>
          {onDeliver && (
            <PrimaryButton type="button" {...buttonProps} onClick={() => send(onDeliver)}>
              Marcar como entregue
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}
