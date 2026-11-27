import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PurchaseItem } from "../api/history";
import type { Interest } from "../api/interests";
import { ItemLines } from "../components/history/ItemLines";
import { inCart, lineOf, productsOf, renderCartPage } from "../test/cartPage";
import { pageResponse } from "../test/helpers";
import { findCard, interestsResponse, mandioca, renderInterests } from "../test/interests";
import { alface, renderNeeds } from "../test/needs";

const lettuces: Interest = {
  ...mandioca,
  product_name: "Pé de alface",
  quantity: 3,
  product: { ...mandioca.product!, unit: "unidade", price: "0.80" },
};
const milk: PurchaseItem = {
  product_public_id: "produto-9",
  product_name: "Leite",
  product_unit: "litro",
  quantity: 6,
  unit_price: "6.00",
  subtotal: "36.00",
};

describe("product unit in the lists", () => {
  beforeEach(() => localStorage.clear());

  it("shows the interest of the resident in units", async () => {
    renderInterests(interestsResponse([lettuces]));

    const card = await findCard("Pé de alface");
    expect(card).toHaveTextContent("R$ 0,80 por unidade, custo estimado R$ 2,40");
    const quantity = within(card).getByLabelText("Quantidade (unidades)");
    await userEvent.clear(quantity);

    expect(card).toHaveTextContent("Informe uma quantidade de pelo menos 1 unidade");
  });

  it("shows the quantity of a purchase in its unit", () => {
    render(<ItemLines items={[milk]} />);

    expect(screen.getByRole("listitem")).toHaveTextContent(/Leite\s*6 litros × R\$ 6,00/);
  });

  it("shows the building need in dozens", async () => {
    const eggs = { ...alface, product: { ...alface.product, name: "Ovos", unit: "duzia" as const } };
    renderNeeds(pageResponse([eggs]));

    const row = (await screen.findByRole("heading", { name: "Ovos" })).closest("li")!;
    expect(row).toHaveTextContent(`${eggs.total_quantity} dúzias no total`);
    expect(row).toHaveTextContent("por dúzia");
    expect(row).toHaveTextContent(`${eggs.product.quantity} dúzias disponíveis`);
  });

  it("names the unit of each cart line", async () => {
    const water = { ...alface.product, name: "Água", unit: "litro" as const, quantity: 1 };
    renderCartPage([inCart(water, 1)], ...productsOf(water));

    const field = await screen.findByRole("spinbutton", { name: "Quantidade de Água em litros" });
    expect(field).toHaveAccessibleDescription("1 litro disponível");
    expect(lineOf("Água")).toHaveTextContent(/litro × R\$/);
  });
});
