import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, pageResponse } from "../test/helpers";
import {
  fromMaria,
  lastDelivery,
  mine,
  renderReviews,
  renderReviewsAnswering,
} from "../test/reviews";

function list(name: string): Promise<HTMLElement> {
  return screen.findByRole("list", { name });
}

describe("Reviews", () => {
  it("asks for the deliveries to rate and the reviews already made", async () => {
    const { fetchMock } = renderReviews("/avaliar", [], []);

    expect(screen.getByRole("heading", { level: 1, name: "Avaliações" })).toBeInTheDocument();
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma entrega esperando sua avaliação/)).toBeVisible();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/purchases/reviewable?page=1",
      "/api/reviews/me?page=1",
    ]);
  });

  it("lists the deliveries waiting for a rating, with when they came and what came", async () => {
    renderReviews("/avaliar", [lastDelivery, fromMaria], []);

    const [osvaldo, maria] = within(await list("Avaliações pendentes")).getAllByRole("listitem");
    expect(within(osvaldo).getByRole("heading", { name: "Osvaldo S." })).toBeVisible();
    expect(osvaldo).toHaveTextContent("Mandioca e Alface");
    expect(osvaldo).toHaveTextContent(/Entregue em\s*19\/11/);
    expect(within(maria).getByRole("heading", { name: "Maria F." })).toBeVisible();
    const rate = within(osvaldo).getByRole("group", { name: "Avalie a compra" });
    expect(within(rate).getAllByRole("link")).toHaveLength(5);
    expect(within(rate).getByRole("link", { name: "1 estrela" })).toHaveAttribute(
      "href",
      "/avaliar?compra=compra-2&agricultor=agricultor-1&nota=1",
    );
  });

  it("lists the reviews already made, each with a link to edit it", async () => {
    renderReviews("/avaliar", [], [mine]);

    const [review] = within(await list("Suas avaliações")).getAllByRole("listitem");
    expect(within(review).getByRole("heading", { name: "Osvaldo S." })).toBeVisible();
    expect(within(review).getByText("Nota 4 de 5")).toBeInTheDocument();
    expect(review).toHaveTextContent("Boa mandioca");
    expect(review).toHaveTextContent(/Feita em\s*20\/10\/2026/);
    const edit = within(review).getByRole("link", { name: "Editar" });
    expect(edit).toHaveAttribute("href", "/avaliar?editar=avaliacao-1");
    // com várias avaliações, o leitor de tela ouve de qual é cada link
    expect(edit).toHaveAccessibleDescription("Osvaldo S. Feita em 20/10/2026");
    expect(screen.getByText(/Nenhuma entrega esperando sua avaliação/)).toBeVisible();
  });

  it("tells when a review was edited", async () => {
    renderReviews("/avaliar", [], [{ ...mine, updated_at: "2026-11-16T14:00:00Z" }]);

    const [review] = within(await list("Suas avaliações")).getAllByRole("listitem");

    expect(review).toHaveTextContent(/Feita em 20\/10\/2026 · editada em 16\/11\/2026/);
  });

  it("explains when the person has not rated anything yet", async () => {
    renderReviews("/avaliar", [lastDelivery], []);

    expect(await screen.findByText("Você ainda não avaliou nenhuma entrega.")).toBeVisible();
  });

  it("names the farmer whose account has no name", async () => {
    renderReviews("/avaliar", [{ ...lastDelivery, farmer_short_name: "" }], []);

    const [delivery] = within(await list("Avaliações pendentes")).getAllByRole("listitem");

    expect(within(delivery).getByRole("heading", { name: "Agricultor" })).toBeVisible();
  });

  it("shows the error and tries again", async () => {
    renderReviewsAnswering(
      "/avaliar",
      jsonResponse({}, 500),
      pageResponse([]),
      pageResponse([lastDelivery]),
      pageResponse([]),
    );

    expect(await screen.findByRole("alert")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await list("Avaliações pendentes")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("checks the session again when the API no longer recognizes the person", async () => {
    const { auth } = renderReviewsAnswering(
      "/avaliar",
      jsonResponse({ detail: "Não autenticado" }, 401),
      pageResponse([]),
    );

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(auth.refreshUser).toHaveBeenCalledOnce();
  });
});
