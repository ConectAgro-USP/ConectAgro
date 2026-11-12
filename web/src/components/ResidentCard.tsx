import { useId, useState } from "react";
import type { LinkStatus } from "../api/profiles";
import type { Resident } from "../api/residents";
import { formatDay } from "../format";
import { DangerButton, PrimaryButton, SecondaryButton } from "./Button";

const AVATAR_CLASSES =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xl " +
  "text-white uppercase";
const ACTIONS_CLASSES = "mt-6 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
// no celular os dois botões dividem a largura do cartão
const BUTTON_ROW_CLASSES = "flex w-full gap-3 sm:w-auto";
// o texto da confirmação é comprido, então no celular um botão fica sobre o outro
const CONFIRM_ROW_CLASSES = "flex w-full flex-col gap-3 sm:w-auto sm:flex-row";
const BUTTON_CLASSES = "flex-1 sm:flex-none";

// o que o síndico confirma antes de recusar ou de mudar uma resposta já dada
interface Confirmation {
  ask: (name: string) => string;
  hint: string;
  confirm: string;
}

const CONFIRMATIONS: Record<LinkStatus, Confirmation> = {
  PENDENTE: {
    ask: (name) => `Recusar o pedido de ${name}?`,
    hint: "A pessoa pode corrigir os dados e pedir de novo.",
    confirm: "Recusar pedido",
  },
  APROVADO: {
    ask: (name) => `Tirar ${name} do prédio?`,
    hint: "A pessoa deixa de usar o ConectAgro e pode pedir para entrar de novo.",
    confirm: "Tirar do prédio",
  },
  RECUSADO: {
    ask: (name) => `Aprovar ${name}?`,
    hint: "A pessoa passa a usar o ConectAgro como moradora do prédio.",
    confirm: "Aprovar",
  },
};

function residence(resident: Resident): string {
  if (resident.block) {
    return `Bloco ${resident.block}, apartamento ${resident.unit}`;
  }
  return `Apartamento ${resident.unit}`;
}

function answerText(resident: Resident): string {
  if (resident.link_status === "APROVADO") {
    return `Aprovado, ${resident.user.name} já pode usar o ConectAgro`;
  }
  return `Recusado, ${resident.user.name} não pode usar o ConectAgro`;
}

interface ResidentCardProps {
  resident: Resident;
  listStatus: LinkStatus;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function ResidentCard({
  resident,
  listStatus,
  disabled,
  onApprove,
  onReject,
}: Readonly<ResidentCardProps>) {
  // guarda em que situação a pergunta abriu, assim ela fecha sozinha depois da resposta
  const [confirmingAt, setConfirmingAt] = useState<LinkStatus | null>(null);
  const nameId = useId();
  const { name, email } = resident.user;
  const status = resident.link_status;
  const confirming = confirmingAt === status;
  // só quem mudou de situação nesta visita mostra a resposta, o resto da lista já é igual
  const answer = status === listStatus ? "" : answerText(resident);
  const confirmation = CONFIRMATIONS[status];
  // o leitor de tela diz de quem é cada botão, já que todos os cartões têm os mesmos
  const buttonProps = { "aria-describedby": nameId, disabled };

  return (
    <li className="rounded-4xl bg-stone-200 px-6 py-6 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-5">
          <span aria-hidden="true" className={AVATAR_CLASSES}>
            {name.charAt(0)}
          </span>
          <div className="min-w-0">
            <h2 id={nameId} className="text-2xl">
              {name}
            </h2>
            {email && <p className="break-words text-stone-600">{email}</p>}
          </div>
        </div>
        <div className="text-lg sm:text-right">
          <p className="font-bold">{residence(resident)}</p>
          <p className="text-stone-600">
            Pediu em <span className="tabular-nums">{formatDay(resident.link_requested_at)}</span>
          </p>
        </div>
      </div>
      {/* fica sempre no HTML para o leitor de tela anunciar a resposta */}
      <output className={answer ? "mt-6 block font-bold sm:text-right" : "block"}>{answer}</output>
      <div className={ACTIONS_CLASSES}>
        {confirming && (
          <>
            <p>
              <span className="font-bold">{confirmation.ask(name)}</span> {confirmation.hint}
            </p>
            <div className={CONFIRM_ROW_CLASSES}>
              {status === "RECUSADO" ? (
                <PrimaryButton type="button" {...buttonProps} onClick={onApprove}>
                  {confirmation.confirm}
                </PrimaryButton>
              ) : (
                <DangerButton {...buttonProps} onClick={onReject}>
                  {confirmation.confirm}
                </DangerButton>
              )}
              {/* fica à direita e com o foco, onde um clique dobrado não confirma nada */}
              <SecondaryButton autoFocus {...buttonProps} onClick={() => setConfirmingAt(null)}>
                Voltar
              </SecondaryButton>
            </div>
          </>
        )}
        {!confirming && status === "PENDENTE" && (
          <div className={BUTTON_ROW_CLASSES}>
            <SecondaryButton
              {...buttonProps}
              onClick={() => setConfirmingAt(status)}
              className={BUTTON_CLASSES}
            >
              Recusar
            </SecondaryButton>
            <PrimaryButton
              type="button"
              {...buttonProps}
              onClick={onApprove}
              className={BUTTON_CLASSES}
            >
              Aprovar
            </PrimaryButton>
          </div>
        )}
        {!confirming && status !== "PENDENTE" && (
          <SecondaryButton {...buttonProps} onClick={() => setConfirmingAt(status)}>
            {confirmation.confirm}
          </SecondaryButton>
        )}
      </div>
    </li>
  );
}
