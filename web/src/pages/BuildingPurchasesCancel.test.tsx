import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BuildingPurchase } from "../api/purchases";
import { jsonResponse } from "../test/helpers";
import {
  findCard,
  openPurchase,
  osvaldoPart,
  pageOf,
  purchase,
  renderPurchases,
} from "../test/purchases";

const CANCEL = "Cancelar compra";
const DELIVER = "Marcar como entregue";
const HINT = "Os agricultores não fazem mais a entrega e o cancelamento não pode ser desfeito.";
const DELIVERED = "A compra não pode ser cancelada depois que uma parte foi entregue";

function closedPurchase(status: "ENTREGUE" | "CANCELADA"): BuildingPurchase {
  const closed_at = "2026-11-12T15:00:00Z";
  const part = { ...osvaldoPart, status, closed_at };
  return { ...openPurchase, status, closed_at, purchase_parts: [part] };
}

function press(card: HTMLElement, button: string) {
  return userEvent.click(within(card).getByRole("button", { name: button }));
}

describe("BuildingPurchases, cancelling a purchase", () => {
  it("offers to cancel only a purchase with nothing delivered", async () => {
    renderPurchases(pageOf(purchase, openPurchase));

    const undelivered = await findCard("Osvaldo S.");
    const partlyDelivered = await findCard("Osvaldo S. e Maria F.");

    expect(within(undelivered).getByRole("button", { name: CANCEL })).toHaveAccessibleDescription(
      "Osvaldo S.",
    );
    expect(within(undelivered).queryByRole("button", { name: DELIVER })).not.toBeInTheDocument();
    expect(within(partlyDelivered).queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
  });

  it("cancels the purchase after the confirmation and loads the purchases again", async () => {
    const fetchMock = renderPurchases(
      pageOf(openPurchase),
      jsonResponse({}),
      pageOf(closedPurchase("CANCELADA")),
    );
    const card = await findCard("Osvaldo S.");
    await press(card, CANCEL);
    expect(within(card).getByText("Cancelar esta compra?")).toBeInTheDocument();
    expect(within(card).getByText(HINT)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();

    await press(card, CANCEL);

    expect(await within(card).findByText("Cancelada")).toBeVisible();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/purchases/compra-2/cancel");
    expect(fetchMock.mock.calls[2][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/apartments/me/purchases?page=1");
    expect(within(card).queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
  });

  it("keeps the reason the API refused after the purchases load again", async () => {
    const refused = jsonResponse({ detail: DELIVERED }, 409);
    renderPurchases(pageOf(openPurchase), refused, pageOf(closedPurchase("ENTREGUE")));
    const card = await findCard("Osvaldo S.");
    await press(card, CANCEL);

    await press(card, CANCEL);

    expect(await within(card).findByText("Entregue")).toBeVisible();
    expect(within(card).getByRole("alert")).toHaveTextContent(DELIVERED);
    expect(within(card).queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });
});
