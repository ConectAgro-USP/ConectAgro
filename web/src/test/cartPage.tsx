import { fireEvent, screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import type { ProductDetail } from "../api/products";
import type { CartItem } from "../hooks/useCart";
import { Cart } from "../pages/Cart";
import { storeCart } from "./cart";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "./helpers";
import { alface, laranja, mandioca } from "./needs";

export const JOAO = "João Vikator, Sítio LabXP";
export const MANDIOCA = mandioca.product;
export const ALFACE = alface.product;
export const LARANJA = laranja.product;

export function inCart(product: ProductDetail, quantity: number): CartItem {
  return {
    productPublicId: product.public_id,
    quantity,
    unitPrice: product.price,
    unit: product.unit,
  };
}

// o carrinho confere cada produto na API quando abre
export function renderCartPage(items: CartItem[], ...responses: Response[]) {
  storeCart(items);
  const fetchMock = stubFetch(...responses);
  const auth = fakeAuth({ user: anaAsManager });
  renderWithAuth(
    <Routes>
      <Route path="/carrinho" element={<Cart />} />
      <Route path="/compras" element={<h1>Compras do prédio</h1>} />
      <Route path="/" element={<h1>Produtos</h1>} />
    </Routes>,
    auth,
    "/carrinho",
  );
  return { fetchMock, auth };
}

export function productsOf(...products: ProductDetail[]): Response[] {
  return products.map((product) => jsonResponse(product));
}

export function quantityOf(name: string, group: HTMLElement = document.body): HTMLElement {
  return within(group).getByRole("spinbutton", { name: `Quantidade de ${name} em kg` });
}

export async function findQuantity(name: string): Promise<HTMLElement> {
  return screen.findByRole("spinbutton", { name: `Quantidade de ${name} em kg` });
}

export function groupOf(farmer: string): HTMLElement {
  return screen.getByRole("heading", { name: farmer }).closest("section")!;
}

export function lineOf(name: string): HTMLElement {
  return screen.getByRole("link", { name }).closest("li")!;
}

export function fillDeliveryDate(date: string) {
  fireEvent.change(screen.getByLabelText("Entrega prevista"), { target: { value: date } });
}
