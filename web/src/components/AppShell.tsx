import { Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { AppHeader, VisitorHeader } from "./AppHeader";
import { BOTTOM_BAR_SPACE, BottomNav } from "./BottomNav";

export function AppShell() {
  const { user } = useAuth();

  // o visitante não tem barra inferior, então a página não reserva espaço
  if (!user) {
    return (
      <>
        <VisitorHeader />
        <Outlet />
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <BottomNav />
      <div className={BOTTOM_BAR_SPACE}>
        <Outlet />
      </div>
    </>
  );
}
