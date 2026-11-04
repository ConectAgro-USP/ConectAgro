import type { ApartmentMatch } from "../api/profiles";
import { BuildingCard } from "./BuildingCard";
import { FormError } from "./FormError";

const NO_BUILDING =
  "Nenhum prédio cadastrado com este CNPJ. " +
  "Confira o número ou peça ao síndico para cadastrar o prédio";
const CHOICE_CLASSES =
  "flex cursor-pointer items-center rounded-xl border border-stone-400 py-4 pl-4 " +
  "has-checked:border-2 has-checked:border-lime-800 has-checked:bg-lime-50";

interface BuildingChoiceProps {
  buildings: ApartmentMatch[];
  onChoose: (building: ApartmentMatch | null) => void;
}

export function BuildingChoice({ buildings, onChoose }: Readonly<BuildingChoiceProps>) {
  if (buildings.length === 0) {
    return <FormError message={NO_BUILDING} />;
  }

  if (buildings.length === 1) {
    const building = buildings[0];
    return (
      <>
        <BuildingCard building={building} />
        <label className="flex items-center gap-3 font-bold">
          <input
            type="checkbox"
            required
            className="size-7 accent-lime-800"
            onChange={(event) => onChoose(event.target.checked ? building : null)}
          />
          Este é o seu condomínio?
        </label>
      </>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 font-bold">Mais de um prédio usa este CNPJ. Qual é o seu?</legend>
      {buildings.map((building) => (
        <label key={building.public_id} className={CHOICE_CLASSES}>
          <input
            type="radio"
            name="apartment"
            required
            className="size-5 accent-lime-800"
            onChange={() => onChoose(building)}
          />
          <BuildingCard building={building} />
        </label>
      ))}
    </fieldset>
  );
}
