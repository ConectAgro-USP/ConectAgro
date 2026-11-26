import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import {
  abobora,
  findCard,
  interestsResponse,
  mandioca,
  renderInterests,
  total,
} from "../test/interests";

// a API soma os interesses abertos das duas páginas
const FIRST = { page: 1, page_size: 1, total: 2, total_pages: 2, estimated_total: "45.00" };
// outra compra do prédio tirou da soma o mesmo que a escrita daqui somou
const SECOND = { ...FIRST, page: 2 };

describe("MyInterests, total of a page that arrives after a write", () => {
  it("takes the API total even when it equals the one before", async () => {
    renderInterests(
      interestsResponse([mandioca], FIRST),
      jsonResponse({ ...mandioca, quantity: 6 }),
      interestsResponse([abobora], SECOND),
    );
    const card = await findCard("Mandioca");
    const field = within(card).getByLabelText("Quantidade (kg)");
    await userEvent.clear(field);
    await userEvent.type(field, "6");
    await userEvent.click(within(card).getByRole("button", { name: "Salvar" }));
    expect(await within(card).findByText("Quantidade atualizada")).toBeInTheDocument();
    expect(total()).toHaveTextContent("R$ 49,50");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais interesses" }));

    await findCard("Abóbora");
    expect(total()).toHaveTextContent("R$ 45,00");
  });
});
