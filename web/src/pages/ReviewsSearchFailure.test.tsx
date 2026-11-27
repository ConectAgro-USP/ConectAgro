import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthoredReview } from "../api/reviews";
import { jsonResponse, pageResponse } from "../test/helpers";
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
const NOT_FOUND = "Não encontramos esta avaliação entre as suas.";
const failure = () => jsonResponse({ detail: "Erro interno" }, 500);

describe("Reviews, the search of a later page fails", () => {
  it("shows the error, not that the delivery is not waiting", async () => {
    const { fetchMock } = renderReviewsAnswering(
      `${OSVALDO_URL}&nota=4`,
      pageResponse([fromMaria], FIRST),
      pageResponse([]),
      failure(),
      pageResponse([lastDelivery], SECOND),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno");
    expect(screen.queryByText(/não está esperando sua avaliação/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("button", { name: "Enviar" })).toBeInTheDocument();
    expect(title()).toHaveTextContent("Avaliar agricultor");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/purchases/reviewable?page=2");
  });

  it("shows the error, not that the review was not found", async () => {
    const { fetchMock } = renderReviewsAnswering(
      "/avaliar?editar=avaliacao-2",
      pageResponse([]),
      pageResponse([mine], FIRST),
      failure(),
      pageResponse([older], SECOND),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno");
    expect(screen.queryByText(NOT_FOUND)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(title()).toHaveTextContent("Editar avaliação");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/reviews/me?page=2");
  });
});
