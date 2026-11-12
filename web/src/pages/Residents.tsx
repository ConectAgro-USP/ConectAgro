import type { LinkStatus } from "../api/profiles";
import { approveResident, rejectResident, type Resident } from "../api/residents";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ResidentCard } from "../components/ResidentCard";
import { useAction } from "../hooks/useAction";
import { useResidents } from "../hooks/useResidents";

// no celular os três botões dividem a largura da tela
const TAB_CLASSES =
  "h-11 flex-1 rounded-full border border-stone-400 bg-white px-2 font-bold sm:flex-none " +
  "sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-pressed:border-lime-800 aria-pressed:bg-lime-100 " +
  "aria-pressed:text-lime-800 disabled:cursor-not-allowed disabled:opacity-60";

// cada situação tem o nome do botão e as frases para nenhum, um e vários moradores
const SITUATIONS: Record<LinkStatus, { tab: string; none: string; one: string; many: string }> = {
  PENDENTE: {
    tab: "Pedidos",
    none: "Nenhum pedido esperando resposta",
    one: "1 pedido esperando sua resposta",
    many: "pedidos esperando sua resposta",
  },
  APROVADO: {
    tab: "Aprovados",
    none: "Nenhum morador aprovado",
    one: "1 morador aprovado",
    many: "moradores aprovados",
  },
  RECUSADO: {
    tab: "Recusados",
    none: "Nenhum pedido recusado",
    one: "1 pedido recusado",
    many: "pedidos recusados",
  },
};
const STATUSES = Object.keys(SITUATIONS) as LinkStatus[];

function summarize(status: LinkStatus, count: number): string {
  const { none, one, many } = SITUATIONS[status];
  if (count === 0) {
    return none;
  }
  if (count === 1) {
    return one;
  }
  return `${count} ${many}`;
}

export function Residents() {
  const list = useResidents();
  const answer = useAction();
  const residents = list.residents ?? [];
  // quem acabou de receber outra resposta continua na tela, mas sai da conta
  const count = residents.filter((resident) => resident.link_status === list.status).length;

  function changeStatus(status: LinkStatus) {
    // o aviso de uma resposta que falhou não vale para a outra lista
    answer.setError("");
    list.changeStatus(status);
  }

  function send(
    resident: Resident,
    review: (publicId: string) => Promise<Resident>,
    linkStatus: LinkStatus,
  ) {
    answer.run(async () => {
      try {
        await review(resident.public_id);
      } catch (answerError) {
        // o pedido pode ter mudado ou a sessão acabado, a lista nova mostra o que vale
        list.reload();
        throw answerError;
      }
      list.markAnswered(resident, linkStatus);
    });
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-extrabold">Moradores</h1>
        <div className="mt-6 flex gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={status === list.status}
              disabled={answer.pending}
              onClick={() => changeStatus(status)}
              className={TAB_CLASSES}
            >
              {SITUATIONS[status].tab}
            </button>
          ))}
        </div>
        {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
        <output className="mt-4 block text-lg text-stone-600">
          {list.loading ? "Carregando..." : ""}
        </output>
        {list.residents && (
          <p className="text-lg text-stone-600">{summarize(list.status, count)}</p>
        )}
        {list.status === "PENDENTE" && list.residents?.length === 0 && (
          <p className="mt-2 text-lg text-stone-600">
            Quando um morador pedir para entrar no prédio, o pedido aparece aqui.
          </p>
        )}
        <div className="mt-4 space-y-4">
          {/* sem rede a resposta e a lista falham juntas, e um aviso só basta */}
          <FormError message={list.error || answer.error} />
          {list.error && <SecondaryButton onClick={list.reload}>Tentar de novo</SecondaryButton>}
        </div>
        {residents.length > 0 && (
          <ul className="space-y-4 pt-4">
            {residents.map((resident) => (
              <ResidentCard
                key={resident.public_id}
                resident={resident}
                listStatus={list.status}
                disabled={answer.pending || list.loading}
                onApprove={() => send(resident, approveResident, "APROVADO")}
                onReject={() => send(resident, rejectResident, "RECUSADO")}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
