import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import type { ProfileType } from "../api/profiles";
import { useAuth } from "../auth/AuthContext";
import { loginPathFrom } from "../auth/returnPath";
import { PendingLink, RejectedLink } from "../pages/BuildingLink";
import { NoAccess } from "../pages/NotFound";
import { ProfileSetup } from "../pages/ProfileSetup";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedProfiles?: ProfileType[];
  // a página inicial e a do produto abrem também para quem não entrou
  openToVisitors?: boolean;
}

export function ProtectedRoute({
  children,
  allowedProfiles,
  openToVisitors = false,
}: Readonly<ProtectedRouteProps>) {
  const { user, profileType, linkStatus, loading, sessionError } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (sessionError) return <p role="alert">Erro ao verificar sua sessão. Recarregue a página.</p>;
  if (!user && openToVisitors) return children;
  if (!user) return <Navigate to={loginPathFrom(location)} replace />;
  if (!profileType) return <ProfileSetup />;
  if (linkStatus === "PENDENTE") return <PendingLink />;
  if (linkStatus === "RECUSADO") return <RejectedLink />;
  if (allowedProfiles && !allowedProfiles.includes(profileType)) return <NoAccess />;

  return children;
}
