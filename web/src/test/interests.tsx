import { screen } from "@testing-library/react";
import type { Interest } from "../api/interests";
import { MyInterests } from "../pages/MyInterests";
import { anaAsBuyer, fakeAuth, renderWithAuth, stubFetch } from "./helpers";

export const mandioca: Interest = {
  public_id: "interesse-1",
  buyer_public_id: "morador-1",
  product_public_id: "produto-1",
  product_name: "Mandioca",
  product_status: "Disponível",
  quantity: 5,
  created_at: "2026-11-20T12:00:00Z",
  updated_at: null,
};
export const laranja: Interest = {
  ...mandioca,
  public_id: "interesse-2",
  product_public_id: "produto-2",
  product_name: "Laranja",
  product_status: "Indisponível",
  quantity: 3,
};

export function renderInterests(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(<MyInterests />, fakeAuth({ user: anaAsBuyer("APROVADO") }));
  return fetchMock;
}

export async function findCard(name: string): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { name })).closest("li")!;
}
