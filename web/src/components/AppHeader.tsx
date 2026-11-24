import { LogOutIcon } from "lucide-react";
import { Link, NavLink } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useAction } from "../hooks/useAction";
import { navigationOf, PROFILE_DESTINATION, type NavDestination } from "../restrictedPages";
import { FormError } from "./FormError";
import { HeaderSearch } from "./HeaderSearch";
import { Logo } from "./Logo";

const FOCUS_CLASSES = "focus-visible:outline-2 focus-visible:outline-lime-800";
const ACCOUNT_CLASSES =
  "flex h-12 items-center gap-2 rounded-full px-3 font-bold whitespace-nowrap text-stone-800 " +
  "hover:bg-stone-100 aria-[current=page]:bg-lime-100 aria-[current=page]:text-lime-900 " +
  `disabled:opacity-60 ${FOCUS_CLASSES}`;
const PAGE_LINK_CLASSES =
  "flex h-11 items-center gap-2 rounded-full px-2 text-sm font-bold whitespace-nowrap lg:px-3 " +
  "text-stone-700 hover:bg-stone-100 aria-[current=page]:bg-lime-100 " +
  `aria-[current=page]:text-lime-900 lg:text-base ${FOCUS_CLASSES}`;

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

export function AppHeader() {
  const { logout, profileType } = useAuth();
  const { error, pending, run } = useAction();
  const { tabs, more } = navigationOf(profileType);

  return (
    <header className="border-b border-stone-200 bg-white px-4 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex min-h-16 items-center gap-4 py-2">
          <Link to="/" className={`shrink-0 rounded-lg text-3xl ${FOCUS_CLASSES}`}>
            <Logo />
          </Link>
          <div className="min-w-0 flex-1">
            <HeaderSearch />
          </div>
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
        </div>
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
      </div>
    </header>
  );
}
