import type { LinkStatus } from "../api/profiles";
import { listResidents, type Resident } from "../api/residents";
import { replaceItem } from "./pageEdits";
import { usePages } from "./usePages";

function keyOf(resident: Resident): string {
  return resident.public_id;
}

export function useResidents() {
  const pages = usePages(listResidents, "PENDENTE" as LinkStatus, { keyOf });
  const status = pages.search;
  // ao trocar de situação a lista antiga some, ao recarregar a mesma ela fica na tela
  const residents = pages.lastPage === undefined ? null : pages.items;

  // quem recebe a resposta fica na lista, para os outros não mudarem de lugar
  function markAnswered(answered: Resident, linkStatus: LinkStatus) {
    const same = (resident: Resident) => resident.public_id === answered.public_id;
    pages.editPages(replaceItem(same, { ...answered, link_status: linkStatus }));
  }

  // quem acabou de receber outra resposta continua na tela, mas sai da conta
  const answeredHere = pages.items.filter((resident) => resident.link_status !== status).length;

  return {
    status,
    changeStatus: pages.changeSearch,
    residents,
    markAnswered,
    count: (pages.lastPage?.total ?? 0) - answeredHere,
    loading: pages.loading,
    error: pages.error,
    hasMore: pages.hasMore,
    loadMore: pages.loadMore,
    // relê a última página pedida, e a lista na tela fica até a resposta
    reload: pages.retry,
  };
}
