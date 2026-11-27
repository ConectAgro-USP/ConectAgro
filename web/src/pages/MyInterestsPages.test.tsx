import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import {
  findCard,
  interestsResponse,
  laranja,
  mandioca,
  renderInterests,
  total,
} from "../test/interests";

const MORE = "Mostrar mais interesses";
// a API soma os interesses abertos das duas páginas, não só os da tela
const FIRST = { page: 1, total: 21, total_pages: 2, estimated_total: "100.00" };
const SECOND = { page: 2, total: 21, total_pages: 2, estimated_total: "100.00" };

function press(card: HTMLElement, name: string) {
  return userEvent.click(within(card).getByRole("button", { name }));
}

describe("MyInterests, pages", () => {
  it("shows the next page below the first one", async () => {
    const fetchMock = renderInterests(
      interestsResponse([mandioca], FIRST),
      interestsResponse([laranja], SECOND),
    );
    await findCard("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: MORE }));

    expect(await findCard("Laranja")).toBeInTheDocument();
    expect(await findCard("Mandioca")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/interests/me?page=2");
    expect(screen.queryByRole("button", { name: MORE })).not.toBeInTheDocument();
  });

  it("shows the API total of every page before the next one loads", async () => {
    renderInterests(interestsResponse([mandioca], FIRST));
    await findCard("Mandioca");

    expect(total()).toHaveTextContent("R$ 100,00");
  });

  it("follows a saved quantity in the total of every page", async () => {
    renderInterests(
      interestsResponse([mandioca], FIRST),
      jsonResponse({ ...mandioca, quantity: 7 }),
    );
    const card = await findCard("Mandioca");
    const field = within(card).getByLabelText("Quantidade (kg)");
    await userEvent.clear(field);
    await userEvent.type(field, "7");

    await press(card, "Salvar");

    expect(await within(card).findByText("Quantidade atualizada")).toBeInTheDocument();
    expect(total()).toHaveTextContent("R$ 109,00");
  });

  it("takes a removed interest out of the total of every page", async () => {
    renderInterests(interestsResponse([mandioca], FIRST), new Response(null, { status: 204 }));
    const card = await findCard("Mandioca");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(card).not.toBeInTheDocument());
    expect(total()).toHaveTextContent("R$ 77,50");
  });
});
