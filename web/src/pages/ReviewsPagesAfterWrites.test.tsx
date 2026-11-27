import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Reviewable } from "../api/reviews";
import { jsonResponse, pageResponse } from "../test/helpers";
import {
  fromMaria,
  lastDelivery,
  renderReviewsAnswering,
  savedReview,
} from "../test/reviews";

const MORE = { name: "Mostrar mais entregas" };
const created = { ...savedReview, public_id: "nova", purchase_public_id: "compra-2", rating: 5 };
const fromJose: Reviewable = {
  ...fromMaria,
  purchase_public_id: "compra-4",
  farmer_public_id: "agricultor-3",
  farmer_short_name: "José P.",
};
// 21 entregas em duas páginas, e uma delas recebe a avaliação
const BEFORE = { total: 21, total_pages: 2 };
const AFTER = { total: 20, total_pages: 1 };

describe("Reviews, pages after a write", () => {
  it("asks for the first page again after a review, so no delivery is skipped", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([lastDelivery, fromMaria], BEFORE),
      pageResponse([]),
      jsonResponse(created, 201),
      pageResponse([fromMaria, fromJose], AFTER),
    );
    const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });
    await userEvent.click(within(pending).getAllByRole("link", { name: "5 estrelas" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText(/^Avaliação enviada/);

    await userEvent.click(screen.getByRole("button", MORE));

    const list = screen.getByRole("list", { name: "Avaliações pendentes" });
    expect(await within(list).findByText("José P.")).toBeInTheDocument();
    expect(within(list).getAllByText("Maria F.")).toHaveLength(1);
    expect(within(list).queryByText("Osvaldo S.")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe("/api/purchases/reviewable?page=1");
    expect(screen.queryByRole("button", MORE)).not.toBeInTheDocument();
  });

  it("says why more deliveries failed to load and tries again", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([fromMaria], BEFORE),
      pageResponse([]),
      jsonResponse({ detail: "Algo deu errado no servidor" }, 500),
      pageResponse([fromJose], { ...BEFORE, page: 2 }),
      pageResponse([]),
    );
    await screen.findByRole("list", { name: "Avaliações pendentes" });
    await userEvent.click(screen.getByRole("button", MORE));

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado no servidor");
    expect(screen.getByText("Maria F.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("José P.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe("/api/purchases/reviewable?page=2");
  });
});
