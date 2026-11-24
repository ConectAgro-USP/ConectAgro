import { Route, Routes } from "react-router";
import type { Interest } from "../api/interests";
import type { ProductDetail as ProductDetailType } from "../api/products";
import { ProductDetail } from "../pages/ProductDetail";
import type { ReceivedReview } from "../api/reviews";
import { anaAsBuyer, fakeAuth, jsonResponse, pageBody, renderWithAuth } from "./helpers";
import { answerMyInterests } from "./interests";

export const sampleProduct: ProductDetailType = {
  public_id: "prod-123",
  name: "Mandioca Natural",
  description: "Mandioca orgânica plantada no sítio. Sem agrotóxicos e colhida fresca.",
  picture_url: "https://example.com/mandioca.jpg",
  quantity: 25,
  price: "20.00",
  unit: "kg",
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

// a média e a contagem valem para todas, a página traz só as escritas
export function farmerReviews(written: ReceivedReview[], average: number | null, count: number) {
  return pageBody(written, { average_rating: average, reviews_count: count });
}

export const emptyReviews = farmerReviews([], null, 0);

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
  ...interests: (Interest[] | Response)[]
) {
  const listed = answerMyInterests(...interests);
  const view = renderWithAuth(
    <Routes>
      <Route path="/produtos/:publicId" element={<ProductDetail />} />
    </Routes>,
    auth,
    url,
  );
  // as leituras do interesse, para o teste ver o que foi pedido
  return Object.assign(view, { listed });
}
