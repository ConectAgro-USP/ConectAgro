import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, sessionError } = useAuth();

  if (loading) return null;
  if (sessionError) return <p role="alert">Erro ao verificar sua sessão. Recarregue a página.</p>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
