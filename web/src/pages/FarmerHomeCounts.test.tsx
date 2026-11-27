import { screen, within } from "@testing-library/react";
import { jsonResponse, pageBody } from "../test/helpers";
import { findSummary, renderHome, salesPage } from "../test/home";
import { orange } from "../test/products";
import { pendingSale } from "../test/sales";

const BUILDINGS = ["Ed. Ipê", "Res. Acácias", "Ed. Primavera", "Ed. Jasmim"];

// a página traz um produto só, e a contagem vale para todos os do agricultor
function countsOnly(counts: object): Response {
  return jsonResponse(pageBody([orange], { total: 40, total_pages: 40, page_size: 1, counts }));
}

describe("FarmerHome, product counts", () => {
  it("shows the API counts of every product, not only the first page", async () => {
    renderHome({
      products: countsOnly({
        all: 40,
        available: 31,
        hidden: 9,
        sold_out: 6,
        expiring_soon: 12,
      }),
    });
    const summary = await findSummary("Seus produtos");

    const lines = within(summary).getAllByRole("definition");

    expect(lines.map((line) => line.textContent)).toEqual(["31", "6", "12"]);
  });

  it("invites to add the first product only when the API counts none", async () => {
    renderHome({
      products: countsOnly({ all: 0, available: 0, hidden: 0, sold_out: 0, expiring_soon: 0 }),
    });

    const invite = await screen.findByRole("link", { name: "Cadastrar primeiro produto" });

    expect(invite).toHaveAttribute("href", "/meus-produtos?novo=1");
  });

  it("counts every open sale with the API totals and lists the first three it sends", async () => {
    const sales = BUILDINGS.map((name, n) => ({
      ...pendingSale,
      purchase_public_id: `compra-${n}`,
      building_name: name,
    }));
    renderHome({ products: [orange], sales: salesPage(sales, 25, "480.00") });
    const summary = await findSummary("Vendas a entregar");

    expect(await within(summary).findByText(/para entregar/)).toHaveTextContent(
      "25 vendas para entregar, R$ 480,00 a receber.",
    );
    const shown = BUILDINGS.filter((name) => within(summary).queryByText(name));
    expect(shown).toEqual(BUILDINGS.slice(0, 3));
  });
});
