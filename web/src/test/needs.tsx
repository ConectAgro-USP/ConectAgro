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

export function renderNeeds(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  renderWithAuth(
    <Routes>
      <Route path="/" element={<BuildingNeeds />} />
      <Route path="/carrinho" element={<h1>Carrinho</h1>} />
    </Routes>,
    fakeAuth({ user: anaAsManager }),
  );
  return fetchMock;
}
