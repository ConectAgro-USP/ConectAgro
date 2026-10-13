import { useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "../api/client";
import { AuthContext, type User } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error(error);
          setSessionError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = () => {
    window.location.href = "/api/auth/login/google";
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
