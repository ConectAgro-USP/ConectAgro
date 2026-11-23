import { waitFor, within } from "@testing-library/react";
import type { Reviewable } from "../api/reviews";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import {
  findCard,
  mariaPart,
  pageOf,
  purchase,
  renderPurchases,
  renderRating,
} from "../test/purchases";
import { BuildingPurchases } from "./BuildingPurchases";

const mariaToRate: Reviewable = {
  purchase_public_id: "compra-1",
  farmer_public_id: "agricultor-2",
  farmer_short_name: "Maria F.",
  delivered_at: "2026-11-11T15:00:00Z",
  product_names: ["Tomate"],
};

describe("BuildingPurchases, rating the deliveries", () => {
  it("asks which deliveries the manager can still rate", async () => {
    const fetchMock = renderPurchases(pageOf(purchase));

    await findCard("Osvaldo S. e Maria F.");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/purchases/reviewable");
  });

  it("invites to rate the delivered part still without a rating, without opening it", async () => {
    renderRating(pageOf(purchase), [mariaToRate]);
    const card = await findCard("Osvaldo S. e Maria F.");

    const rate = await within(card).findByRole("group", { name: "Avalie a compra de Maria F." });
    expect(rate).toBeVisible();
    expect(within(rate).getByRole("link", { name: "4 estrelas" })).toHaveAttribute(
      "href",
      "/avaliar?compra=compra-1&agricultor=agricultor-2&nota=4",
    );
    // a parte do Osvaldo ainda está a caminho
    expect(within(card).getAllByRole("group")).toHaveLength(1);
  });

  it("just says to rate the purchase when it has a single farmer", async () => {
    const onlyMaria = { ...purchase, status: "ENTREGUE" as const, purchase_parts: [mariaPart] };
    renderRating(pageOf(onlyMaria), [mariaToRate]);

    const card = await findCard("Maria F.");

    expect(await within(card).findByRole("group", { name: "Avalie a compra" })).toBeVisible();
  });

  it("leaves the stars out of purchases already rated or of other buildings", async () => {
    const elsewhere = { ...mariaToRate, purchase_public_id: "compra-9" };
    renderRating(pageOf(purchase), [elsewhere]);

    const card = await findCard("Osvaldo S. e Maria F.");

    expect(within(card).queryByRole("group")).not.toBeInTheDocument();
  });

  it("keeps the history when the deliveries to rate do not load", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(pageOf(purchase), jsonResponse({}, 500));
    renderWithAuth(<BuildingPurchases />, fakeAuth({ user: anaAsManager }));

    const card = await findCard("Osvaldo S. e Maria F.");

    await waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
    expect(within(card).queryByRole("group")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
