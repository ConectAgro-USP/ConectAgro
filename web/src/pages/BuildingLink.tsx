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

function SwitchBuilding({ onClose }: Readonly<{ onClose: () => void }>) {
  const { user, saveProfile } = useAuth();
  const { error, pending, run } = useAction();
  const titleId = useFocusWithoutScroll(true);
  const buyer = user?.buyer;
  const link = useBuildingLink({ cnpj: "", block: buyer?.block ?? "", unit: buyer?.unit ?? "" });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const buyerLink = link.readLink();
    if (buyerLink === null) {
      return;
    }
    run(async () => {
      await saveProfile(updateBuyerLink(buyerLink));
      onClose();
    });
  }

  return (
    <AuthLayout title="Trocar de prédio" titleId={titleId}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <p>
          Escolha o novo prédio. O pedido atual sai e o síndico do novo prédio recebe o seu
          pedido.
        </p>
        <BuildingLinkFields link={link} />
        <FormError message={error} />
        <div className="flex gap-3">
          <SecondaryButton disabled={pending} onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton disabled={pending} className="flex-1">
            Pedir vínculo
          </PrimaryButton>
        </div>
      </form>
    </AuthLayout>
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
  const { user, saveProfile } = useAuth();
  const logout = useLogout();
  const { error, pending, run } = useAction();
  const buyer = user?.buyer;
  const link = useBuildingLink({
    cnpj: buyer?.apartment?.building_cnpj ?? "",
    block: buyer?.block ?? "",
    unit: buyer?.unit ?? "",
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const buyerLink = link.readLink();
    if (buyerLink === null) {
      return;
    }
    run(() => saveProfile(updateBuyerLink(buyerLink)));
  }

  return (
    <AuthLayout title="Vínculo recusado">
      <form onSubmit={handleSubmit} className="space-y-6">
        <p>
          O síndico recusou seu pedido. Confira os dados e peça de novo, ou escolha
          outro prédio.
        </p>
        <BuildingLinkFields link={link} />
        <FormError message={error} />
        <div className="flex gap-3">
          <SecondaryButton disabled={pending} onClick={() => run(logout)}>
            Sair
          </SecondaryButton>
          <PrimaryButton disabled={pending} className="flex-1">
            Pedir vínculo
          </PrimaryButton>
        </div>
      </form>
    </AuthLayout>
  );
}
