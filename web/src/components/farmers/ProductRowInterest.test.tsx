import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Interest } from "../../api/interests";
import { Dashboard } from "../../pages/Dashboard";
import { NearbyFarmers } from "../../pages/NearbyFarmers";
import { couve, feijao } from "../../test/catalog";
import { findCard, joao, laranja, mandioca, maria, pageOf } from "../../test/farmers";
import { anaAsBuyer, anaAsManager, fakeAuth, renderWithAuth } from "../../test/helpers";
import { answerMyInterests, mandioca as interest } from "../../test/interests";
import { delivered, inPurchase } from "../../test/productInterest";

const resident = fakeAuth({ user: anaAsBuyer("APROVADO") });

function chosen(productPublicId: string, changes: Partial<Interest> = {}): Interest {
  return { ...interest, product_public_id: productPublicId, quantity: 3, ...changes };
}

// as páginas respondem em ordem, e a lista do morador sai à parte
function stubPages(interests: Interest[], ...pages: Response[]) {
  const fetchMock = vi.fn<typeof fetch>(async () => pageOf([]));
  for (const response of pages) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return answerMyInterests(interests);
}

async function findRow(name: string): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { level: 3, name })).closest("li")!;
}

describe("ProductRow, the resident's interest", () => {
  it("marks the catalog products already chosen, reading the interests once", async () => {
    const third = { ...feijao, public_id: "produto-3", name: "Abóbora" };
    const listed = stubPages(
      [chosen("produto-1"), chosen("produto-2", { purchase: inPurchase.purchase })],
      pageOf([feijao, couve, third]),
    );
    renderWithAuth(<Dashboard />, resident);

    expect(await findRow("Feijão carioca")).toHaveTextContent("No seu interesse: 3 kg");
    expect(await findRow("Couve")).toHaveTextContent("Na compra do prédio");
    expect(await findRow("Abóbora")).not.toHaveTextContent(/No seu interesse|Na compra/);
    expect(listed).toHaveBeenCalledOnce();
  });

  it("tells when a chosen product was delivered", async () => {
    stubPages([chosen("produto-1", { purchase: delivered.purchase })], pageOf([feijao]));
    renderWithAuth(<Dashboard />, resident);

    expect(await findRow("Feijão carioca")).toHaveTextContent("Entregue em 25/11");
  });

  it("does not ask the manager for interests, and keeps the cart button", async () => {
    const listed = stubPages([chosen("produto-1")], pageOf([feijao]));
    renderWithAuth(<Dashboard />, fakeAuth({ user: anaAsManager }));

    const row = await findRow("Feijão carioca");
    expect(within(row).getByRole("button", { name: /Adicionar Feijão carioca/ })).toBeVisible();
    expect(row).not.toHaveTextContent("No seu interesse");
    expect(listed).not.toHaveBeenCalled();
  });

  it("marks the products of each farmer opened on the farmers page", async () => {
    const listed = stubPages(
      [chosen("produto-1"), chosen("produto-2", { quantity: 1 })],
      pageOf([maria, joao]),
      pageOf([laranja]),
      pageOf([mandioca]),
    );
    renderWithAuth(<NearbyFarmers />, resident, "/agricultores");

    const first = await findCard("Maria S.");
    await userEvent.click(within(first).getByRole("button", { name: "Ver produtos" }));
    expect(await findRow("Laranja")).toHaveTextContent("No seu interesse: 3 kg");
    const second = await findCard("João V.");
    await userEvent.click(within(second).getByRole("button", { name: "Ver produtos" }));

    expect(await findRow("Mandioca")).toHaveTextContent("No seu interesse: 1 kg");
    expect(listed).toHaveBeenCalledOnce();
  });
});
