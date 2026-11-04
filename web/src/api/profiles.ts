import { apiFetch } from "./client";

export type ProfileType = "farmer" | "apartment" | "buyer";
export type LinkStatus = "PENDENTE" | "APROVADO" | "RECUSADO";

export interface ApartmentPreview {
  building_name: string;
  zip_code: string | null;
  address: string | null;
}

export interface ApartmentSummary {
  public_id: string;
  building_name: string;
  building_cnpj: string;
  address: string | null;
}

export interface ApartmentMatch extends ApartmentSummary {
  manager_short_name: string;
}

export interface BuyerRead {
  block: string | null;
  unit: string;
  link_status: LinkStatus;
  apartment: ApartmentSummary | null;
}

export interface ProfileRead {
  name: string;
  email: string;
  profile_type: ProfileType | null;
  buyer: BuyerRead | null;
}

export interface ProfileCreate {
  cpf: string;
  cellphone: string;
  homephone: string | null;
}

export interface BuyerLink {
  apartment_public_id: string;
  block: string | null;
  unit: string;
}

export interface FarmerCreate extends ProfileCreate {
  farm_name: string;
  zip_code: string;
}

export interface ApartmentCreate extends ProfileCreate {
  building_cnpj: string;
  zip_code: string;
}

export interface BuyerCreate extends ProfileCreate, BuyerLink {}

export function emptyToNull(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  return trimmed;
}

function sendJson(method: string, path: string, body: object): Promise<ProfileRead> {
  return apiFetch<ProfileRead>(path, { method, body: JSON.stringify(body) });
}

export function createFarmer(farmer: FarmerCreate): Promise<ProfileRead> {
  return sendJson("POST", "/profiles/farmer", farmer);
}

export function createApartment(apartment: ApartmentCreate): Promise<ProfileRead> {
  return sendJson("POST", "/profiles/apartment", apartment);
}

export function createBuyer(buyer: BuyerCreate): Promise<ProfileRead> {
  return sendJson("POST", "/profiles/buyer", buyer);
}

export function updateBuyerLink(link: BuyerLink): Promise<ProfileRead> {
  return sendJson("PATCH", "/profiles/me", link);
}

export function previewApartment(cnpj: string): Promise<ApartmentPreview> {
  return apiFetch<ApartmentPreview>(`/profiles/apartment/preview?${new URLSearchParams({ cnpj })}`);
}

export function findApartments(cnpj: string): Promise<ApartmentMatch[]> {
  return apiFetch<ApartmentMatch[]>(`/apartments?${new URLSearchParams({ cnpj })}`);
}
