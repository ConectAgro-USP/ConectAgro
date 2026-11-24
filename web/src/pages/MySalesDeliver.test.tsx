import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { findCard, pageOf, pendingSale, press, renderSales } from "../test/sales";

const VILLAGE = "Cond. Village Vila Verde";
const DELIVER = "Marcar como entregue";
const CONFIRM = "Confirmar entrega";
const QUESTION = "Marcar esta venda como entregue?";
const HINT = "A entrega não pode ser desfeita. Depois dela o prédio pode avaliar você.";

describe("MySales, confirming the delivery", () => {
  it("asks before marking the sale as delivered", async () => {
    const fetchMock = renderSales(pageOf(pendingSale));
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);

    expect(within(card).getByText(QUESTION)).toBeInTheDocument();
    expect(within(card).getByText(HINT)).toBeInTheDocument();
    const buttons = within(card).getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["Voltar", CONFIRM, "Ver detalhes"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("confirms with the main button, not the danger one", async () => {
    renderSales(pageOf(pendingSale));
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);

    const confirm = within(card).getByRole("button", { name: CONFIRM });
    expect(confirm).toHaveClass("bg-lime-800");
    expect(confirm).not.toHaveClass("bg-red-700");
    expect(confirm).toHaveAccessibleDescription(VILLAGE);
  });

  it("focuses Voltar without scrolling the page under the finger", async () => {
    renderSales(pageOf(pendingSale));
    const card = await findCard(VILLAGE);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");

    await press(card, DELIVER);
    const lastFocus = focus.mock.lastCall;
    focus.mockRestore();

    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(lastFocus).toEqual([{ preventScroll: true }]);
  });

  it("goes back without sending anything", async () => {
    const fetchMock = renderSales(pageOf(pendingSale));
    const card = await findCard(VILLAGE);
    await press(card, DELIVER);

    await press(card, "Voltar");

    expect(within(card).queryByText(QUESTION)).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: DELIVER })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends nothing on a double tap over Marcar como entregue", async () => {
    const fetchMock = renderSales(pageOf(pendingSale));
    const card = await findCard(VILLAGE);

    await userEvent.dblClick(within(card).getByRole("button", { name: DELIVER }));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(within(card).getByText(QUESTION)).toBeInTheDocument();
  });

  it("keeps the other sales as they were", async () => {
    const other = { ...pendingSale, purchase_public_id: "compra-3", building_name: "Ed. Ipê" };
    renderSales(pageOf(pendingSale, other));
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);

    const untouched = await findCard("Ed. Ipê");
    expect(within(untouched).getByRole("button", { name: DELIVER })).toBeInTheDocument();
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
  });
});
