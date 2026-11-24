import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findCard, interestsResponse, laranja, mandioca, renderInterests } from "../test/interests";
import { press } from "../test/products";
import { MyInterests } from "./MyInterests";

const NOT_FOUND = "Interesse não encontrado";
const FAILURE = "Algo deu errado";
const QUESTION = "Remover o interesse em Mandioca?";

describe("MyInterests, removal", () => {
  it("asks inside the card before removing an interest", async () => {
    const fetchMock = renderInterests(interestsResponse([mandioca]));
    const card = await findCard("Mandioca");

    await press(card, "Remover");

    expect(within(card).getByText(QUESTION)).toBeInTheDocument();
    expect(card).toHaveTextContent("O síndico deixa de contar a sua quantidade");
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("focuses Voltar without scrolling the page under the finger", async () => {
    renderInterests(interestsResponse([mandioca]));
    const card = await findCard("Mandioca");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");

    await press(card, "Remover");
    const lastFocus = focus.mock.lastCall;
    focus.mockRestore();

    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(lastFocus).toEqual([{ preventScroll: true }]);
  });

  it("removes only the confirmed interest", async () => {
    const removed = new Response(null, { status: 204 });
    const fetchMock = renderInterests(interestsResponse([laranja, mandioca]), removed);
    const card = await findCard("Mandioca");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(card).not.toBeInTheDocument());
    expect(await findCard("Laranja")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/interests/interesse-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
  });

  it("sends one removal while it is pending", async () => {
    const fetchMock = renderInterests(interestsResponse([mandioca]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const card = await findCard("Mandioca");
    await press(card, "Remover");

    await userEvent.dblClick(within(card).getByRole("button", { name: "Remover" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(within(card).getByRole("button", { name: "Voltar" })).toBeDisabled();
  });

  it("removes an interest in an unavailable product too", async () => {
    renderInterests(interestsResponse([laranja]), new Response(null, { status: 204 }));
    const card = await findCard("Laranja");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(card).not.toBeInTheDocument());
  });

  it("drops the card when another tab already removed the interest", async () => {
    renderInterests(interestsResponse([mandioca]), jsonResponse({ detail: NOT_FOUND }, 404));
    const card = await findCard("Mandioca");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(card).not.toBeInTheDocument());
  });

  it("reloads the user when the session ended before the removal", async () => {
    stubFetch(interestsResponse([mandioca]), jsonResponse({ detail: "Não autenticado" }, 401));
    const auth = fakeAuth({ user: anaAsBuyer("APROVADO") });
    renderWithAuth(<MyInterests />, auth);
    const card = await findCard("Mandioca");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("keeps the confirmation and shows why the removal failed", async () => {
    renderInterests(interestsResponse([mandioca]), jsonResponse({}, 500));
    const card = await findCard("Mandioca");
    await press(card, "Remover");

    await press(card, "Remover");

    expect(await within(card).findByRole("alert")).toHaveTextContent(FAILURE);
    expect(within(card).getByText(QUESTION)).toBeInTheDocument();
  });

  it("goes back without removing and forgets the refusal", async () => {
    const fetchMock = renderInterests(interestsResponse([mandioca]), jsonResponse({}, 500));
    const card = await findCard("Mandioca");
    await press(card, "Remover");
    await press(card, "Remover");
    await within(card).findByRole("alert");

    await press(card, "Voltar");
    expect(within(card).getByLabelText("Quantidade (kg)")).toHaveValue("5");
    await press(card, "Remover");

    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
