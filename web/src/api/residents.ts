import { apiFetch } from "./client";
import type { LinkStatus } from "./profiles";

export interface Resident {
  public_id: string;
  block: string | null;
  unit: string;
  link_status: LinkStatus;
  link_requested_at: string;
  // a API só manda o e-mail enquanto o pedido espera resposta
  user: { name: string; email: string | null };
}

export function listPendingResidents(): Promise<Resident[]> {
  return apiFetch<Resident[]>("/apartments/me/buyers?status=PENDENTE");
}

export function approveResident(publicId: string): Promise<Resident> {
  return apiFetch<Resident>(`/apartments/me/buyers/${publicId}/approve`, { method: "POST" });
}

export function rejectResident(publicId: string): Promise<Resident> {
  return apiFetch<Resident>(`/apartments/me/buyers/${publicId}/reject`, { method: "POST" });
}
