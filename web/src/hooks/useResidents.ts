import { useState } from "react";
import type { LinkStatus } from "../api/profiles";
import { listResidents, type Resident } from "../api/residents";
import { replaceItem } from "./pageEdits";
import { usePages } from "./usePages";

function keyOf(resident: Resident): string {
  return resident.public_id;
}

// a contagem da última página que chegou e a que segue as respostas
interface Counted {
  from: object | null;
  value: number;
}

export function useResidents() {
  const pages = usePages(listResidents, "PENDENTE" as LinkStatus, { keyOf });
  const status = pages.search;
  // ao trocar de situação a lista antiga some, ao recarregar a mesma ela fica na tela
  const residents = pages.lastPage === undefined ? null : pages.items;
  const [counted, setCounted] = useState<Counted | null>(null);
  const latest = pages.lastPage?.total;
  if (latest !== undefined && pages.received !== counted?.from) {
    setCounted({ from: pages.received, value: latest });
  }

  // quem recebe a resposta fica na lista, para os outros não mudarem de lugar
  function markAnswered(answered: Resident, linkStatus: LinkStatus) {
    const same = (resident: Resident) => resident.public_id === answered.public_id;
    const left = answered.link_status === status && linkStatus !== status;
    const back = answered.link_status !== status && linkStatus === status;
    pages.editPages(replaceItem(same, { ...answered, link_status: linkStatus }), {
      dropped: left ? 1 : 0,
    });
    // quem acabou de receber outra resposta continua na tela, mas sai da conta
    const change = Number(back) - Number(left);
    setCounted((current) => current && { ...current, value: current.value + change });
  }

  return {
    status,
    changeStatus: pages.changeSearch,
    residents,
    markAnswered,
    count: counted?.value ?? 0,
    loading: pages.loading,
    error: pages.error,
    hasMore: pages.hasMore,
    loadMore: pages.loadMore,
    retry: pages.retry,
    // as respostas mudam as linhas de página, e a releitura começa na primeira
    restart: pages.restart,
  };
}
