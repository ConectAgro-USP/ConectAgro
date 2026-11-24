import { useCallback, useEffect, useState } from "react";
import { ApiError, errorMessage, lostAccess } from "../api/client";
import {
  createInterest,
  deleteInterest,
  listMyInterests,
  updateInterest,
  type Interest,
} from "../api/interests";
import { useAuth } from "../auth/AuthContext";
import { useWriteGuard } from "./useWriteGuard";

interface UseMyInterestsState {
  data: Interest[];
  loading: boolean;
  error: string;
  retry: () => void;
  register: (productPublicId: string, quantity: number) => Promise<void>;
  update: (publicId: string, quantity: number) => Promise<void>;
  remove: (publicId: string) => Promise<void>;
}

// desligado, nada é pedido, para quem não é morador aprovado
export function useMyInterests(enabled = true): UseMyInterestsState {
  const { refreshUser } = useAuth();
  const guard = useWriteGuard();
  const [data, setData] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setError("");
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let outdated = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const interests = await listMyInterests();
        if (!outdated) setData(interests);
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
          await refreshUser();
        }
      } finally {
        if (!outdated) setLoading(false);
      }
    }

    load().catch((refreshError: unknown) => console.error(refreshError));
    return () => {
      outdated = true;
    };
  }, [enabled, refreshUser, reloadKey]);

  // outra aba ou a compra mudou o interesse, então a lista é relida
  async function rereadOnConflict<T>(request: Promise<T>): Promise<T> {
    try {
      return await guard(request);
    } catch (writeError) {
      if (writeError instanceof ApiError && writeError.status === 409) retry();
      throw writeError;
    }
  }

  async function register(productPublicId: string, quantity: number): Promise<void> {
    const created = await rereadOnConflict(
      createInterest({ product_public_id: productPublicId, quantity }),
    );
    setData((current) => [created, ...current]);
  }

  async function update(publicId: string, quantity: number): Promise<void> {
    const saved = await rereadOnConflict(updateInterest(publicId, quantity));
    setData((current) =>
      current.map((interest) => (interest.public_id === publicId ? saved : interest)),
    );
  }

  async function remove(publicId: string): Promise<void> {
    await guard(deleteInterest(publicId));
    setData((current) => current.filter((interest) => interest.public_id !== publicId));
  }

  return { data, loading: enabled && loading, error, retry, register, update, remove };
}
