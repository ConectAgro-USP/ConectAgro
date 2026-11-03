import { createContext, useContext } from "react";
import type { LinkStatus, ProfileRead, ProfileType } from "../api/profiles";

export interface AuthContextValue {
  user: ProfileRead | null;
  profileType: ProfileType | null;
  linkStatus: LinkStatus | null;
  loading: boolean;
  sessionError: boolean;
  loginWithGoogle: () => void;
  refreshUser: () => Promise<void>;
  saveProfile: (request: Promise<ProfileRead>) => Promise<void>;
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
