import type { LinkStatus } from "../api/profiles";
import { approveResident, rejectResident, type Resident } from "../api/residents";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ResidentRequest } from "../components/ResidentRequest";
import { useAction } from "../hooks/useAction";
import { usePendingResidents } from "../hooks/usePendingResidents";

function summarize(waiting: number): string {
  if (waiting === 0) {
    return "Nenhum pedido esperando resposta";
  }
  if (waiting === 1) {
    return "1 pedido esperando sua resposta";
  }
  return `${waiting} pedidos esperando sua resposta`;
}

export function Residents() {
  const requests = usePendingResidents();
  const answer = useAction();
  const residents = requests.residents ?? [];
  const waiting = residents.filter((resident) => resident.link_status === "PENDENTE").length;

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
        requests.reload();
        throw answerError;
      }
      requests.markAnswered(resident, linkStatus);
    });
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-extrabold">Moradores</h1>
        {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
        <output className="mt-2 block text-lg text-stone-600">
          {requests.loading ? "Carregando..." : ""}
        </output>
        {requests.residents && <p className="text-lg text-stone-600">{summarize(waiting)}</p>}
        {requests.residents?.length === 0 && (
          <p className="mt-2 text-lg text-stone-600">
            Quando um morador pedir para entrar no prédio, o pedido aparece aqui.
          </p>
        )}
        <div className="mt-4 space-y-4">
          {/* sem rede a resposta e a lista falham juntas, e um aviso só basta */}
          <FormError message={requests.error || answer.error} />
          {requests.error && (
            <SecondaryButton onClick={requests.reload}>Tentar de novo</SecondaryButton>
          )}
        </div>
        {residents.length > 0 && (
          <ul className="space-y-4 pt-4">
            {residents.map((resident) => (
              <ResidentRequest
                key={resident.public_id}
                resident={resident}
                disabled={answer.pending || requests.loading}
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
