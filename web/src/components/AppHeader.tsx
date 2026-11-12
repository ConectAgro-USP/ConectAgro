import {
  HouseIcon,
  LogOutIcon,
  MessageCircleIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShoppingBasketIcon,
  UserIcon,
} from "lucide-react";
import { Link, NavLink } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useAction } from "../hooks/useAction";
import { FormError } from "./FormError";
import { Logo } from "./Logo";

const SEARCH_BOX_CLASSES =
  "hidden h-12 flex-1 items-center gap-3 rounded-full border border-stone-400 px-4 lg:flex";
const ICON_BUTTON_CLASSES =
  "flex size-12 items-center justify-center rounded-full focus-visible:outline-2 " +
  "focus-visible:outline-lime-800 disabled:cursor-not-allowed";
const NAV_LINK_CLASSES =
  "flex h-12 items-center gap-2 rounded-full px-3 focus-visible:outline-2 sm:px-5 " +
  "focus-visible:outline-lime-800";

function chooseNavLinkClasses({ isActive }: { isActive: boolean }): string {
  if (isActive) {
    return `${NAV_LINK_CLASSES} bg-lime-100 text-lime-800`;
  }
  return NAV_LINK_CLASSES;
}

export function AppHeader() {
  const { logout, profileType } = useAuth();
  const { error, pending, run } = useAction();

  return (
    <header className="border-b border-stone-200 bg-white px-6 text-stone-900">
      <div className="mx-auto max-w-7xl space-y-2 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link to="/" className="text-3xl">
            <Logo />
          </Link>
          {/* a busca, o carrinho e as notificações ainda não têm API */}
          <div className={SEARCH_BOX_CLASSES}>
            <SearchIcon />
            <input
              type="search"
              disabled
              aria-label="Buscar produto ou agricultor"
              placeholder="Buscar produto ou agricultor"
              className="w-full disabled:cursor-not-allowed"
            />
          </div>
          <nav className="ml-auto flex items-center gap-1">
            <Link to="/" aria-label="Início" className={ICON_BUTTON_CLASSES}>
              <HouseIcon />
            </Link>
            <button type="button" disabled aria-label="Carrinho" className={ICON_BUTTON_CLASSES}>
              <ShoppingBasketIcon />
            </button>
            <button
              type="button"
              disabled
              aria-label="Notificações"
              className={ICON_BUTTON_CLASSES}
            >
              <MessageCircleIcon />
            </button>
            {profileType === "apartment" && (
              <NavLink to="/compras" className={chooseNavLinkClasses}>
                <ReceiptTextIcon />
                <span className="sr-only lg:not-sr-only">Compras do prédio</span>
              </NavLink>
            )}
            <NavLink to="/perfil" className={chooseNavLinkClasses}>
              <UserIcon />
              {/* no celular só cabe o ícone; o leitor de tela ainda lê o nome */}
              <span className="sr-only sm:not-sr-only">Perfil</span>
            </NavLink>
            <span
              aria-hidden="true"
              className="mx-2 hidden h-8 border-l border-stone-300 sm:block"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(logout)}
              aria-label="Sair"
              className={ICON_BUTTON_CLASSES}
            >
              <LogOutIcon />
            </button>
          </nav>
        </div>
        <FormError message={error} />
      </div>
    </header>
  );
}
