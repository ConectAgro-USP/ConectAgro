import { waitFor, within } from "@testing-library/react";
import type { Sale } from "../api/sales";
import { jsonResponse, sentBody } from "../test/helpers";
import { deliveredSale, findCard, pageOf, pendingSale, press, renderSales } from "../test/sales";

const VILLAGE = "Cond. Village Vila Verde";
const DELIVER = "Marcar como entregue";
const CANCEL = "Cancelar venda";
const HINT = "Os produtos voltam para o seu estoque e o cancelamento não pode ser desfeito.";

function closedSale(status: "ENTREGUE" | "CANCELADA"): Sale {
  return { ...pendingSale, status, closed_at: "2026-11-12T15:00:00Z" };
}

describe("MySales, delivering and cancelling", () => {
  it("offers to deliver or cancel only the pending sales", async () => {
    renderSales(pageOf(pendingSale, deliveredSale));

    const pending = await findCard(VILLAGE);
    const delivered = await findCard("Edifício Jardim das Acácias");

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
      pageOf(pendingSale),
      jsonResponse({}),
      pageOf(closedSale("ENTREGUE")),
    );
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);

    expect(await within(card).findByText("Entregue")).toBeVisible();
    expect(within(card).getByRole("status")).toHaveTextContent("Venda marcada como entregue");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/purchases/compra-1/parts/me/status");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({ status: "ENTREGUE" });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/farmers/me/sales?page=1");
    expect(within(card).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
  });

  it("asks before cancelling and goes back without sending", async () => {
    const fetchMock = renderSales(pageOf(pendingSale));
    const card = await findCard(VILLAGE);

    await press(card, CANCEL);

    expect(within(card).getByText("Cancelar esta venda?")).toBeInTheDocument();
    expect(within(card).getByText(HINT)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
    const buttons = within(card).getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual([CANCEL, "Voltar", "Ver detalhes"]);
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await press(card, "Voltar");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(within(card).getByRole("button", { name: DELIVER })).toBeInTheDocument();
  });

  it("cancels the sale after the confirmation", async () => {
    const fetchMock = renderSales(
      pageOf(pendingSale),
      jsonResponse({}),
      pageOf(closedSale("CANCELADA")),
    );
    const card = await findCard(VILLAGE);
    await press(card, CANCEL);

    await press(card, CANCEL);

    expect(await within(card).findByText("Cancelada")).toBeVisible();
    expect(within(card).getByRole("status")).toHaveTextContent("Venda cancelada");
    expect(sentBody(fetchMock, 1)).toEqual({ status: "CANCELADA" });
  });

  it("blocks the buttons while the request is on its way", async () => {
    const fetchMock = renderSales(pageOf(pendingSale));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);
    await press(card, DELIVER);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(within(card).getByRole("button", { name: DELIVER })).toBeDisabled();
    expect(within(card).getByRole("button", { name: CANCEL })).toBeDisabled();
  });

  it("blocks the buttons while the sales load again", async () => {
    const fetchMock = renderSales(pageOf(pendingSale), jsonResponse({}));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(within(card).getByRole("button", { name: DELIVER })).toBeDisabled();
    expect(within(card).getByRole("button", { name: CANCEL })).toBeDisabled();
  });
});
