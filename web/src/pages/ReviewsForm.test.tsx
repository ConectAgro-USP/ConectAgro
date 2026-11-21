import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import { fromMaria, lastDelivery, mine, renderReviews, savedReview } from "../test/reviews";

const OSVALDO_URL = "/avaliar?compra=compra-2&agricultor=agricultor-1";

function title(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

async function chooseStar(rating: number) {
  const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });
  const [osvaldo] = within(pending).getAllByRole("listitem");
  const name = rating === 1 ? "1 estrela" : `${rating} estrelas`;
  await userEvent.click(within(osvaldo).getByRole("link", { name }));
}

function press(name: string) {
  return userEvent.click(screen.getByRole("button", { name }));
}

describe("Reviews form", () => {
  it("opens with the star chosen in the list and the delivery being rated", async () => {
    renderReviews("/avaliar", [lastDelivery], []);

    await chooseStar(4);

    expect(title()).toHaveTextContent("Avaliar agricultor");
    expect(screen.getByRole("heading", { name: "Osvaldo S." })).toHaveFocus();
    expect(screen.getByText("Entregue em 19/11 · Mandioca e Alface")).toBeVisible();
    expect(screen.getByRole("radio", { name: "4 estrelas, Bom" })).toBeChecked();
    expect(screen.getByRole("link", { name: "Voltar às avaliações" })).toHaveAttribute(
      "href",
      "/avaliar",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("sends the review and goes back to the list with thanks", async () => {
    const created = { ...savedReview, public_id: "nova", purchase_public_id: "compra-2" };
    const { fetchMock } = renderReviews(
      "/avaliar",
      [lastDelivery, fromMaria],
      [],
      jsonResponse({ ...created, rating: 5, comment: "Chegou fresquinho" }, 201),
    );
    await chooseStar(5);
    await userEvent.type(screen.getByLabelText("Comentário (opcional)"), "Chegou fresquinho");

    await press("Enviar");

    expect(await screen.findByText(/^Avaliação enviada/)).toBeVisible();
    expect(title()).toHaveTextContent("Avaliações");
    const pending = screen.getByRole("list", { name: "Avaliações pendentes" });
    expect(within(pending).getAllByRole("listitem")).toHaveLength(1);
    expect(within(pending).queryByText("Osvaldo S.")).not.toBeInTheDocument();
    const [review] = within(screen.getByRole("list", { name: "Suas avaliações" })).getAllByRole(
      "listitem",
    );
    expect(within(review).getByRole("img", { name: "Nota 5 de 5" })).toBeInTheDocument();
    expect(review).toHaveTextContent("Chegou fresquinho");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/purchases/compra-2/farmers/agricultor-1/reviews");
    expect(fetchMock.mock.calls[2][1]?.method).toBe("POST");
    expect(sentBody(fetchMock, 2)).toEqual({ rating: 5, comment: "Chegou fresquinho" });
  });

  it("edits a review with what it already says", async () => {
    const edited = { ...savedReview, rating: 2, comment: "Veio murcha" };
    const { fetchMock } = renderReviews(
      "/avaliar",
      [],
      [mine],
      jsonResponse({ ...edited, updated_at: "2026-11-16T14:00:00Z" }),
    );
    await userEvent.click(await screen.findByRole("link", { name: "Editar" }));

    expect(title()).toHaveTextContent("Editar avaliação");
    expect(screen.getByText("Avaliação feita em 20/10/2026")).toBeVisible();
    expect(screen.getByRole("radio", { name: "4 estrelas, Bom" })).toBeChecked();
    const comment = screen.getByLabelText("Comentário (opcional)");
    expect(comment).toHaveValue("Boa mandioca");
    await userEvent.click(screen.getByRole("radio", { name: "2 estrelas, Ruim" }));
    await userEvent.clear(comment);
    await userEvent.type(comment, "Veio murcha");
    await press("Salvar");

    expect(await screen.findByText("Avaliação atualizada.")).toBeVisible();
    const [review] = within(screen.getByRole("list", { name: "Suas avaliações" })).getAllByRole(
      "listitem",
    );
    expect(within(review).getByRole("img", { name: "Nota 2 de 5" })).toBeInTheDocument();
    expect(review).toHaveTextContent(/Veio murcha.*editada em 16\/11\/2026/);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/reviews/avaliacao-1");
    expect(fetchMock.mock.calls[2][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 2)).toEqual({ rating: 2, comment: "Veio murcha" });
  });

  it("goes back to the list without sending when cancelled", async () => {
    const { fetchMock } = renderReviews("/avaliar", [lastDelivery], []);
    await chooseStar(3);

    await press("Cancelar");

    expect(await screen.findByRole("list", { name: "Avaliações pendentes" })).toBeVisible();
    expect(title()).toHaveTextContent("Avaliações");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opened straight from its address, cancels to the list", async () => {
    renderReviews(`${OSVALDO_URL}&nota=5`, [lastDelivery], []);

    expect(await screen.findByRole("radio", { name: "5 estrelas, Incrível" })).toBeChecked();
    await press("Cancelar");

    expect(await screen.findByRole("list", { name: "Avaliações pendentes" })).toBeVisible();
  });

  it("lets the person choose when the address has no valid rating", async () => {
    renderReviews(`${OSVALDO_URL}&nota=9`, [lastDelivery], []);

    expect(await screen.findByRole("group", { name: "Sua nota" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

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
