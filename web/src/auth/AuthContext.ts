import { createContext, useContext } from "react";

export interface User {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionError: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
