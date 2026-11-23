import { useCallback, useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import {
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
  update: (publicId: string, quantity: number) => Promise<void>;
  remove: (publicId: string) => Promise<void>;
}

export function useMyInterests(): UseMyInterestsState {
  const { refreshUser } = useAuth();
  const guard = useWriteGuard();
  const [data, setData] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setError("");
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
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
  }, [refreshUser, reloadKey]);

  async function update(publicId: string, quantity: number): Promise<void> {
    const saved = await guard(updateInterest(publicId, quantity));
    setData((current) =>
      current.map((interest) => (interest.public_id === publicId ? saved : interest)),
    );
  }

  async function remove(publicId: string): Promise<void> {
    await guard(deleteInterest(publicId));
    setData((current) => current.filter((interest) => interest.public_id !== publicId));
  }

  return { data, loading, error, retry, update, remove };
}
