import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthLayout({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-stone-900 sm:py-16">
      <div className="mx-auto max-w-lg">
        <p className="text-center text-3xl">
          <Logo />
        </p>
        <h1 className="mt-10 mb-8 text-4xl font-extrabold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
