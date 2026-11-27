import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const TITLE_BAR_CLASSES =
  "mx-auto grid min-h-14 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 py-1 " +
  "sm:grid-cols-[1fr_auto_1fr]";
const BACK_CLASSES =
  "flex size-12 items-center justify-center justify-self-start rounded-full " +
  "focus-visible:outline-2 focus-visible:outline-white";

export type Back = { label: string } & ({ to: string } | { onClick: () => void });

function BackControl({ back }: Readonly<{ back: Back }>) {
  const icon = <ArrowLeftIcon aria-hidden="true" className="size-8" />;
  if ("to" in back) {
    return (
      <Link to={back.to} aria-label={back.label} className={BACK_CLASSES}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={back.onClick} aria-label={back.label} className={BACK_CLASSES}>
      {icon}
    </button>
  );
}

interface TitleBarProps {
  title: string;
  // só a página que tem um pai de verdade mostra a seta
  back?: Back;
  // o que fica à direita do título, como o botão de filtros do histórico
  children?: ReactNode;
}

export function TitleBar({ title, back, children }: Readonly<TitleBarProps>) {
  return (
    <div className="bg-lime-700 px-4 text-white sm:px-6">
      <div className={TITLE_BAR_CLASSES}>
        {back ? <BackControl back={back} /> : <span aria-hidden="true" />}
        <h1 className="text-center text-xl font-bold text-balance sm:text-4xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}
