import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { ProfileRead } from "../api/profiles";
import { AuthContext } from "./AuthContext";

async function fetchUser(): Promise<ProfileRead | null> {
  try {
    return await apiFetch<ProfileRead>("/profiles/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

function loginWithGoogle() {
  window.location.href = "/api/auth/login/google";
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<ProfileRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    fetchUser()
      .then(setUser)
      .catch((error: unknown) => {
        console.error(error);
        setSessionError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await fetchUser());
    setSessionError(false);
  }, []);

  const saveProfile = useCallback(async (request: Promise<ProfileRead>) => {
    try {
      const saved = await request;
      // ignora a resposta se a pessoa saiu ou trocou de conta enquanto salvava
      setUser((current) => {
        if (current?.email !== saved.email) {
          return current;
        }
        return saved;
      });
    } catch (error) {
      // 409: perfil criado em outra aba; 401: a sessão acabou. Recarregar resolve
      if (error instanceof ApiError && (error.status === 409 || error.status === 401)) {
        await refreshUser();
      }
      throw error;
    }
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profileType: user?.profile_type ?? null,
      linkStatus: user?.buyer?.link_status ?? null,
      loading,
      sessionError,
      loginWithGoogle,
      refreshUser,
      saveProfile,
      logout,
    }),
    [user, loading, sessionError, refreshUser, saveProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
