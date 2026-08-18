import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "../api/client";

export interface User {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error(error);
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
