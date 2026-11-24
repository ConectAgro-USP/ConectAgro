import type { ReactNode } from "react";
import { Navigate } from "react-router";
import type { ProfileType } from "../api/profiles";
import { useAuth } from "../auth/AuthContext";
import { PendingLink, RejectedLink } from "../pages/BuildingLink";
import { NoAccess } from "../pages/NotFound";
import { ProfileSetup } from "../pages/ProfileSetup";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedProfiles?: ProfileType[];
}

export function ProtectedRoute({ children, allowedProfiles }: Readonly<ProtectedRouteProps>) {
  const { user, profileType, linkStatus, loading, sessionError } = useAuth();

  if (loading) return null;
  if (sessionError) return <p role="alert">Erro ao verificar sua sessão. Recarregue a página.</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profileType) return <ProfileSetup />;
  if (linkStatus === "PENDENTE") return <PendingLink />;
  if (linkStatus === "RECUSADO") return <RejectedLink />;
  if (allowedProfiles && !allowedProfiles.includes(profileType)) return <NoAccess />;

  return children;
}
