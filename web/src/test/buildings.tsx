import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApartmentMatch } from "../api/profiles";

export const edificioBauru: ApartmentMatch = {
  public_id: "0b9f8d2a-1c3e-4f5a-9b7c-6d5e4f3a2b1c",
  building_name: "Edifício Bauru",
  building_cnpj: "60701190000104",
  zip_code: "01310200",
  address: "Avenida Paulista, 1000 - Bela Vista, São Paulo",
  manager_short_name: "Bruno C.",
};

// a busca por nome espera a pessoa parar de digitar
export const NAME_SEARCH_WAIT = { timeout: 3000 };

export async function typeInto(label: string, text: string) {
  await userEvent.type(screen.getByLabelText(label), text);
}

export function searchByCnpj() {
  return userEvent.click(screen.getByRole("radio", { name: "Pelo CNPJ" }));
}

export function searchByName() {
  return userEvent.click(screen.getByRole("radio", { name: "Pelo nome" }));
}

export function confirmBuilding() {
  return userEvent.click(screen.getByLabelText("Este é o seu condomínio?"));
}
