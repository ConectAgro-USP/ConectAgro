import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Interest } from "../api/interests";
import { jsonResponse } from "../test/helpers";
import { findCard, interestsResponse, mandioca, renderInterests } from "../test/interests";
import { inPurchase } from "../test/productInterest";

const QUANTITY = "Quantidade (kg)";
const IN_PURCHASE = "Incluído na compra de 20/11, entrega prevista 27/11";
const REFUSED = "Este interesse já está numa compra do prédio";
// a API soma os interesses abertos das duas páginas
const FIRST = { page: 1, page_size: 1, total: 2, total_pages: 2, estimated_total: "45.00" };
const SECOND = { ...FIRST, page: 2 };

const abobora: Interest = {
  ...mandioca,
  public_id: "interesse-3",
  product_public_id: "produto-3",
  product_name: "Abóbora",
};
const bought: Interest = { ...abobora, purchase: inPurchase.purchase };

// a API de agora, com a abóbora já na compra do prédio
function afterThePurchase(url: string): Response {
  const query = new URL(url, "http://localhost").searchParams;
  // filtrada pelo produto, a soma da API conta só ele
  if (query.get("product_public_id") === "produto-3") return interestsResponse([bought]);
  const now = { estimated_total: "22.50" };
  return query.get("page") === "1"
    ? interestsResponse([mandioca], { ...FIRST, ...now })
    : interestsResponse([bought], { ...SECOND, ...now });
}

function total(): HTMLElement {
  return screen.getByText("Total estimado").parentElement!.parentElement!;
}

describe("MyInterests, refusal of an interest on a later page", () => {
  // abre a segunda página e salva a abóbora, que a compra já levou
  async function saveFromPageTwo(): Promise<HTMLElement> {
    await findCard("Mandioca");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais interesses" }));
    const card = await findCard("Abóbora");
    await userEvent.clear(within(card).getByLabelText(QUANTITY));
    await userEvent.type(within(card).getByLabelText(QUANTITY), "8");
    await userEvent.click(within(card).getByRole("button", { name: "Salvar" }));
    return card;
  }

  it("keeps every page and shows the refused card as it is now", async () => {
    const fetchMock = renderInterests(
      interestsResponse([mandioca], FIRST),
      interestsResponse([abobora], SECOND),
      jsonResponse({ detail: REFUSED }, 409),
    );
    fetchMock.mockImplementation(async (url) => afterThePurchase(String(url)));

    const card = await saveFromPageTwo();

    expect(await within(card).findByRole("alert")).toHaveTextContent(REFUSED);
    expect(within(card).getByText(IN_PURCHASE)).toBeInTheDocument();
    expect(within(card).queryByLabelText(QUANTITY)).not.toBeInTheDocument();
    expect(card).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mandioca" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/interests/me?page=1&product_public_id=produto-3");
    expect(fetchMock.mock.calls[4][0]).toBe("/api/interests/me?page=1&page_size=1");
    expect(total()).toHaveTextContent("R$ 22,50");
  });

  it("takes the total from the API when a later page already left the bought one out", async () => {
    // a segunda página chega depois da compra, com a abóbora fora da soma
    const fetchMock = renderInterests(
      interestsResponse([abobora], FIRST),
      interestsResponse([mandioca], { ...SECOND, estimated_total: "22.50" }),
      jsonResponse({ detail: REFUSED }, 409),
    );
    fetchMock.mockImplementation(async (url) => afterThePurchase(String(url)));
    const card = await findCard("Abóbora");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais interesses" }));
    await findCard("Mandioca");
    await userEvent.clear(within(card).getByLabelText(QUANTITY));
    await userEvent.type(within(card).getByLabelText(QUANTITY), "8");

    await userEvent.click(within(card).getByRole("button", { name: "Salvar" }));

    expect(await within(card).findByRole("alert")).toHaveTextContent(REFUSED);
    expect(within(card).getByText(IN_PURCHASE)).toBeInTheDocument();
    expect(total()).toHaveTextContent("R$ 22,50");
  });

  it("still takes the bought one out of the total when only the total read fails", async () => {
    const fetchMock = renderInterests(
      interestsResponse([mandioca], FIRST),
      interestsResponse([abobora], SECOND),
      jsonResponse({ detail: REFUSED }, 409),
    );
    fetchMock.mockImplementation(async (url) =>
      String(url).includes("product_public_id")
        ? interestsResponse([bought])
        : jsonResponse({ detail: "Erro interno" }, 500),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const card = await saveFromPageTwo();

    expect(await within(card).findByRole("alert")).toHaveTextContent(REFUSED);
    expect(within(card).getByText(IN_PURCHASE)).toBeInTheDocument();
    expect(total()).toHaveTextContent("R$ 22,50");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
