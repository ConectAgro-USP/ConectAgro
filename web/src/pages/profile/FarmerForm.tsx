import { useState, type SubmitEvent } from "react";
import { createFarmer, emptyToNull } from "../../api/profiles";
import { useAuth } from "../../auth/AuthContext";
import { TextField } from "../../components/TextField";
import { useAction } from "../../hooks/useAction";
import { CpfField } from "./CpfField";
import { PhoneFields, type Phones } from "./PhoneFields";
import { ProfileForm } from "./ProfileForm";

export function FarmerForm({ onBack }: Readonly<{ onBack: () => void }>) {
  const { saveProfile } = useAuth();
  const { error, pending, run } = useAction();
  const [phones, setPhones] = useState<Phones>({ cellphone: "", homephone: "" });
  const [farmName, setFarmName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [cpf, setCpf] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const farmer = {
      cpf,
      cellphone: phones.cellphone,
      homephone: emptyToNull(phones.homephone),
      farm_name: farmName,
      zip_code: zipCode,
    };
    run(() => saveProfile(createFarmer(farmer)));
  }

  return (
    <ProfileForm onSubmit={handleSubmit} onBack={onBack} error={error} pending={pending}>
      <PhoneFields phones={phones} onChange={setPhones} />
      <TextField
        label="Nome do sítio ou da horta"
        value={farmName}
        onChange={(event) => setFarmName(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="CEP do sítio"
          inputMode="numeric"
          autoComplete="postal-code"
          value={zipCode}
          onChange={(event) => setZipCode(event.target.value)}
        />
        <CpfField label="CPF" value={cpf} onChange={setCpf} />
      </div>
    </ProfileForm>
  );
}
