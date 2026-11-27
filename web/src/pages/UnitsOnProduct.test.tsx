import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProductDetail } from "../api/products";
import { ProductRow } from "../components/farmers/ProductRow";
import { laranja } from "../test/farmers";
import { anaAsManager, fakeAuth, renderWithAuth, stubFetch } from "../test/helpers";
import { pageLoad, renderDetail, sampleProduct } from "../test/productDetail";

const eggs: ProductDetail = { ...sampleProduct, unit: "duzia", quantity: 6, price: "12.00" };

async function openAsManager(product: ProductDetail) {
  stubFetch(...pageLoad(product));
  renderDetail(fakeAuth({ user: anaAsManager }));
  return screen.findByLabelText("Quantidade");
}

describe("product unit on the product page and rows", () => {
  beforeEach(() => localStorage.clear());

  it("shows the price, the stock and the hint in dozens to the resident", async () => {
    stubFetch(...pageLoad(eggs));
    renderDetail();

    expect(await screen.findByText("por dúzia")).toBeInTheDocument();
    expect(screen.getByText("por dúzia").parentElement).toHaveTextContent("R$ 12,00 por dúzia");
    expect(screen.getByText("6 dúzias disponíveis")).toBeInTheDocument();
    expect(await screen.findByText("Escolha uma quantidade de até 6 dúzias.")).toBeVisible();
  });

  it("counts the cart in the product unit for the manager", async () => {
    const water = { ...eggs, unit: "litro" as const, quantity: 1 };
    await openAsManager(water);
    expect(screen.getByText("1 litro disponível")).toBeInTheDocument();
    expect(screen.getByText("Escolha uma quantidade de até 1 litro.")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));

    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 1 litro");
  });

  it("tells how many units still fit in the cart", async () => {
    await openAsManager(eggs);
    await userEvent.clear(screen.getByLabelText("Quantidade"));
    await userEvent.type(screen.getByLabelText("Quantidade"), "2");

    await userEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));

    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 2 dúzias");
    expect(screen.getByText("Cabem mais 4 dúzias no carrinho.")).toBeVisible();
  });

  it("shows the stock, the price and the cart of a row in bunches", async () => {
    const kale = { ...laranja, unit: "maco" as const, quantity: 3, price: "2.50" };
    renderWithAuth(
      <ul>
        <ProductRow product={kale} />
      </ul>,
      fakeAuth({ user: anaAsManager }),
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("3 maços disponíveis");
    expect(row).toHaveTextContent("R$ 2,50 por maço");

    await userEvent.click(screen.getByRole("button", { name: /^Adicionar/ }));

    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 1 maço");
  });
});
