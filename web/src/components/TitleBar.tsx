import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const TITLE_BAR_CLASSES =
  "mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 py-1 " +
  "sm:grid-cols-[1fr_auto_1fr]";
const BACK_LINK_CLASSES =
  "flex size-12 items-center justify-center justify-self-start rounded-full " +
  "focus-visible:outline-2 focus-visible:outline-white";

interface Back {
  to: string;
  label: string;
}

const HOME: Back = { to: "/", label: "Voltar ao início" };

interface TitleBarProps {
  title: string;
  // um formulário pode voltar para a lista dele, em vez do início
  back?: Back;
  // o que fica à direita do título, como o botão de filtros do histórico
  children?: ReactNode;
}

export function TitleBar({ title, back = HOME, children }: Readonly<TitleBarProps>) {
  return (
    <div className="bg-lime-700 px-4 text-white sm:px-6">
      <div className={TITLE_BAR_CLASSES}>
        <Link to={back.to} aria-label={back.label} className={BACK_LINK_CLASSES}>
          <ArrowLeftIcon aria-hidden="true" className="size-8" />
        </Link>
        <h1 className="text-center text-xl font-bold sm:text-4xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}
