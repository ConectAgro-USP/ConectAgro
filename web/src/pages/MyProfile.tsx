import { useState, type SubmitEvent } from "react";
import { emptyToNull, updateProfile, type ProfileRead, type ProfileUpdate } from "../api/profiles";
import { useAuth } from "../auth/AuthContext";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { FormSection } from "../components/FormSection";
import { ProfileCard } from "../components/ProfileCard";
import { TextField } from "../components/TextField";
import { useAction } from "../hooks/useAction";
import { PhoneFields } from "./profile/PhoneFields";

interface ProfileFields {
  name: string;
  cellphone: string;
  homephone: string;
  farmName: string;
  zipCode: string;
  cnpj: string;
}

// a API guarda só os dígitos do telefone
function formatPhone(phone: string | null): string {
  if (phone === null) {
    return "";
  }
  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

function savedFields(user: ProfileRead): ProfileFields {
  return {
    name: user.name,
    cellphone: formatPhone(user.cellphone),
    homephone: formatPhone(user.homephone),
    farmName: user.farmer?.farm_name ?? "",
    zipCode: user.farmer?.zip_code ?? user.apartment?.zip_code ?? "",
    cnpj: user.apartment?.building_cnpj ?? "",
  };
}

// envia todos os campos: a API só consulta o CEP e o CNPJ que mudaram
function readProfileUpdate(user: ProfileRead, fields: ProfileFields): ProfileUpdate {
  const changes: ProfileUpdate = {
    name: fields.name,
    cellphone: fields.cellphone,
    homephone: emptyToNull(fields.homephone),
  };
  if (user.farmer) {
    changes.farm_name = fields.farmName;
    changes.zip_code = fields.zipCode;
  }
  if (user.apartment) {
    changes.building_cnpj = fields.cnpj;
    changes.zip_code = fields.zipCode;
  }
  return changes;
}

export function MyProfile() {
  const { user } = useAuth();

  // a ProtectedRoute só mostra esta página com o usuário carregado
  if (!user) {
    return null;
  }
  return <ProfileEditor user={user} />;
}

function ProfileEditor({ user }: Readonly<{ user: ProfileRead }>) {
  const { saveProfile } = useAuth();
  const { error, setError, pending, run } = useAction();
  const [fields, setFields] = useState(savedFields(user));
  const [saved, setSaved] = useState(false);

  function changeFields(newValues: Partial<ProfileFields>) {
    setFields({ ...fields, ...newValues });
    setSaved(false);
  }

  function handleCancel() {
    setFields(savedFields(user));
    setError("");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const changes = readProfileUpdate(user, fields);
    run(async () => {
      await saveProfile(updateProfile(changes));
      setSaved(true);
    });
  }

  return (
    <main className="px-6 py-12 text-stone-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-4xl font-extrabold">Meu perfil</h1>
        <ProfileCard user={user} />
        <form onSubmit={handleSubmit} className="mt-6">
          {/* travados enquanto salva: o que fosse digitado não iria no pedido */}
          <fieldset disabled={pending}>
            <FormSection title="Dados pessoais">
              <TextField
                label="Nome completo"
                autoComplete="name"
                value={fields.name}
                onChange={(event) => changeFields({ name: event.target.value })}
              />
              <TextField label="E-mail" type="email" readOnly required={false} value={user.email} />
            </FormSection>
            <FormSection title="Contato">
              <PhoneFields
                phones={{ cellphone: fields.cellphone, homephone: fields.homephone }}
                onChange={changeFields}
              />
            </FormSection>
            {user.farmer && (
              <FormSection title="Sítio">
                <TextField
                  label="Nome do sítio ou da horta"
                  value={fields.farmName}
                  onChange={(event) => changeFields({ farmName: event.target.value })}
                />
                <TextField
                  label="CEP do sítio"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={fields.zipCode}
                  onChange={(event) => changeFields({ zipCode: event.target.value })}
                />
              </FormSection>
            )}
            {user.apartment && (
              <FormSection title="Prédio">
                <TextField
                  label="CNPJ do Prédio"
                  value={fields.cnpj}
                  onChange={(event) => changeFields({ cnpj: event.target.value })}
                />
                <TextField
                  label="CEP do Prédio"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={fields.zipCode}
                  onChange={(event) => changeFields({ zipCode: event.target.value })}
                />
              </FormSection>
            )}
          </fieldset>
          <div className="space-y-4 border-t border-stone-300 pt-6">
            <FormError message={error} />
            {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
            <output className="block font-bold text-lime-800">
              {saved ? "Perfil atualizado" : ""}
            </output>
            <div className="flex justify-end gap-3">
              <SecondaryButton disabled={pending} onClick={handleCancel}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton disabled={pending}>Salvar</PrimaryButton>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
