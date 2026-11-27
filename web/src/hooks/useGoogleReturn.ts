import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { RETURN_PARAM, takeReturn } from "../auth/returnPath";

// lê uma vez a página guardada antes do Google, e segue com a sessão aberta
export function useGoogleReturn(): void {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const signedIn = user !== null;
  const googleFailed =
    pathname === "/login" && new URLSearchParams(search).get("error") === "google";

  useEffect(() => {
    if (loading) return;
    const next = takeReturn();
    if (!next) return;
    if (signedIn) {
      void navigate(next, { replace: true });
    } else if (googleFailed) {
      // a nova tentativa leva de volta à mesma página
      const params = new URLSearchParams({ error: "google", [RETURN_PARAM]: next });
      void navigate(`/login?${params.toString()}`, { replace: true });
    }
  }, [loading, signedIn, googleFailed, navigate]);
}
