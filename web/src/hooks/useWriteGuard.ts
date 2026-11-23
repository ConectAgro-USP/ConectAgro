import { lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// sem sessão ou com outro perfil, recarregar o usuário tira a pessoa da tela
export function useWriteGuard() {
  const { refreshUser } = useAuth();

  return async function guard<T>(request: Promise<T>): Promise<T> {
    try {
      return await request;
    } catch (writeError) {
      if (lostAccess(writeError)) {
        await refreshUser().catch((refreshError: unknown) => console.error(refreshError));
      }
      throw writeError;
    }
  };
}
