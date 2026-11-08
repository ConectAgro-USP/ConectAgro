import type { ReactNode } from "react";
import type { BuildingLinkForm } from "../hooks/useBuildingLink";
import { BuildingChoice } from "./BuildingChoice";
import { LookupStatus } from "./LookupStatus";
import { TextField } from "./TextField";

interface BuildingLinkFieldsProps {
  link: BuildingLinkForm;
  besideCnpj?: ReactNode;
}

export function BuildingLinkFields({ link, besideCnpj }: Readonly<BuildingLinkFieldsProps>) {
  return (
    <>
      <div className={besideCnpj ? "grid grid-cols-2 gap-4" : undefined}>
        <TextField
          label="CNPJ do Prédio"
          value={link.cnpj}
          onChange={(event) => link.changeCnpj(event.target.value)}
        />
        {besideCnpj}
      </div>
      <LookupStatus searching={link.searching} error={link.error} />
      {link.found && <BuildingChoice buildings={link.found} onChoose={link.choose} />}
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
