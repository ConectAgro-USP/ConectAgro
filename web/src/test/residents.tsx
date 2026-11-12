import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Resident } from "../api/residents";
import { Residents } from "../pages/Residents";
import { anaAsManager, fakeAuth, renderWithAuth, stubFetch } from "./helpers";

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

// depois da resposta do síndico a API não manda mais o e-mail
export const caio: Resident = {
  public_id: "morador-3",
  block: "A",
  unit: "14",
  link_status: "APROVADO",
  link_requested_at: "2026-10-20T14:00:00Z",
  user: { name: "Caio Nogueira", email: null },
};

export const davi: Resident = {
  ...caio,
  public_id: "morador-4",
  link_status: "RECUSADO",
  user: { name: "Davi Rocha", email: null },
};

// o erro simula a rede fora do ar, e a promessa deixa a resposta para depois
export function renderResidents(...answers: (Response | Error | Promise<Response>)[]) {
  const fetchMock = stubFetch();
  for (const answer of answers) {
    if (answer instanceof Error) {
      fetchMock.mockRejectedValueOnce(answer);
    } else {
      fetchMock.mockReturnValueOnce(Promise.resolve(answer));
    }
  }
  const auth = fakeAuth({ user: anaAsManager });
  renderWithAuth(<Residents />, auth);
  return { fetchMock, auth };
}

export async function findCard(name: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name });
  return title.closest("li")!;
}

export function press(card: HTMLElement, button: string) {
  return userEvent.click(within(card).getByRole("button", { name: button }));
}
