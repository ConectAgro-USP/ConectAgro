import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
