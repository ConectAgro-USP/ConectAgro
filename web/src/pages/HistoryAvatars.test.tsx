import {
  findCard as findPurchase,
  pageOf as purchasesPage,
  purchase,
  renderPurchases,
} from "../test/purchases";
import { findCard as findSale, pageOf, pendingSale, renderSales } from "../test/sales";

function initials(card: HTMLElement): string[] {
  return [...card.querySelectorAll('[aria-hidden="true"] > span')].map(
    (avatar) => avatar.textContent ?? "",
  );
}

describe("avatares do histórico", () => {
  it("tira a inicial do prédio dos cartões de Minhas vendas", async () => {
    renderSales(pageOf(pendingSale));

    const card = await findSale(pendingSale.building_name);

    expect(initials(card)).toEqual([]);
  });

  it("mantém as iniciais que separam os agricultores em Compras do prédio", async () => {
    renderPurchases(purchasesPage(purchase));

    const card = await findPurchase("Osvaldo S. e Maria F.");

    expect(initials(card)).toEqual(["O", "M"]);
  });
});
