import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader";
import { BOTTOM_BAR_SPACE, BottomNav } from "./BottomNav";

export function AppShell() {
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
