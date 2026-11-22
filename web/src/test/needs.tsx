import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { use, type ReactNode } from "react";
import { Route, Routes } from "react-router";
import type { BuildingNeed } from "../api/interests";
import { BuildingNeeds } from "../pages/BuildingNeeds";
import { anaAsManager, fakeAuth, renderWithAuth, stubFetch } from "./helpers";
import { sampleProduct } from "./productDetail";

export const mandioca: BuildingNeed = {
  product: { ...sampleProduct, public_id: "produto-1", name: "Mandioca" },
  total_quantity: 12,
  interested_buyers_count: 3,
};
// o estoque fica abaixo do total pedido pelos moradores
export const alface: BuildingNeed = {
  product: {
    ...sampleProduct,
    public_id: "produto-2",
    name: "Alface",
    price: "3.50",
    quantity: 4,
  },
  total_quantity: 5,
  interested_buyers_count: 2,
};
export const laranja: BuildingNeed = {
  product: {
    ...sampleProduct,
    public_id: "produto-3",
    name: "Laranja",
    price: "4.50",
    quantity: 30,
    farmer_public_id: "agricultor-2",
    farmer: {
      public_id: "agricultor-2",
      short_name: "Maria F.",
      farm_name: null,
      picture_url: null,
    },
  },
  total_quantity: 1,
  interested_buyers_count: 1,
};

export const soldOutAlface: BuildingNeed = {
  ...alface,
  product: { ...alface.product, quantity: 0 },
};

function renderRoutes(purchases: ReactNode, responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(
    <Routes>
      <Route path="/" element={<BuildingNeeds />} />
      <Route path="/compras" element={purchases} />
    </Routes>,
    fakeAuth({ user: anaAsManager }),
  );
  return fetchMock;
}

export function renderNeeds(...responses: Response[]) {
  return renderRoutes(<h1>Compras do prédio</h1>, responses);
}

// a troca de página espera a promessa, e o formulário fica na tela
export function renderNeedsWithSlowPurchases(...responses: Response[]) {
  const neverLoaded = new Promise<ReactNode>(() => {});
  function SlowPurchases() {
    return use(neverLoaded);
  }
  return renderRoutes(<SlowPurchases />, responses);
}

export async function openPurchase(...names: string[]) {
  for (const name of names) {
    const selection = new RegExp(`^Selecionar ${name} de`);
    await userEvent.click(await screen.findByRole("checkbox", { name: selection }));
  }
  await userEvent.click(screen.getByRole("button", { name: "Fechar compra" }));
}

export function groupOf(farmer: string): HTMLElement {
  return screen.getByRole("heading", { name: farmer }).closest("section")!;
}

export function fillDeliveryDate(date: string) {
  fireEvent.change(screen.getByLabelText("Entrega prevista"), { target: { value: date } });
}
