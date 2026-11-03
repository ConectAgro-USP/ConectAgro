import { useState, type SubmitEvent } from "react";
import type { ProfileType } from "../api/profiles";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { useAction } from "../hooks/useAction";
import { ApartmentForm } from "./profile/ApartmentForm";
import { BuyerForm } from "./profile/BuyerForm";
import { FarmerForm } from "./profile/FarmerForm";

const OPTION_CLASSES =
  "flex h-20 cursor-pointer items-center rounded-xl border border-stone-400 px-6 text-xl " +
  "font-bold has-checked:border-2 has-checked:border-lime-800 has-checked:bg-lime-50 " +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 " +
  "has-focus-visible:outline-lime-800";

const OPTIONS: { type: ProfileType; label: string }[] = [
  { type: "buyer", label: "Quero comprar" },
  { type: "farmer", label: "Quero vender" },
  { type: "apartment", label: "Sou síndico" },
];

export function ProfileSetup() {
  const { logout } = useAuth();
  const { error, setError, pending, run } = useAction();
  const [chosenProfile, setChosenProfile] = useState<ProfileType>("buyer");
  const [choosing, setChoosing] = useState(true);

  if (!choosing) {
    const goBack = () => setChoosing(true);
    if (chosenProfile === "farmer") return <FarmerForm onBack={goBack} />;
    if (chosenProfile === "apartment") return <ApartmentForm onBack={goBack} />;
    return <BuyerForm onBack={goBack} />;
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setChoosing(false);
  }

  return (
    <AuthLayout title="Perfil">
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="sr-only">Como você vai usar o ConectAgro?</legend>
          {OPTIONS.map((option) => (
            <label key={option.type} className={OPTION_CLASSES}>
              <input
                type="radio"
                name="profile"
                className="sr-only"
                checked={chosenProfile === option.type}
                onChange={() => setChosenProfile(option.type)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <FormError message={error} />
        <div className="flex gap-3">
          <SecondaryButton disabled={pending} onClick={() => run(logout)}>
            Sair
          </SecondaryButton>
          <PrimaryButton disabled={pending} className="flex-1">
            Continuar
          </PrimaryButton>
        </div>
      </form>
    </AuthLayout>
  );
}
