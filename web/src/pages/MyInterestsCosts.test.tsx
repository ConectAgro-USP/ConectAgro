import { screen, within } from "@testing-library/react";
import type { Interest } from "../api/interests";
import { findCard, interestsResponse, laranja, mandioca, renderInterests } from "../test/interests";
import { inPurchase } from "../test/productInterest";

const couve: Interest = {
  ...mandioca,
  public_id: "interesse-3",
  product_public_id: "produto-3",
  product_name: "Couve",
  quantity: 3,
  product: {
    ...mandioca.product!,
    picture_url: "https://example.com/couve.jpg",
    price: "2.99",
    farmer: { public_id: "agricultor-2", short_name: "Maria F.", farm_name: null },
  },
};

describe("MyInterests, prices and costs", () => {
  it("shows the picture, the farmer, the unit price and the estimated cost", async () => {
    renderInterests(interestsResponse([couve, mandioca]));

    const card = await findCard("Couve");
    expect(card.querySelector("img")).toHaveAttribute("src", "https://example.com/couve.jpg");
    expect(card).toHaveTextContent("Vendido por Maria F.");
    expect(card).toHaveTextContent("R$ 2,99 por quilo, custo estimado R$ 8,97");
    const other = await findCard("Mandioca");
    expect(other).toHaveTextContent("João S., Sítio Borba");
    expect(other).toHaveTextContent("R$ 4,50 por quilo, custo estimado R$ 22,50");
  });

  it("follows the saved quantity in the estimated cost", async () => {
    renderInterests(interestsResponse([{ ...mandioca, quantity: 10 }]));

    expect(await findCard("Mandioca")).toHaveTextContent("custo estimado R$ 45,00");
  });

  it("shows no price for a product the farmer deleted", async () => {
    const removed = { ...laranja, product_public_id: null, product: null };
    renderInterests(interestsResponse([removed]));

    const card = await findCard("Laranja");
    expect(card).not.toHaveTextContent("por quilo");
    expect(card).not.toHaveTextContent("custo estimado");
  });

  it("adds the open interests on sale into the estimated total", async () => {
    const offSale = { ...couve, public_id: "interesse-4", product_status: "Indisponível" };
    const bought = { ...couve, public_id: "interesse-5", purchase: inPurchase.purchase };
    renderInterests(interestsResponse([couve, mandioca, offSale, bought]));

    await findCard("Mandioca");
    const total = screen.getByText("Total estimado").parentElement!.parentElement!;

    expect(total).toHaveTextContent("R$ 31,47");
    expect(within(total).getByText(/Soma dos interesses abertos/)).toBeInTheDocument();
  });

  it("leaves the total out when nothing open is on sale", async () => {
    renderInterests(interestsResponse([laranja, { ...mandioca, purchase: inPurchase.purchase }]));

    await findCard("Laranja");

    expect(screen.queryByText("Total estimado")).not.toBeInTheDocument();
  });
});
