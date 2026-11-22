import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Product } from "../api/products";
import { MyProducts } from "../pages/MyProducts";
import { anaAsFarmer, fakeAuth, renderWithAuth, stubFetch } from "./helpers";

export const orange: Product = {
  public_id: "produto-1",
  name: "Laranja",
  description: "Laranja pera",
  picture_url: "https://example.com/laranja.png",
  quantity: 12,
  price: "4.99",
  expiration_date: "2030-10-25",
  farmer_public_id: "agricultor-1",
  created_at: "2026-11-12T12:00:00Z",
};

export function renderProducts(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(<MyProducts />, fakeAuth({ user: anaAsFarmer }));
  return fetchMock;
}

export async function findCard(name: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { name });
  return title.closest("li")!;
}

export function press(card: HTMLElement, button: string) {
  return userEvent.click(within(card).getByRole("button", { name: button }));
}
