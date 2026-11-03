import { useState, type SubmitEvent } from "react";
import { createApartment, emptyToNull, previewApartment } from "../../api/profiles";
import { useAuth } from "../../auth/AuthContext";
import { BuildingCard } from "../../components/BuildingCard";
import { LookupStatus } from "../../components/LookupStatus";
import { TextField } from "../../components/TextField";
import { useAction } from "../../hooks/useAction";
import { useBuildingLookup } from "../../hooks/useBuildingLookup";
import { CpfField } from "./CpfField";
import { PhoneFields, type Phones } from "./PhoneFields";
import { ProfileForm } from "./ProfileForm";

export function ApartmentForm({ onBack }: Readonly<{ onBack: () => void }>) {
  const { saveProfile } = useAuth();
  const { error, pending, run } = useAction();
  const [phones, setPhones] = useState<Phones>({ cellphone: "", homephone: "" });
  const [cpf, setCpf] = useState("");
  const lookup = useBuildingLookup(previewApartment);
  // o CEP da CNPJá muitas vezes não tem coordenadas na BrasilAPI
  const [editedZipCode, setEditedZipCode] = useState<string | null>(null);
  const zipCode = editedZipCode ?? lookup.found?.zip_code ?? "";

  function handleCnpjChange(cnpj: string) {
    lookup.changeCnpj(cnpj);
    setEditedZipCode(null);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lookup.requireFound() === null) {
      return;
    }
    const apartment = {
      cpf,
      cellphone: phones.cellphone,
      homephone: emptyToNull(phones.homephone),
      building_cnpj: lookup.cnpj,
      zip_code: zipCode,
    };
    run(() => saveProfile(createApartment(apartment)));
  }

  return (
    <ProfileForm onSubmit={handleSubmit} onBack={onBack} error={error} pending={pending}>
      <PhoneFields phones={phones} onChange={setPhones} />
      <div className="grid grid-cols-2 gap-4">
        <CpfField label="CPF do síndico" value={cpf} onChange={setCpf} />
        <TextField
          label="CNPJ do Prédio"
          value={lookup.cnpj}
          onChange={(event) => handleCnpjChange(event.target.value)}
        />
      </div>
      <LookupStatus searching={lookup.searching} error={lookup.error} />
      {lookup.found && (
        <>
          <BuildingCard building={lookup.found} />
          <TextField
            label="CEP do Prédio"
            inputMode="numeric"
            autoComplete="postal-code"
            value={zipCode}
            onChange={(event) => setEditedZipCode(event.target.value)}
          />
        </>
      )}
    </ProfileForm>
  );
}
