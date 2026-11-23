import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export function FormSection({ title, children }: Readonly<FormSectionProps>) {
  return (
    <section className="space-y-4 border-t border-stone-300 py-8">
      <h2 className="text-3xl font-extrabold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
