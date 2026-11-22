import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { lastDelivery, mine, OSVALDO_URL, renderReviews, title } from "../test/reviews";

describe("Reviews form, unavailable or failing", () => {
  it("explains a delivery that is not waiting for a rating", async () => {
    renderReviews("/avaliar?compra=compra-9&agricultor=agricultor-1&nota=4", [lastDelivery], []);

    expect(await screen.findByText(/Esta entrega não está esperando sua avaliação/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver avaliações" })).toHaveAttribute("href", "/avaliar");
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });

  it("explains a review that is not among the person's", async () => {
    renderReviews("/avaliar?editar=de-outra-pessoa", [], [mine]);

    expect(await screen.findByText("Não encontramos esta avaliação entre as suas.")).toBeVisible();
  });

  it("keeps the form with the message when sending fails", async () => {
    const { fetchMock } = renderReviews(
      `${OSVALDO_URL}&nota=2`,
      [lastDelivery],
      [],
      jsonResponse({}, 500),
      jsonResponse([lastDelivery]),
      jsonResponse([]),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(screen.getByRole("radio", { name: "2 estrelas, Ruim" })).toBeChecked();
    expect(title()).toHaveTextContent("Avaliar agricultor");
  });

  it("explains, after the lists reload, a delivery rated in another tab", async () => {
    const already = jsonResponse({ detail: "Você já avaliou este agricultor nesta compra" }, 409);
    renderReviews(
      `${OSVALDO_URL}&nota=2`,
      [lastDelivery],
      [],
      already,
      jsonResponse([]),
      jsonResponse([mine]),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(/Ela pode já ter sido avaliada/)).toBeVisible();
  });
});
