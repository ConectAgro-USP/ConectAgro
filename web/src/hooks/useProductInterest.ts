import { useEffect, useState } from "react";
import { ApiError, errorMessage, lostAccess } from "../api/client";
import {
  createInterest,
  deleteInterest,
  findMyInterest,
  updateInterest,
  type Interest,
} from "../api/interests";
import { useAuth } from "../auth/AuthContext";
import { useWriteGuard } from "./useWriteGuard";

// o interesse do morador num produto, pedido à parte da lista inteira
interface Found {
  productPublicId: string;
  request: object;
  interest: Interest | null;
}

export function useProductInterest(productPublicId: string) {
  const { refreshUser } = useAuth();
  const guard = useWriteGuard();
  const [request, setRequest] = useState({});
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");

  function retry() {
    setError("");
    setRequest({});
  }

  useEffect(() => {
    let outdated = false;

    async function load() {
      try {
        const interest = await findMyInterest(productPublicId);
        if (!outdated) setFound({ productPublicId, request, interest });
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
  }, [productPublicId, request, refreshUser]);

  // outra aba ou a compra mudou o interesse, então ele é relido
  async function rereadOnConflict(write: Promise<Interest>): Promise<void> {
    try {
      const interest = await guard(write);
      setFound({ productPublicId, request, interest });
    } catch (writeError) {
      if (writeError instanceof ApiError && writeError.status === 409) retry();
      throw writeError;
    }
  }

  function register(quantity: number): Promise<void> {
    return rereadOnConflict(createInterest({ product_public_id: productPublicId, quantity }));
  }

  function update(publicId: string, quantity: number): Promise<void> {
    return rereadOnConflict(updateInterest(publicId, quantity));
  }

  async function remove(publicId: string): Promise<void> {
    await guard(deleteInterest(publicId));
    setFound({ productPublicId, request, interest: null });
  }

  const current = found?.productPublicId === productPublicId ? found : null;
  return {
    interest: current?.interest ?? null,
    loading: current?.request !== request && error === "",
    error,
    retry,
    register,
    update,
    remove,
  };
}
