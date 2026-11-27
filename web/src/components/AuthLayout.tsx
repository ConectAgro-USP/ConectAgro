import type { ReactNode } from "react";
import { Logo, LogoMark } from "./Logo";

const TITLE_CLASSES = "mb-8 text-4xl font-extrabold text-balance";
const STEP_COUNT = 3;
const STEPS = Array.from({ length: STEP_COUNT }, (_, index) => index + 1);

function StepIndicator({ step }: Readonly<{ step: number }>) {
  return (
    <div className="mt-10">
      <p className="text-lg font-bold text-lime-800">
        Passo {step} de {STEP_COUNT}
      </p>
      <div aria-hidden="true" className="mt-2 grid grid-cols-3 gap-2">
        {STEPS.map((current) => (
          <span
            key={current}
            className={`h-2 rounded-full ${current <= step ? "bg-lime-800" : "bg-stone-300"}`}
          />
        ))}
      </div>
    </div>
  );
}

interface AuthLayoutProps {
  title: string;
  // só o cadastro tem etapas, a entrada e o vínculo não
  step?: number;
  // a tela que troca de conteúdo leva o foco ao título por este id
  titleId?: string;
  children: ReactNode;
}

export function AuthLayout({ title, step, titleId, children }: Readonly<AuthLayoutProps>) {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-stone-900 sm:py-16">
      <div className="mx-auto max-w-lg">
        <div className="flex flex-col items-center gap-2">
          <LogoMark />
          <p className="text-3xl">
            <Logo />
          </p>
        </div>
        {step !== undefined && <StepIndicator step={step} />}
        <h1
          id={titleId}
          tabIndex={titleId ? -1 : undefined}
          className={`${step === undefined ? "mt-10" : "mt-4"} ${TITLE_CLASSES}`}
        >
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}
