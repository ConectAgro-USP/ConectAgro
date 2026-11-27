import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, pageResponse } from "../test/helpers";
import {
  comment,
  fromMaria,
  lastDelivery,
  renderReviewsAnswering,
  send,
} from "../test/reviews";

const FIRST = { total: 21, total_pages: 2 };
const SECOND = { page: 2, total: 21, total_pages: 2 };
const ALREADY = { detail: "Você já avaliou este agricultor nesta compra" };

function renderSecondPage(refusal: Response, ...more: Response[]) {
  return renderReviewsAnswering(
    "/avaliar",
    pageResponse([lastDelivery], FIRST),
    pageResponse([]),
    pageResponse([fromMaria], SECOND),
    refusal,
    ...more,
  );
}

async function rateMaria() {
  const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });
  await userEvent.click(screen.getByRole("button", { name: "Mostrar mais entregas" }));
  const maria = (await within(pending).findByText("Maria F.")).closest("li")!;
  await userEvent.click(within(maria).getByRole("link", { name: "5 estrelas" }));
  await userEvent.type(comment(), "Laranja doce");
  await send();
}

describe("Reviews, refused review of a delivery from the second page", () => {
  it("keeps the typed comment and the error when the server fails", async () => {
    const { fetchMock } = renderSecondPage(jsonResponse({}, 500));

    await rateMaria();

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(comment()).toHaveValue("Laranja doce");
    expect(screen.getByRole("heading", { name: "Maria F." })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("still reads both lists from the first page after a conflict", async () => {
    const { fetchMock } = renderSecondPage(
      jsonResponse(ALREADY, 409),
      pageResponse([lastDelivery], FIRST),
      pageResponse([]),
      pageResponse([], SECOND),
    );

    await rateMaria();

    expect(await screen.findByText(/Ela pode já ter sido avaliada/)).toBeVisible();
    expect(fetchMock.mock.calls[4][0]).toBe("/api/purchases/reviewable?page=1");
    expect(fetchMock.mock.calls[5][0]).toBe("/api/reviews/me?page=1");
    expect(fetchMock.mock.calls[6][0]).toBe("/api/purchases/reviewable?page=2");
  });
});
