import type { BuildingLinkForm, SearchMode } from "../hooks/useBuildingLink";
import { BuildingChoice } from "./BuildingChoice";
import { LookupStatus } from "./LookupStatus";
import { TextField } from "./TextField";

const MODE_CLASSES =
  "flex h-14 cursor-pointer items-center justify-center rounded-full border border-stone-400 " +
  "px-4 font-bold has-checked:border-2 has-checked:border-lime-800 has-checked:bg-lime-50 " +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 " +
  "has-focus-visible:outline-lime-800";

const MODES: { mode: SearchMode; label: string }[] = [
  { mode: "name", label: "Pelo nome" },
  { mode: "cnpj", label: "Pelo CNPJ" },
];

function ModeChoice({ link }: Readonly<{ link: BuildingLinkForm }>) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold">Como quer achar o seu prédio?</legend>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map((option) => (
          <label key={option.mode} className={MODE_CLASSES}>
            <input
              type="radio"
              name="building-search"
              className="sr-only"
              checked={link.mode === option.mode}
              onChange={() => link.changeMode(option.mode)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BuildingLinkFields({ link }: Readonly<{ link: BuildingLinkForm }>) {
  const { search } = link;
  const byName = link.mode === "name";

  return (
    <>
      <ModeChoice link={link} />
      <TextField
        key={link.mode}
        label={byName ? "Nome do prédio" : "CNPJ do Prédio"}
        hint={byName ? "Digite ao menos 3 letras do nome." : undefined}
        autoComplete="off"
        value={search.query}
        onChange={(event) => link.changeQuery(event.target.value)}
      />
      <LookupStatus searching={search.searching} error={search.error} />
      {search.found && (
        <BuildingChoice
          key={link.mode}
          buildings={search.found}
          mode={link.mode}
          onChoose={link.choose}
        />
      )}
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Bloco"
          optional
          value={link.block}
          onChange={(event) => link.setBlock(event.target.value)}
        />
        <TextField
          label="Apartamento"
          value={link.unit}
          onChange={(event) => link.setUnit(event.target.value)}
        />
      </div>
    </>
  );
}
