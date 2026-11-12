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
// sem resposta o aviso fica vazio e não ocupa espaço
const ANSWER_CLASSES: Record<LinkStatus, string> = {
  PENDENTE: "block",
  APROVADO: "mt-6 block text-right font-bold text-lime-800",
  RECUSADO: "mt-6 block text-right font-bold",
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
  if (resident.link_status === "RECUSADO") {
    return "Pedido recusado";
  }
  return "";
}

interface ResidentRequestProps {
  resident: Resident;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function ResidentRequest({
  resident,
  disabled,
  onApprove,
  onReject,
}: Readonly<ResidentRequestProps>) {
  const [confirmingReject, setConfirmingReject] = useState(false);
  const nameId = useId();
  const { name, email } = resident.user;

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
      <output className={ANSWER_CLASSES[resident.link_status]}>{answerText(resident)}</output>
      {resident.link_status === "PENDENTE" && confirmingReject && (
        <div className={ACTIONS_CLASSES}>
          <p>
            <span className="font-bold">Recusar o pedido de {name}?</span> A pessoa pode corrigir
            os dados e pedir de novo.
          </p>
          <div className={CONFIRM_ROW_CLASSES}>
            {/* o foco vem para cá porque o botão Recusar saiu da tela */}
            <SecondaryButton
              autoFocus
              aria-describedby={nameId}
              disabled={disabled}
              onClick={() => setConfirmingReject(false)}
            >
              Voltar
            </SecondaryButton>
            <DangerButton aria-describedby={nameId} disabled={disabled} onClick={onReject}>
              Recusar pedido
            </DangerButton>
          </div>
        </div>
      )}
      {resident.link_status === "PENDENTE" && !confirmingReject && (
        <div className={ACTIONS_CLASSES}>
          <div className={BUTTON_ROW_CLASSES}>
            <SecondaryButton
              aria-describedby={nameId}
              disabled={disabled}
              onClick={() => setConfirmingReject(true)}
              className={BUTTON_CLASSES}
            >
              Recusar
            </SecondaryButton>
            <PrimaryButton
              type="button"
              aria-describedby={nameId}
              disabled={disabled}
              onClick={onApprove}
              className={BUTTON_CLASSES}
            >
              Aprovar
            </PrimaryButton>
          </div>
        </div>
      )}
    </li>
  );
}
