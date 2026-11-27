import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthoredReview } from "../api/reviews";
import { pageResponse } from "../test/helpers";
import {
  fromMaria,
  lastDelivery,
  mine,
  OSVALDO_URL,
  renderReviewsAnswering,
  title,
} from "../test/reviews";

const FIRST = { total: 21, total_pages: 2 };
const SECOND = { page: 2, total: 21, total_pages: 2 };
const older: AuthoredReview = { ...mine, public_id: "avaliacao-2", farmer_short_name: "Maria F." };

describe("Reviews, pages", () => {
  it("shows more deliveries waiting for a rating", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([fromMaria], FIRST),
      pageResponse([]),
      pageResponse([lastDelivery], SECOND),
    );
    const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais entregas" }));

    expect(await within(pending).findByText("Osvaldo S.")).toBeInTheDocument();
    expect(within(pending).getByText("Maria F.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/purchases/reviewable?page=2");
    expect(screen.queryByRole("button", { name: "Mostrar mais entregas" })).toBeNull();
  });

  it("shows more of the reviews already written", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar",
      pageResponse([]),
      pageResponse([mine], FIRST),
      pageResponse([older], SECOND),
    );
    const authored = await screen.findByRole("list", { name: "Suas avaliações" });

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais avaliações" }));

    expect(await within(authored).findByText("Maria F.")).toBeInTheDocument();
    expect(within(authored).getByText("Osvaldo S.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/reviews/me?page=2");
  });

  it("finds a delivery on a later page when the link opens its rating", async () => {
    const { fetchMock } = renderReviewsAnswering(
      `${OSVALDO_URL}&nota=4`,
      pageResponse([fromMaria], FIRST),
      pageResponse([]),
      pageResponse([lastDelivery], SECOND),
    );

    expect(await screen.findByRole("button", { name: "Enviar" })).toBeInTheDocument();
    expect(title()).toHaveTextContent("Avaliar agricultor");
    expect(screen.getByText("Osvaldo S.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/purchases/reviewable?page=2");
  });

  it("finds a review on a later page when the link opens its edit", async () => {
    renderReviewsAnswering(
      "/avaliar?editar=avaliacao-2",
      pageResponse([]),
      pageResponse([mine], FIRST),
      pageResponse([older], SECOND),
    );

    expect(await screen.findByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(title()).toHaveTextContent("Editar avaliação");
    expect(screen.getByText("Maria F.")).toBeInTheDocument();
  });

  it("says the delivery is not waiting only after reading every page", async () => {
    renderReviewsAnswering(
      `${OSVALDO_URL}&nota=4`,
      pageResponse([fromMaria], FIRST),
      pageResponse([]),
      pageResponse([], SECOND),
    );

    expect(await screen.findByText(/não está esperando sua avaliação/)).toBeInTheDocument();
  });
});
