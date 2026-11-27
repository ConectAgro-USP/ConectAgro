import type { Interest } from "../api/interests";
import { stubFetch } from "./helpers";
import { mandioca } from "./interests";
import { pageLoad, renderDetail } from "./productDetail";

// o interesse do morador no produto da página
export const openInterest: Interest = {
  ...mandioca,
  public_id: "interesse-9",
  product_public_id: "prod-123",
  product_name: "Mandioca Natural",
  quantity: 5,
};
export const inPurchase: Interest = {
  ...openInterest,
  purchase: {
    public_id: "compra-1",
    created_at: "2026-11-20T12:00:00Z",
    expected_delivery_date: "2026-11-27",
    status: "EM PROGRESSO",
    closed_at: null,
  },
};
export const delivered: Interest = {
  ...openInterest,
  purchase: { ...inPurchase.purchase!, status: "ENTREGUE", closed_at: "2026-11-25T15:00:00Z" },
};

type ListAnswer = Interest[] | Response;

// as listas respondem às leituras do morador, e o resto vem depois da página
export function renderResident(lists: ListAnswer[], ...more: Response[]) {
  const fetchMock = stubFetch(...pageLoad(), ...more);
  renderDetail(undefined, undefined, ...lists);
  return fetchMock;
}
