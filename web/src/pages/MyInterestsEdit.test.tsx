import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  anaAsBuyer,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  sentBody,
  stubFetch,
} from "../test/helpers";
import { findCard, interestsResponse, laranja, mandioca, renderInterests } from "../test/interests";
import { MyInterests } from "./MyInterests";

const QUANTITY = "Quantidade (kg)";
const AT_LEAST_ONE = "Informe uma quantidade de pelo menos 1 kg";

async function type(card: HTMLElement, value: string): Promise<HTMLElement> {
  const field = within(card).getByLabelText(QUANTITY);
  await userEvent.clear(field);
  if (value) await userEvent.type(field, value);
  return field;
}

function saveButton(card: HTMLElement): HTMLElement {
  return within(card).getByRole("button", { name: "Salvar" });
}

describe("MyInterests, quantity", () => {
  it("saves a new quantity", async () => {
    const saved = { ...mandioca, quantity: 8 };
    const fetchMock = renderInterests(interestsResponse([laranja, mandioca]), jsonResponse(saved));
    const card = await findCard("Mandioca");
    expect(within(card).getByLabelText(QUANTITY)).toHaveValue("5");
    expect(saveButton(card)).toBeDisabled();
    expect(within(card).getByRole("status")).toBeEmptyDOMElement();

    await type(card, "8");
    await userEvent.click(saveButton(card));

    expect(await within(card).findByText("Quantidade atualizada")).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("Quantidade atualizada");
    expect(await findCard("Laranja")).toHaveTextContent("3 kg");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/interests/interesse-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({ quantity: 8 });
    expect(saveButton(card)).toBeDisabled();
  });

  it("sends one request while the save is pending", async () => {
    const fetchMock = renderInterests(interestsResponse([mandioca]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    const card = await findCard("Mandioca");
    await type(card, "8");

    await userEvent.dblClick(saveButton(card));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(within(card).getByLabelText(QUANTITY)).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Remover" })).toBeDisabled();
  });

  it("forgets the saved note on the next edit", async () => {
    renderInterests(interestsResponse([mandioca]), jsonResponse({ ...mandioca, quantity: 8 }));
    const card = await findCard("Mandioca");
    await type(card, "8");
    await userEvent.click(saveButton(card));
    await within(card).findByText("Quantidade atualizada");

    await type(card, "9");

    expect(within(card).queryByText("Quantidade atualizada")).not.toBeInTheDocument();
    expect(saveButton(card)).toBeEnabled();
  });

  it.each(["", "0"])("explains the quantity %j and blocks saving", async (value) => {
    renderInterests(interestsResponse([mandioca]));
    const card = await findCard("Mandioca");

    await type(card, value);

    expect(within(card).getByRole("alert")).toHaveTextContent(AT_LEAST_ONE);
    expect(saveButton(card)).toBeDisabled();
  });

  it("accepts only digits, up to nine", async () => {
    renderInterests(interestsResponse([mandioca]));
    const card = await findCard("Mandioca");

    expect(await type(card, "1a2")).toHaveValue("12");
    expect(await type(card, "1234567890")).toHaveValue("123456789");
  });

  it("shows the API message inside the card when saving fails", async () => {
    const refusal = jsonResponse({ detail: "Interesse não encontrado" }, 404);
    renderInterests(interestsResponse([mandioca]), refusal);
    const card = await findCard("Mandioca");
    await type(card, "8");

    await userEvent.click(saveButton(card));

    expect(await within(card).findByRole("alert")).toHaveTextContent("Interesse não encontrado");
    expect(within(card).queryByText("Quantidade atualizada")).not.toBeInTheDocument();
  });

  it("reloads the user when the session ended before the save", async () => {
    stubFetch(interestsResponse([mandioca]), jsonResponse({ detail: "Não autenticado" }, 401));
    const auth = fakeAuth({ user: anaAsBuyer("APROVADO") });
    renderWithAuth(<MyInterests />, auth);
    const card = await findCard("Mandioca");
    await type(card, "8");

    await userEvent.click(saveButton(card));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("only shows the quantity of an unavailable product", async () => {
    renderInterests(interestsResponse([laranja]));
    const card = await findCard("Laranja");

    expect(within(card).queryByLabelText(QUANTITY)).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(card).toHaveTextContent("3 kg");
    expect(card).toHaveTextContent("o interesse só pode ser removido");
  });

  it("stops the editing when the saved interest comes back unavailable", async () => {
    const unavailable = { ...mandioca, quantity: 8, product_status: "Indisponível" };
    renderInterests(interestsResponse([mandioca]), jsonResponse(unavailable));
    const card = await findCard("Mandioca");
    await type(card, "8");

    await userEvent.click(saveButton(card));

    expect(await within(card).findByText("Indisponível")).toBeInTheDocument();
    expect(within(card).queryByLabelText(QUANTITY)).not.toBeInTheDocument();
    expect(card).toHaveTextContent("8 kg");
    expect(within(card).getByRole("status")).toHaveTextContent("Quantidade atualizada");
  });
});
