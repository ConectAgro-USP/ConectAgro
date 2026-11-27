import { apiFetch } from "./client";
import { pageQuery, type Page } from "./pagination";
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

export function listResidents(status: LinkStatus, page: number): Promise<Page<Resident>> {
  const query = pageQuery(page);
  query.set("status", status);
  return apiFetch<Page<Resident>>(`/apartments/me/buyers?${query}`);
}

export function approveResident(publicId: string): Promise<Resident> {
  return apiFetch<Resident>(`/apartments/me/buyers/${publicId}/approve`, { method: "POST" });
}

export function rejectResident(publicId: string): Promise<Resident> {
  return apiFetch<Resident>(`/apartments/me/buyers/${publicId}/reject`, { method: "POST" });
}
