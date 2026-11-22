import { Route, Routes } from "react-router";
import type { ProductDetail as ProductDetailType } from "../api/products";
import { ProductDetail } from "../pages/ProductDetail";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth } from "./helpers";

export const sampleProduct: ProductDetailType = {
  public_id: "prod-123",
  name: "Mandioca Natural",
  description: "Mandioca orgânica plantada no sítio. Sem agrotóxicos e colhida fresca.",
  picture_url: "https://example.com/mandioca.jpg",
  quantity: 25,
  price: "20.00",
  expiration_date: "2099-10-20",
  is_available: true,
  farmer_public_id: "farmer-1",
  created_at: "2026-10-01T10:00:00Z",
  farmer: {
    public_id: "farmer-1",
    short_name: "João Vikator",
    farm_name: "Sítio LabXP",
    picture_url: "https://example.com/joao.jpg",
  },
};

export const emptyReviews = {
  average_rating: null,
  reviews_count: 0,
  reviews: [],
};

export const managerContact = {
  recipient_name: "Carlos S.",
  cellphone: "11987654321",
  message: "Olá, Carlos S.! Tenho interesse no produto Mandioca Natural do agricultor João V.",
};

// o morador e o síndico pedem o contato antes da nota do agricultor
export function pageLoad(product = sampleProduct, reviews: unknown = emptyReviews): Response[] {
  return [jsonResponse(product), jsonResponse(managerContact), jsonResponse(reviews)];
}

export function renderDetail(
  auth = fakeAuth({ user: anaAsBuyer("APROVADO") }),
  url = "/produtos/prod-123",
) {
  return renderWithAuth(
    <Routes>
      <Route path="/produtos/:publicId" element={<ProductDetail />} />
    </Routes>,
    auth,
    url,
  );
}
