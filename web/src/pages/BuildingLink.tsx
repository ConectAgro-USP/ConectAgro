import { useState, type SubmitEvent } from "react";
import { updateBuyerLink } from "../api/profiles";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { BuildingCard } from "../components/BuildingCard";
import { BuildingLinkFields } from "../components/BuildingLinkFields";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { useAction } from "../hooks/useAction";
import { useBuildingLink } from "../hooks/useBuildingLink";
import { useFocusWithoutScroll } from "../hooks/useFocusWithoutScroll";
import { useLogout } from "../hooks/useLogout";

type Run = (action: () => Promise<void>) => void;

interface LinkRequestFormProps {
  title: string;
  titleId?: string;
  intro: string;
  initialCnpj: string;
  // o botão ao lado do Pedir vínculo, que pode usar o mesmo run do pedido
  secondary: { label: string; onClick: (run: Run) => void };
  onSaved?: () => void;
}

function LinkRequestForm({
  title,
  titleId,
  intro,
  initialCnpj,
  secondary,
  onSaved,
}: Readonly<LinkRequestFormProps>) {
  const { user, saveProfile } = useAuth();
  const { error, pending, run } = useAction();
  const buyer = user?.buyer;
  const link = useBuildingLink({
    cnpj: initialCnpj,
    block: buyer?.block ?? "",
    unit: buyer?.unit ?? "",
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const buyerLink = link.readLink();
    if (buyerLink === null) {
      return;
    }
    run(async () => {
      await saveProfile(updateBuyerLink(buyerLink));
      onSaved?.();
    });
  }

  return (
    <AuthLayout title={title} titleId={titleId}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <p>{intro}</p>
        <BuildingLinkFields link={link} />
        <FormError message={error} />
        <div className="flex gap-3">
          <SecondaryButton disabled={pending} onClick={() => secondary.onClick(run)}>
            {secondary.label}
          </SecondaryButton>
          <PrimaryButton disabled={pending} className="flex-1">
            Pedir vínculo
          </PrimaryButton>
        </div>
      </form>
    </AuthLayout>
  );
}

function SwitchBuilding({ onClose }: Readonly<{ onClose: () => void }>) {
  const titleId = useFocusWithoutScroll(true);

  return (
    <LinkRequestForm
      title="Trocar de prédio"
      titleId={titleId}
      intro="Escolha o novo prédio. O pedido atual sai e o síndico do novo prédio recebe o seu pedido."
      initialCnpj=""
      secondary={{ label: "Cancelar", onClick: onClose }}
      onSaved={onClose}
    />
  );
}

export function PendingLink() {
  const { user, refreshUser } = useAuth();
  const logout = useLogout();
  const { error, pending, run } = useAction();
  const [switching, setSwitching] = useState(false);
  const building = user?.buyer?.apartment;

  if (switching) {
    return <SwitchBuilding onClose={() => setSwitching(false)} />;
  }

  return (
    <AuthLayout title="Aguardando aprovação">
      <div className="space-y-6">
        <p>
          Seu pedido de vínculo foi enviado ao síndico. Assim que for aprovado, você poderá
          usar o ConectAgro.
        </p>
        {building && <BuildingCard building={building} />}
        <SecondaryButton size="compact" disabled={pending} onClick={() => setSwitching(true)}>
          Trocar de prédio
        </SecondaryButton>
        <FormError message={error} />
        <div className="flex gap-3">
          <SecondaryButton disabled={pending} onClick={() => run(logout)}>
            Sair
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={pending}
            onClick={() => run(refreshUser)}
            className="flex-1"
          >
            Atualizar
          </PrimaryButton>
        </div>
      </div>
    </AuthLayout>
  );
}

export function RejectedLink() {
  const { user } = useAuth();
  const logout = useLogout();

  return (
    <LinkRequestForm
      title="Vínculo recusado"
      intro="O síndico recusou seu pedido. Confira os dados e peça de novo, ou escolha outro prédio."
      initialCnpj={user?.buyer?.apartment?.building_cnpj ?? ""}
      secondary={{ label: "Sair", onClick: (run) => run(logout) }}
    />
  );
}
