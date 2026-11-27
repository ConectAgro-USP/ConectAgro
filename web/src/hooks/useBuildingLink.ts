import { useState } from "react";
import {
  emptyToNull,
  findApartments,
  findApartmentsByName,
  type ApartmentMatch,
  type BuyerLink,
} from "../api/profiles";
import { NAME_RULE, useBuildingLookup, type BuildingLookup } from "./useBuildingLookup";

export type SearchMode = "name" | "cnpj";

export interface InitialLink {
  cnpj: string;
  block: string;
  unit: string;
}

export interface BuildingLinkForm {
  mode: SearchMode;
  changeMode: (mode: SearchMode) => void;
  search: BuildingLookup<ApartmentMatch[]>;
  changeQuery: (query: string) => void;
  choose: (building: ApartmentMatch | null) => void;
  block: string;
  setBlock: (block: string) => void;
  unit: string;
  setUnit: (unit: string) => void;
  readLink: () => BuyerLink | null;
}

export function useBuildingLink(initial: InitialLink): BuildingLinkForm {
  // quem já tem um CNPJ segue nele, quem começa acha o prédio pelo nome
  const [mode, setMode] = useState<SearchMode>(initial.cnpj ? "cnpj" : "name");
  const byCnpj = useBuildingLookup(findApartments, initial.cnpj);
  const byName = useBuildingLookup(findApartmentsByName, "", NAME_RULE);
  const search = mode === "cnpj" ? byCnpj : byName;
  const [chosen, setChosen] = useState<ApartmentMatch | null>(null);
  const [block, setBlock] = useState(initial.block);
  const [unit, setUnit] = useState(initial.unit);

  function changeMode(next: SearchMode) {
    setMode(next);
    setChosen(null);
  }

  function changeQuery(query: string) {
    search.changeQuery(query);
    setChosen(null);
  }

  function readLink(): BuyerLink | null {
    if (search.requireFound() === null || chosen === null) {
      return null;
    }
    return { apartment_public_id: chosen.public_id, block: emptyToNull(block), unit };
  }

  return {
    mode,
    changeMode,
    search,
    changeQuery,
    choose: setChosen,
    block,
    setBlock,
    unit,
    setUnit,
    readLink,
  };
}
