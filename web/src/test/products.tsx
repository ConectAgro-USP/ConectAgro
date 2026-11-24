import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MyProduct } from "../api/products";
import { MyProducts } from "../pages/MyProducts";
import { anaAsFarmer, fakeAuth, renderWithAuth, stubFetch } from "./helpers";

export const orange: MyProduct = {
  public_id: "produto-1",
  name: "Laranja",
  description: "Laranja pera",
  picture_url: "https://example.com/laranja.png",
  quantity: 12,
  is_available: true,
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

// a foto que o navegador entregaria depois de reduzir
export const SHRUNK = new Blob(["foto reduzida"], { type: "image/jpeg" });
export const UPLOADED_URL = "/api/products/produto-1/picture?v=0123456789ab";

// o jsdom não tem URL.createObjectURL, que a prévia usa
export function stubPreviews() {
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:foto"), revokeObjectURL: vi.fn() });
}

export function choosePicture(label = "Tirar ou escolher foto") {
  const file = new File(["foto"], "laranja.jpg", { type: "image/jpeg" });
  return userEvent.upload(screen.getByLabelText(label), file);
}

export async function openNewForm() {
  await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));
}

export async function fillRequired(name: string) {
  await userEvent.type(screen.getByLabelText("Nome do produto"), name);
  await userEvent.type(screen.getByLabelText("Preço (R$)"), "4.99");
  await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "12");
  fireEvent.change(screen.getByLabelText("Data de vencimento"), {
    target: { value: "2030-10-25" },
  });
}

export function save() {
  return userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}
