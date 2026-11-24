import { screen } from "@testing-library/react";
import type { Interest } from "../api/interests";
import { openCostInCents } from "../interestState";
import { MyInterests } from "../pages/MyInterests";
import { anaAsBuyer, fakeAuth, jsonResponse, pageBody, renderWithAuth, stubFetch } from "./helpers";

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

// a página da API, com o total que ela soma dos interesses abertos
export function interestsPage(interests: Interest[], extra: object = {}) {
  const cents = interests.reduce((sum, interest) => sum + openCostInCents(interest), 0);
  return pageBody(interests, { estimated_total: (cents / 100).toFixed(2), ...extra });
}

export function interestsResponse(interests: Interest[], extra: object = {}): Response {
  return jsonResponse(interestsPage(interests, extra));
}

type InterestsAnswer = Interest[] | Response;

// a consulta por produto recebe só o interesse dele, como na API
function answerFor(answer: InterestsAnswer, url: string): Response {
  if (answer instanceof Response) return answer.clone();
  const product = new URL(url, "http://localhost").searchParams.get("product_public_id");
  const found = answer.filter((interest) => !product || interest.product_public_id === product);
  return interestsResponse(found);
}

// a lista do morador sai à parte, e as outras respostas seguem na mesma ordem
export function answerMyInterests(...answers: InterestsAnswer[]) {
  const others = globalThis.fetch;
  const queue: InterestsAnswer[] = answers.length > 0 ? answers : [[]];
  const listed = vi.fn(async (url: string) => {
    const answer = queue.length > 1 ? queue.shift()! : queue[0];
    return answerFor(answer, url);
  });
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith("/api/interests/me") ? listed(String(input)) : others(input, init),
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
