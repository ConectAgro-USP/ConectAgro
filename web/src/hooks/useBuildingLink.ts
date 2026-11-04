import { useState } from "react";
import {
  emptyToNull,
  findApartments,
  type ApartmentMatch,
  type BuyerLink,
} from "../api/profiles";
import { useBuildingLookup } from "./useBuildingLookup";

export interface InitialLink {
  cnpj: string;
  block: string;
  unit: string;
}

export interface BuildingLinkForm {
  cnpj: string;
  changeCnpj: (cnpj: string) => void;
  found: ApartmentMatch[] | null;
  searching: boolean;
  error: string;
  choose: (building: ApartmentMatch | null) => void;
  block: string;
  setBlock: (block: string) => void;
  unit: string;
  setUnit: (unit: string) => void;
  readLink: () => BuyerLink | null;
}

export function useBuildingLink(initial: InitialLink): BuildingLinkForm {
  const lookup = useBuildingLookup(findApartments, initial.cnpj);
  const [chosen, setChosen] = useState<ApartmentMatch | null>(null);
  const [block, setBlock] = useState(initial.block);
  const [unit, setUnit] = useState(initial.unit);

  function changeCnpj(cnpj: string) {
    lookup.changeCnpj(cnpj);
    setChosen(null);
  }

  function readLink(): BuyerLink | null {
    if (lookup.requireFound() === null || chosen === null) {
      return null;
    }
    return { apartment_public_id: chosen.public_id, block: emptyToNull(block), unit };
  }

  return {
    cnpj: lookup.cnpj,
    changeCnpj,
    found: lookup.found,
    searching: lookup.searching,
    error: lookup.error,
    choose: setChosen,
    block,
    setBlock,
    unit,
    setUnit,
    readLink,
  };
}
