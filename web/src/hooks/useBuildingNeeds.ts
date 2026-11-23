import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import { listBuildingNeeds, type BuildingNeed } from "../api/interests";
import { useAuth } from "../auth/AuthContext";

interface Query {
  descending: boolean;
}

interface Loaded {
  query: Query;
  needs: BuildingNeed[];
}

export function useBuildingNeeds() {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState<Query>({ descending: true });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  // com outra ordem a lista some, recarregando a mesma ela fica na tela
  const sameOrder = loaded?.query.descending === query.descending;

  function sort(descending: boolean) {
    setError("");
    setQuery({ descending });
  }

  useEffect(() => {
    let outdated = false;

    async function load() {
      try {
        const needs = await listBuildingNeeds(query.descending);
        if (!outdated) setLoaded({ query, needs });
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
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
    descending: query.descending,
    sort,
    needs: sameOrder ? loaded.needs : null,
    loading: loaded?.query !== query && error === "",
    error,
    // um objeto novo pede a lista de novo, mesmo na mesma ordem
    reload: () => sort(query.descending),
  };
}
