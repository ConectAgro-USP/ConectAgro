import type { ReactNode, SubmitEvent } from "react";
import { AuthLayout } from "../../components/AuthLayout";
import { PrimaryButton, SecondaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";

interface ProfileFormProps {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onBack: () => void;
  error: string;
  pending: boolean;
  children: ReactNode;
}

export function ProfileForm({
  onSubmit,
  onBack,
  error,
  pending,
  children,
}: Readonly<ProfileFormProps>) {
  return (
    <AuthLayout title="Local e Contato">
      <form onSubmit={onSubmit} className="space-y-6">
        {children}
        <FormError message={error} />
        <div className="flex gap-3">
          <SecondaryButton disabled={pending} onClick={onBack}>
            Voltar
          </SecondaryButton>
          <PrimaryButton disabled={pending} className="flex-1">
            Concluir cadastro
          </PrimaryButton>
        </div>
      </form>
    </AuthLayout>
  );
}
