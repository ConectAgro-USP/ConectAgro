import { useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface Loaded<K, T> {
  key: K | undefined;
  request: object;
  data: T;
}

export interface LoadedState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  retry: () => void;
  // troca o dado na tela depois de uma escrita, sem pedir de novo
  setData: (data: T) => void;
}

// load precisa ser estável, como as funções da API, e a key muda o pedido
export function useLoaded<T>(load: () => Promise<T>): LoadedState<T>;
export function useLoaded<T, K>(load: (key: K) => Promise<T>, key: K): LoadedState<T>;
export function useLoaded<T, K>(load: (key?: K) => Promise<T>, key?: K): LoadedState<T> {
  const { refreshUser } = useAuth();
  const [request, setRequest] = useState({});
  const [loaded, setLoaded] = useState<Loaded<K, T> | null>(null);
  const [error, setError] = useState("");

  function retry() {
    setError("");
    setRequest({});
  }

  useEffect(() => {
    let outdated = false;

    async function run() {
      try {
        const data = await load(key);
        if (!outdated) setLoaded({ key, request, data });
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
  }, [load, key, request, refreshUser]);

  // o dado de outra key não responde a esta
  const current = loaded?.key === key ? loaded : null;
  return {
    data: current?.data ?? null,
    loading: current?.request !== request && error === "",
    error,
    retry,
    setData: (data) => setLoaded({ key, request, data }),
  };
}
