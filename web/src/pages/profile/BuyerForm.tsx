import { useState, type SubmitEvent } from "react";
import { createBuyer, emptyToNull } from "../../api/profiles";
import { useAuth } from "../../auth/AuthContext";
import { BuildingLinkFields } from "../../components/BuildingLinkFields";
import { useAction } from "../../hooks/useAction";
import { useBuildingLink } from "../../hooks/useBuildingLink";
import { CpfField } from "./CpfField";
import { PhoneFields, type Phones } from "./PhoneFields";
import { ProfileForm } from "./ProfileForm";

export function BuyerForm({ onBack }: Readonly<{ onBack: () => void }>) {
  const { saveProfile } = useAuth();
  const { error, pending, run } = useAction();
  const [phones, setPhones] = useState<Phones>({ cellphone: "", homephone: "" });
  const [cpf, setCpf] = useState("");
  const link = useBuildingLink({ cnpj: "", block: "", unit: "" });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const buyerLink = link.readLink();
    if (buyerLink === null) {
      return;
    }
    const buyer = {
      cpf,
      cellphone: phones.cellphone,
      homephone: emptyToNull(phones.homephone),
      ...buyerLink,
    };
    run(() => saveProfile(createBuyer(buyer)));
  }

  return (
    <ProfileForm onSubmit={handleSubmit} onBack={onBack} error={error} pending={pending}>
      <PhoneFields phones={phones} onChange={setPhones} />
      <BuildingLinkFields
        link={link}
        besideCnpj={<CpfField label="CPF" value={cpf} onChange={setCpf} />}
      />
    </ProfileForm>
  );
}
