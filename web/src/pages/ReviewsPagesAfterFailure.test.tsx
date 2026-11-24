import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthoredReview } from "../api/reviews";
import { jsonResponse, pageResponse } from "../test/helpers";
import {
  fromMaria,
  lastDelivery,
  mine,
  renderReviewsAnswering,
  savedReview,
} from "../test/reviews";

const FIRST = { total: 21, total_pages: 2 };
const SECOND = { page: 2, total: 21, total_pages: 2 };
const FAILED = jsonResponse({ detail: "Algo deu errado no servidor" }, 500);
const MORE_DELIVERIES = { name: "Mostrar mais entregas" };
const MORE_REVIEWS = { name: "Mostrar mais avaliações" };
const older: AuthoredReview = { ...mine, public_id: "avaliacao-2", farmer_short_name: "Maria F." };
const created = { ...savedReview, public_id: "nova", purchase_public_id: "compra-2", rating: 5 };

describe("Reviews, more pages after a failed one", () => {
  it("asks again for the page that failed once a review is edited", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([]),
      pageResponse([mine], FIRST),
      FAILED,
      jsonResponse({ ...savedReview, rating: 2 }),
      pageResponse([older], SECOND),
    );
    await screen.findByRole("list", { name: "Suas avaliações" });
    await userEvent.click(screen.getByRole("button", MORE_REVIEWS));
    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado no servidor");

    await userEvent.click(screen.getByRole("link", { name: "Editar" }));
    await userEvent.click(screen.getByRole("radio", { name: "2 estrelas, Ruim" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText("Avaliação atualizada.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", MORE_REVIEWS));

    const authored = screen.getByRole("list", { name: "Suas avaliações" });
    expect(await within(authored).findByText("Maria F.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][0]).toBe("/api/reviews/me?page=2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("catches up from the last page on screen after a review", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([lastDelivery], FIRST),
      pageResponse([]),
      FAILED,
      jsonResponse(created, 201),
      pageResponse([fromMaria], { total: 20, total_pages: 1 }),
    );
    const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });
    await userEvent.click(screen.getByRole("button", MORE_DELIVERIES));
    await screen.findByRole("alert");

    await userEvent.click(within(pending).getByRole("link", { name: "5 estrelas" }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText(/^Avaliação enviada/);
    await userEvent.click(screen.getByRole("button", MORE_DELIVERIES));

    const list = screen.getByRole("list", { name: "Avaliações pendentes" });
    expect(await within(list).findByText("Maria F.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][0]).toBe("/api/purchases/reviewable?page=1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
