import { LogInIcon, LogOutIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { loginPathFrom } from "../auth/returnPath";
import { useAction } from "../hooks/useAction";
import { useLogout } from "../hooks/useLogout";
import { navigationOf, PROFILE_DESTINATION, type NavDestination } from "../restrictedPages";
import { buttonClasses } from "./buttonClasses";
import { CartLink } from "./CartLink";
import { FormError } from "./FormError";
import { HEADER_ACTION_CLASSES, HEADER_FOCUS_CLASSES } from "./headerClasses";
import { HeaderSearch } from "./HeaderSearch";
import { Logo } from "./Logo";

const ACCOUNT_CLASSES = `${HEADER_ACTION_CLASSES} disabled:opacity-60`;
const LOGIN_CLASSES =
  `flex shrink-0 items-center gap-2 whitespace-nowrap ${buttonClasses("primary", "compact")}`;
const PAGE_LINK_CLASSES =
  "flex h-11 items-center gap-2 rounded-full px-2 text-sm font-bold whitespace-nowrap lg:px-3 " +
  "text-stone-700 hover:bg-stone-100 aria-[current=page]:bg-lime-100 " +
  `aria-[current=page]:text-lime-900 lg:text-base ${HEADER_FOCUS_CLASSES}`;

interface DestinationLinkProps {
  page: NavDestination;
  className: string;
}

function DestinationLink({ page, className }: Readonly<DestinationLinkProps>) {
  return (
    <NavLink to={page.path} end={page.path === "/"} className={className}>
      <page.icon aria-hidden="true" className="size-5 shrink-0" />
      {page.label}
    </NavLink>
  );
}

function HomeLink() {
  return (
    <Link to="/" className={`shrink-0 rounded-lg text-3xl ${HEADER_FOCUS_CLASSES}`}>
      <Logo />
    </Link>
  );
}

interface HeaderFrameProps {
  actions: ReactNode;
  children?: ReactNode;
}

function HeaderFrame({ actions, children }: Readonly<HeaderFrameProps>) {
  return (
    <header className="border-b border-stone-200 bg-white px-4 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex min-h-16 items-center gap-4 py-2">
          <HomeLink />
          {/* abaixo de 1024 px a busca fica no catálogo */}
          <div className="hidden min-w-0 flex-1 lg:block">
            <HeaderSearch />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-4">{actions}</div>
        </div>
        {children}
      </div>
    </header>
  );
}

// quem não entrou vê o botão de entrar no lugar do perfil
export function VisitorHeader() {
  const location = useLocation();

  return (
    <HeaderFrame
      actions={
        <Link to={loginPathFrom(location)} className={LOGIN_CLASSES}>
          <LogInIcon aria-hidden="true" className="size-5 shrink-0" />
          Entrar
        </Link>
      }
    />
  );
}

export function AppHeader() {
  const { profileType } = useAuth();
  const logout = useLogout();
  const { error, pending, run } = useAction();
  const { tabs, more } = navigationOf(profileType);

  return (
    <HeaderFrame
      actions={
        <>
          <CartLink />
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <DestinationLink page={PROFILE_DESTINATION} className={ACCOUNT_CLASSES} />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(logout)}
              className={ACCOUNT_CLASSES}
            >
              <LogOutIcon aria-hidden="true" className="size-5 shrink-0" />
              Sair
            </button>
          </div>
        </>
      }
    >
      <nav aria-label="Menu principal" className="hidden pb-2 md:block">
        <ul className="-mx-2 flex flex-wrap gap-1 lg:-mx-3">
          {[...tabs, ...more].map((page) => (
            <li key={page.path}>
              <DestinationLink page={page} className={PAGE_LINK_CLASSES} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="empty:hidden md:pb-3">
        <FormError message={error} />
      </div>
    </HeaderFrame>
  );
}
