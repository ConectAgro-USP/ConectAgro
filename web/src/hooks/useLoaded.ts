import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface Loaded<T> {
  request: object;
  data: T;
}

export interface LoadedState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  retry: () => void;
}

// load precisa ser estável, como uma função do módulo da API
export function useLoaded<T>(load: () => Promise<T>): LoadedState<T> {
  const { refreshUser } = useAuth();
  const [request, setRequest] = useState({});
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [error, setError] = useState("");

  function retry() {
    setError("");
    setRequest({});
  }

  useEffect(() => {
    let outdated = false;

    async function run() {
      try {
        const data = await load();
        if (!outdated) setLoaded({ request, data });
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
          await refreshUser();
        }
      }
    }

    run().catch((refreshError: unknown) => console.error(refreshError));
    return () => {
      outdated = true;
    };
  }, [load, request, refreshUser]);

  return {
    data: loaded?.data ?? null,
    loading: loaded?.request !== request && error === "",
    error,
    retry,
  };
}
