import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Sale } from "../api/sales";
import { jsonResponse, sentBody } from "../test/helpers";
import { deliveredSale, findSale, pendingSale, renderSales, salesPage } from "../test/sales";

const VILLAGE = "Cond. Village Vila Verde";
const DELIVER = "Marcar como entregue";
const CANCEL = "Cancelar venda";
const HINT = "Os produtos voltam para o seu estoque e o cancelamento não pode ser desfeito.";
const CLOSED = "Esta parte da compra já foi encerrada";

function closedSale(status: "ENTREGUE" | "CANCELADA"): Sale {
  return { ...pendingSale, status, closed_at: "2026-11-12T15:00:00Z" };
}

function press(card: HTMLElement, button: string) {
  return userEvent.click(within(card).getByRole("button", { name: button }));
}

describe("MySales, delivering and cancelling", () => {
  it("offers to deliver or cancel only the pending sales", async () => {
    renderSales(salesPage(pendingSale, deliveredSale));

    const pending = await findSale(VILLAGE);
    const delivered = await findSale("Edifício Jardim das Acácias");

    expect(within(pending).getByRole("button", { name: DELIVER })).toHaveAccessibleDescription(
      VILLAGE,
    );
    expect(within(pending).getByRole("button", { name: CANCEL })).toHaveAccessibleDescription(
      VILLAGE,
    );
    expect(within(delivered).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
    expect(within(delivered).queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
  });

  it("marks the sale as delivered and loads the sales again", async () => {
    const fetchMock = renderSales(
      salesPage(pendingSale),
      jsonResponse({}),
      salesPage(closedSale("ENTREGUE")),
    );
    const card = await findSale(VILLAGE);

    await press(card, DELIVER);

    expect(await within(card).findByText("Entregue")).toBeVisible();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/purchases/compra-1/parts/me/status");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({ status: "ENTREGUE" });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/farmers/me/sales?page=1");
    expect(within(card).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
  });

  it("asks before cancelling and goes back without sending", async () => {
    const fetchMock = renderSales(salesPage(pendingSale));
    const card = await findSale(VILLAGE);

    await press(card, CANCEL);

    expect(within(card).getByText("Cancelar esta venda?")).toBeInTheDocument();
    expect(within(card).getByText(HINT)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await press(card, "Voltar");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(within(card).getByRole("button", { name: DELIVER })).toBeInTheDocument();
  });

  it("cancels the sale after the confirmation", async () => {
    const fetchMock = renderSales(
      salesPage(pendingSale),
      jsonResponse({}),
      salesPage(closedSale("CANCELADA")),
    );
    const card = await findSale(VILLAGE);
    await press(card, CANCEL);

    await press(card, CANCEL);

    expect(await within(card).findByText("Cancelada")).toBeVisible();
    expect(sentBody(fetchMock, 1)).toEqual({ status: "CANCELADA" });
  });

  it("keeps the reason the API refused after the sales load again", async () => {
    const refused = jsonResponse({ detail: CLOSED }, 409);
    renderSales(salesPage(pendingSale), refused, salesPage(closedSale("CANCELADA")));
    const card = await findSale(VILLAGE);

    await press(card, DELIVER);

    expect(await within(card).findByText("Cancelada")).toBeVisible();
    expect(within(card).getByRole("alert")).toHaveTextContent(CLOSED);
    expect(within(card).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
  });

  it("forgets the refusal when going back", async () => {
    renderSales(salesPage(pendingSale), jsonResponse({}, 500), salesPage(pendingSale));
    const card = await findSale(VILLAGE);
    await press(card, CANCEL);
    await press(card, CANCEL);
    await within(card).findByRole("alert");
    const back = within(card).getByRole("button", { name: "Voltar" });
    await waitFor(() => expect(back).toBeEnabled());

    await press(card, "Voltar");

    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: DELIVER })).toBeInTheDocument();
  });

  it("blocks the buttons while the sales load again", async () => {
    const fetchMock = renderSales(salesPage(pendingSale), jsonResponse({}));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const card = await findSale(VILLAGE);

    await press(card, DELIVER);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(within(card).getByRole("button", { name: DELIVER })).toBeDisabled();
    expect(within(card).getByRole("button", { name: CANCEL })).toBeDisabled();
  });
});
