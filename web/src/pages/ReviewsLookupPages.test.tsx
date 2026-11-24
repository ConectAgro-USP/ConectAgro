import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReceivedReview, Reviewable } from "../api/reviews";
import {
  anaAsManager,
  fakeAuth,
  jsonResponse,
  pageResponse,
  renderWithAuth,
  stubFetch,
} from "../test/helpers";
import {
  farmerReviews,
  managerContact,
  renderDetail,
  sampleProduct,
} from "../test/productDetail";
import { findCard, pageOf, purchase } from "../test/purchases";
import { BuildingPurchases } from "./BuildingPurchases";

const LARGE = { total: 101, total_pages: 2, page_size: 100 };
const mariaToRate: Reviewable = {
  purchase_public_id: "compra-1",
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  delivered_at: "2026-11-11T15:00:00Z",
  product_names: ["Tomate"],
};

function written(day: number): ReceivedReview {
  const created_at = `2026-11-${String(day).padStart(2, "0")}T15:00:00Z`;
  const comment = `Comentário ${day}`;
  return { public_id: `r${day}`, rating: 4, comment, created_at, updated_at: null };
}

describe("the lists read past their first page", () => {
  it("finds the delivery to rate on the second page of the API", async () => {
    const other = { ...mariaToRate, purchase_public_id: "compra-9" };
    const fetchMock = stubFetch(
      pageOf(purchase),
      pageResponse([other], LARGE),
      pageResponse([mariaToRate], { ...LARGE, page: 2 }),
    );
    renderWithAuth(<BuildingPurchases />, fakeAuth({ user: anaAsManager }));
    const card = await findCard("Osvaldo S. e Maria F.");

    const rate = await within(card).findByRole("group", { name: "Avalie a compra de Maria F." });

    expect(rate).toBeVisible();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/purchases/reviewable?page=2&page_size=100");
  });

  it("shows more written reviews of the farmer on the product page", async () => {
    const pages = { total: 21, total_pages: 2 };
    const firstPage = farmerReviews([20, 18, 15, 12].map(written), 4.2, 30);
    const secondPage = farmerReviews([written(5)], 4.2, 30);
    const fetchMock = stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(managerContact),
      jsonResponse({ ...firstPage, ...pages }),
      jsonResponse({ ...secondPage, ...pages, page: 2 }),
    );
    renderDetail();
    const heading = await screen.findByRole("heading", { name: "Avaliações com comentário" });
    const section = heading.closest("section")!;
    expect(within(section).queryByRole("button", { name: "Mostrar mais avaliações" })).toBeNull();

    await userEvent.click(within(section).getByRole("button", { name: "Ver todas" }));
    const more = within(section).getByRole("button", { name: "Mostrar mais avaliações" });
    await userEvent.click(more);

    expect(await within(section).findByText("Comentário 5")).toBeInTheDocument();
    expect(within(section).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("(30 avaliações)")).toBeInTheDocument();
    const nextPage = "/api/farmers/farmer-1/reviews?page=2&with_comment=true";
    expect(fetchMock.mock.calls[3][0]).toBe(nextPage);
  });
});
