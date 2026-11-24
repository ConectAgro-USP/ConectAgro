import { LogOutIcon, MenuIcon, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useAction } from "../hooks/useAction";
import { useFocusWithoutScroll } from "../hooks/useFocusWithoutScroll";
import { navigationOf, PROFILE_DESTINATION } from "../restrictedPages";
import { FormError } from "./FormError";

// a altura da barra, que a página reserva embaixo para nada ficar escondido
export const BOTTOM_BAR_SPACE = "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0";

const TAB_CLASSES =
  "group flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs " +
  "font-semibold whitespace-nowrap text-stone-700 aria-[current=page]:text-lime-900 " +
  "aria-expanded:text-lime-900 data-active:text-lime-900 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-lime-800";
const TAB_ICON_CLASSES =
  "flex h-7 w-12 items-center justify-center rounded-full " +
  "group-aria-[current=page]:bg-lime-100 group-aria-expanded:bg-lime-100 " +
  "group-data-active:bg-lime-100";
const MORE_ITEM_CLASSES =
  "flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-lg font-bold text-stone-800 " +
  "hover:bg-stone-100 aria-[current=page]:bg-lime-100 aria-[current=page]:text-lime-900 " +
  "focus-visible:outline-2 focus-visible:outline-lime-800 disabled:opacity-60";

function TabContent({ icon: Icon, label }: Readonly<{ icon: LucideIcon; label: string }>) {
  return (
    <>
      <span className={TAB_ICON_CLASSES}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      {label}
    </>
  );
}

export function BottomNav() {
  const { logout, profileType } = useAuth();
  const logoutAction = useAction();
  const location = useLocation();
  // o painel fecha sozinho quando a página muda
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === location.key;
  const panelId = useId();
  const firstItemId = useFocusWithoutScroll(open);
  const moreButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const { tabs, more } = navigationOf(profileType);
  const moreItems = [...more, PROFILE_DESTINATION];
  const inMore = moreItems.some((page) => page.path === location.pathname);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpenAt(null);
      moreButton.current?.focus();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    // os botões da barra cuidam do próprio clique
    function closeOnClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !bar.current?.contains(target)) close();
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("click", closeOnClickOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("click", closeOnClickOutside);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {open && <div aria-hidden="true" className="fixed inset-0 z-30 bg-stone-900/40" />}
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className={
          "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 max-h-[70dvh] " +
          "overflow-y-auto rounded-t-3xl bg-white p-3 shadow-lg"
        }
      >
        <ul className="space-y-1">
          {moreItems.map((page, index) => (
            <li key={page.path}>
              <NavLink
                id={index === 0 ? firstItemId : undefined}
                to={page.path}
                className={MORE_ITEM_CLASSES}
              >
                <page.icon aria-hidden="true" className="size-6 shrink-0" />
                {page.label}
              </NavLink>
            </li>
          ))}
          <li className="border-t border-stone-200 pt-1">
            <button
              type="button"
              disabled={logoutAction.pending}
              onClick={() => logoutAction.run(logout)}
              className={MORE_ITEM_CLASSES}
            >
              <LogOutIcon aria-hidden="true" className="size-6 shrink-0" />
              Sair
            </button>
          </li>
        </ul>
        <div className="px-4 empty:hidden">
          <FormError message={logoutAction.error} />
        </div>
      </div>
      <nav
        ref={bar}
        aria-label="Menu principal"
        className={
          "fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white " +
          "pb-[env(safe-area-inset-bottom)]"
        }
      >
        <ul className="flex overflow-x-auto">
          {tabs.map((page) => (
            <li key={page.path} className="min-w-fit flex-1 basis-0">
              <NavLink to={page.path} end={page.path === "/"} className={TAB_CLASSES}>
                <TabContent icon={page.icon} label={page.label} />
              </NavLink>
            </li>
          ))}
          <li className="min-w-fit flex-1 basis-0">
            <button
              ref={moreButton}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              data-active={inMore || undefined}
              onClick={() => setOpenAt(open ? null : location.key)}
              className={TAB_CLASSES}
            >
              <TabContent icon={MenuIcon} label="Mais" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
