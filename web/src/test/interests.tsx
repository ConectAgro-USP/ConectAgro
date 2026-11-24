import { screen } from "@testing-library/react";
import type { Interest } from "../api/interests";
import { MyInterests } from "../pages/MyInterests";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "./helpers";

export const mandioca: Interest = {
  public_id: "interesse-1",
  buyer_public_id: "morador-1",
  product_public_id: "produto-1",
  product_name: "Mandioca",
  product_status: "Disponível",
  quantity: 5,
  created_at: "2026-11-20T12:00:00Z",
  updated_at: null,
  purchase: null,
  product: {
    picture_url: null,
    price: "4.50",
    unit: "kg",
    quantity: 20,
    expiration_date: "2099-12-10",
    is_available: true,
    farmer: { public_id: "agricultor-1", short_name: "João S.", farm_name: "Sítio Borba" },
  },
};
export const laranja: Interest = {
  ...mandioca,
  public_id: "interesse-2",
  product_public_id: "produto-2",
  product_name: "Laranja",
  product_status: "Indisponível",
  quantity: 3,
};

type InterestsAnswer = Interest[] | Response;

// a lista do morador sai à parte, e as outras respostas seguem na mesma ordem
export function answerMyInterests(...answers: InterestsAnswer[]) {
  const others = globalThis.fetch;
  const queue: InterestsAnswer[] = answers.length > 0 ? answers : [[]];
  const listed = vi.fn(async () => {
    const answer = queue.length > 1 ? queue.shift()! : queue[0];
    return answer instanceof Response ? answer.clone() : jsonResponse(answer);
  });
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === "/api/interests/me" ? listed() : others(input, init),
  );
  return listed;
}

export function renderInterests(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(<MyInterests />, fakeAuth({ user: anaAsBuyer("APROVADO") }));
  return fetchMock;
}

export async function findCard(name: string): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { name })).closest("li")!;
}
