import { screen } from "@testing-library/react";
import type { ProfileRead } from "../api/profiles";
import type { Resident } from "../api/residents";
import { Residents } from "../pages/Residents";
import { ana, fakeAuth, renderWithAuth, stubFetch, villageVilaVerde } from "./helpers";

export const manager: ProfileRead = {
  ...ana,
  profile_type: "apartment",
  apartment: villageVilaVerde,
};

export const tita: Resident = {
  public_id: "morador-1",
  block: "B",
  unit: "132",
  link_status: "PENDENTE",
  // ainda é 31 de outubro em Brasília
  link_requested_at: "2026-11-01T02:00:00Z",
  user: { name: "Tita Russell", email: "tita@example.com" },
};

export const bia: Resident = {
  public_id: "morador-2",
  block: null,
  unit: "21",
  link_status: "PENDENTE",
  link_requested_at: "2026-11-10T14:00:00Z",
  user: { name: "Bia Lima", email: "bia@example.com" },
};

// cada resposta atende um pedido da tela, e um erro simula a rede fora do ar
export function renderResidents(...answers: (Response | Error)[]) {
  const fetchMock = stubFetch();
  for (const answer of answers) {
    if (answer instanceof Error) {
      fetchMock.mockRejectedValueOnce(answer);
    } else {
      fetchMock.mockResolvedValueOnce(answer);
    }
  }
  const auth = fakeAuth({ user: manager });
  renderWithAuth(<Residents />, auth);
  return { fetchMock, auth };
}

export async function findRequest(name: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name });
  return title.closest("li")!;
}
