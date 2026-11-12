import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import type { LinkStatus } from "../api/profiles";
import { listPendingResidents, type Resident } from "../api/residents";
import { useAuth } from "../auth/AuthContext";

export function usePendingResidents() {
  const { refreshUser } = useAuth();
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // a tentativa que já teve resposta, para a tela saber quando outra está a caminho
  const [loadedAttempt, setLoadedAttempt] = useState(-1);

  function reload() {
    setError("");
    setAttempt((last) => last + 1);
  }

  // o pedido respondido fica na lista com a resposta, para os outros não mudarem de lugar
  function markAnswered(answered: Resident, linkStatus: LinkStatus) {
    setResidents((current) =>
      (current ?? []).map((resident) => {
        if (resident.public_id === answered.public_id) {
          return { ...resident, link_status: linkStatus };
        }
        return resident;
      }),
    );
  }

  useEffect(() => {
    let outdated = false;

    async function load() {
      try {
        const waiting = await listPendingResidents();
        if (outdated) return;
        setResidents(waiting);
        setLoadedAttempt(attempt);
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
  }, [attempt, refreshUser]);

  const loading = loadedAttempt !== attempt && error === "";
  return { residents, loading, error, reload, markAnswered };
}
