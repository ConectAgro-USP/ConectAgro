import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, pageResponse } from "../test/helpers";
import { fromMaria, lastDelivery, mine, renderReviewsAnswering } from "../test/reviews";

const FIRST = { total: 21, total_pages: 2 };
const SECOND = { page: 2, total: 21, total_pages: 2 };
const ALREADY = { detail: "Você já avaliou este agricultor nesta compra" };

describe("Reviews, lists after a refused review", () => {
  it("reads both lists again from the first page", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([lastDelivery], FIRST),
      pageResponse([]),
      pageResponse([fromMaria], SECOND),
      jsonResponse(ALREADY, 409),
      pageResponse([fromMaria]),
      pageResponse([mine]),
    );
    const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });
    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais entregas" }));
    await within(pending).findByText("Maria F.");

    const osvaldo = within(pending).getByText("Osvaldo S.").closest("li")!;
    await userEvent.click(within(osvaldo).getByRole("link", { name: "5 estrelas" }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(/Ela pode já ter sido avaliada/)).toBeVisible();
    expect(fetchMock.mock.calls[4][0]).toBe("/api/purchases/reviewable?page=1");
    expect(fetchMock.mock.calls[5][0]).toBe("/api/reviews/me?page=1");
  });
});
