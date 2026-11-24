import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deferred } from "../test/farmers";
import { jsonResponse, pageResponse } from "../test/helpers";
import { lastDelivery, OSVALDO_URL, renderReviews, savedReview } from "../test/reviews";

const created = { ...savedReview, public_id: "nova", purchase_public_id: "compra-2", rating: 5 };
const SENT = /^Avaliação enviada/;

describe("Reviews, messages after saving", () => {
  it("goes to the thanks without saying the delivery is not waiting", async () => {
    renderReviews(`${OSVALDO_URL}&nota=5`, [lastDelivery], [], jsonResponse(created, 201));
    const texts: string[] = [];
    const observer = new MutationObserver(() => texts.push(document.body.textContent ?? ""));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(SENT)).toBeVisible();
    observer.disconnect();
    expect(texts.filter((text) => text.includes("não está esperando"))).toEqual([]);
  });

  it("does not thank again when coming back from another review", async () => {
    renderReviews("/avaliar", [lastDelivery], [], jsonResponse(created, 201));
    const pending = await screen.findByRole("list", { name: "Avaliações pendentes" });
    await userEvent.click(within(pending).getByRole("link", { name: "5 estrelas" }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(SENT)).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: "Editar" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("list", { name: "Suas avaliações" })).toBeVisible();
    expect(screen.queryByText(SENT)).not.toBeInTheDocument();
  });

  it("drops the error of an old reload once the review is sent", async () => {
    const { fetchMock } = renderReviews(
      `${OSVALDO_URL}&nota=2`,
      [lastDelivery],
      [],
      jsonResponse({}, 500),
      jsonResponse({}, 500),
      jsonResponse({}, 500),
      jsonResponse(created, 201),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));

    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(SENT)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the sent review when an older reload arrives after it", async () => {
    const [reviewables, authored] = [deferred(), deferred()];
    const { fetchMock } = renderReviews(
      `${OSVALDO_URL}&nota=2`,
      [lastDelivery],
      [],
      jsonResponse({}, 500),
    );
    fetchMock
      .mockReturnValueOnce(reviewables.promise)
      .mockReturnValueOnce(authored.promise)
      .mockResolvedValueOnce(jsonResponse(created, 201));
    await userEvent.click(await screen.findByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(SENT)).toBeVisible();

    reviewables.resolve(pageResponse([lastDelivery]));
    authored.resolve(pageResponse([]));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByRole("list", { name: "Suas avaliações" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Avaliações pendentes" })).not.toBeInTheDocument();
  });
});
