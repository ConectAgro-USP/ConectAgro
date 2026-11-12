import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import type { LinkStatus } from "../api/profiles";
import { listResidents, type Resident } from "../api/residents";
import { useAuth } from "../auth/AuthContext";

interface Query {
  status: LinkStatus;
}

// a lista na tela e o pedido que ela responde
interface Loaded {
  query: Query;
  residents: Resident[];
}

export function useResidents() {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState<Query>({ status: "PENDENTE" });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  // ao trocar de situação a lista antiga some, ao recarregar a mesma ela fica na tela
  const sameStatus = loaded?.query.status === query.status;

  function changeStatus(status: LinkStatus) {
    setError("");
    setQuery({ status });
  }

  function reload() {
    setError("");
    // a cópia faz o efeito pedir de novo a lista que estiver na tela
    setQuery((current) => ({ ...current }));
  }

  // quem recebe a resposta fica na lista, para os outros não mudarem de lugar
  function markAnswered(answered: Resident, linkStatus: LinkStatus) {
    setLoaded((current) => {
      if (current === null) {
        return null;
      }
      const residents = current.residents.map((resident) => {
        if (resident.public_id === answered.public_id) {
          return { ...resident, link_status: linkStatus };
        }
        return resident;
      });
      return { ...current, residents };
    });
  }

  useEffect(() => {
    let outdated = false;

    async function load() {
      try {
        const residents = await listResidents(query.status);
        if (!outdated) setLoaded({ query, residents });
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
          // sem sessão ou com outra conta, recarregar o usuário tira a pessoa da tela
          await refreshUser();
        }
      }
    }

    load().catch((refreshError: unknown) => console.error(refreshError));
    return () => {
      outdated = true;
    };
  }, [query, refreshUser]);

  return {
    status: query.status,
    changeStatus,
    residents: sameStatus ? loaded.residents : null,
    loading: loaded?.query !== query && error === "",
    error,
    reload,
    markAnswered,
  };
}
