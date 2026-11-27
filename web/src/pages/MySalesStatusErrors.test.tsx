import { screen, waitFor, within } from "@testing-library/react";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findCard, pageOf, pendingSale, press, renderSales } from "../test/sales";
import { MySales } from "./MySales";

const VILLAGE = "Cond. Village Vila Verde";
const DELIVER = "Marcar como entregue";
const CANCEL = "Cancelar venda";
const CONFIRM = "Confirmar entrega";
const CLOSED = "Esta parte da compra já foi encerrada";

describe("MySales, refused status changes", () => {
  it("keeps the card as it was, with the reason the API refused", async () => {
    const refused = jsonResponse({ detail: CLOSED }, 409);
    const fetchMock = renderSales(pageOf(pendingSale), refused);
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);
    await press(card, CONFIRM);

    expect(await within(card).findByRole("alert")).toHaveTextContent(CLOSED);
    await waitFor(() => expect(within(card).getByRole("button", { name: CONFIRM })).toBeEnabled());
    expect(within(card).getByRole("button", { name: "Voltar" })).toBeEnabled();
    expect(within(card).getByText("A entregar")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reloads the user when the session ended before the change", async () => {
    stubFetch(pageOf(pendingSale), jsonResponse({ detail: "Não autenticado" }, 401));
    const auth = fakeAuth({ user: anaAsFarmer });
    renderWithAuth(<MySales />, auth);
    const card = await findCard(VILLAGE);

    await press(card, DELIVER);
    await press(card, CONFIRM);

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
    expect(await within(card).findByRole("alert")).toHaveTextContent("Não autenticado");
    expect(screen.queryByText("Venda marcada como entregue")).not.toBeInTheDocument();
  });

  it("forgets the refusal when going back", async () => {
    renderSales(pageOf(pendingSale), jsonResponse({}, 500));
    const card = await findCard(VILLAGE);
    await press(card, CANCEL);
    await press(card, CANCEL);
    await within(card).findByRole("alert");
    const back = within(card).getByRole("button", { name: "Voltar" });
    await waitFor(() => expect(back).toBeEnabled());

    await press(card, "Voltar");

    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: DELIVER })).toBeInTheDocument();
  });

  it("forgets the refused delivery when asking to cancel", async () => {
    renderSales(pageOf(pendingSale), jsonResponse({ detail: CLOSED }, 409));
    const card = await findCard(VILLAGE);
    await press(card, DELIVER);
    await press(card, CONFIRM);
    await within(card).findByRole("alert");
    await waitFor(() => expect(within(card).getByRole("button", { name: "Voltar" })).toBeEnabled());
    await press(card, "Voltar");

    await press(card, CANCEL);

    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(card).getByText("Cancelar esta venda?")).toBeInTheDocument();
  });
});
