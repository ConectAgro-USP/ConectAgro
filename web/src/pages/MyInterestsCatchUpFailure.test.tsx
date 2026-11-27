import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Interest } from "../api/interests";
import { jsonResponse } from "../test/helpers";
import {
  abobora,
  findCard,
  interestsResponse,
  mandioca,
  renderInterests,
} from "../test/interests";
import { press } from "../test/products";

const MORE = "Mostrar mais interesses";
const FIRST = { page: 1, total: 21, total_pages: 2 };

function interest(id: number, name: string): Interest {
  return {
    ...mandioca,
    public_id: `interesse-${id}`,
    product_public_id: `produto-${id}`,
    product_name: name,
  };
}

const batata = interest(4, "Batata");

describe("MyInterests, catch-up page that fails", () => {
  it("keeps counting the removed row for the next Mostrar mais", async () => {
    const fetchMock = renderInterests(
      interestsResponse([mandioca, abobora], FIRST),
      new Response(null, { status: 204 }),
      jsonResponse({}, 500),
      jsonResponse({ ...abobora, quantity: 7 }),
      interestsResponse([{ ...abobora, quantity: 7 }, batata]),
    );
    const removed = await findCard("Mandioca");
    await press(removed, "Remover");
    await press(removed, "Remover");
    await waitFor(() => expect(removed).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: MORE }));
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeVisible();

    const card = await findCard("Abóbora");
    const field = within(card).getByLabelText("Quantidade (kg)");
    await userEvent.clear(field);
    await userEvent.type(field, "7");
    await press(card, "Salvar");
    await within(card).findByText("Quantidade atualizada");
    await userEvent.click(screen.getByRole("button", { name: MORE }));

    expect(await findCard("Batata")).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][0]).toBe("/api/interests/me?page=1");
  });
});
