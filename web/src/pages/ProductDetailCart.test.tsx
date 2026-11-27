import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CART_LIMIT } from "../hooks/useCart";
import { item, storeCart, storedCart } from "../test/cart";
import { anaAsBuyer, anaAsManager, fakeAuth, stubFetch } from "../test/helpers";
import { pageLoad, renderDetail, sampleProduct } from "../test/productDetail";

const ADD = { name: "Adicionar ao carrinho" };

async function openAsManager(product = sampleProduct) {
  stubFetch(...pageLoad(product));
  renderDetail(fakeAuth({ user: anaAsManager }));
  return screen.findByLabelText("Quantidade");
}

async function typeQuantity(quantity: string) {
  await userEvent.clear(screen.getByLabelText("Quantidade"));
  await userEvent.type(screen.getByLabelText("Quantidade"), quantity);
}

describe("ProductDetail, cart", () => {
  beforeEach(() => localStorage.clear());

  it("puts the chosen quantity in the cart, at the price shown", async () => {
    await openAsManager();
    await typeQuantity("3");

    await userEvent.click(screen.getByRole("button", ADD));

    expect(storedCart()).toEqual([item("prod-123", 3, "20.00")]);
    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 3 kg");
    expect(screen.getByRole("link", { name: "Ver o carrinho" })).toHaveAttribute(
      "href",
      "/carrinho",
    );
    expect(screen.getByRole("button", { name: "Adicionado ao carrinho" })).toBeDisabled();
    expect(screen.getByText("Cabem mais 22 kg no carrinho.")).toBeVisible();
  });

  it("adds more after the quantity changes again", async () => {
    await openAsManager();
    await userEvent.click(screen.getByRole("button", ADD));

    await typeQuantity("4");
    await userEvent.click(screen.getByRole("button", ADD));

    expect(storedCart()).toEqual([item("prod-123", 5, "20.00")]);
    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 5 kg");
  });

  it("counts what is already in the cart against the stock", async () => {
    storeCart([item("prod-123", 24)]);
    await openAsManager();

    expect(screen.getByText("Cabem mais 1 kg no carrinho.")).toBeVisible();
    await typeQuantity("2");

    expect(screen.getByRole("alert")).toHaveTextContent("excede o estoque disponível");
    expect(screen.getByRole("button", ADD)).toBeDisabled();
  });

  it("blocks the quantity when the whole stock is in the cart", async () => {
    storeCart([item("prod-123", 25)]);
    const quantity = await openAsManager();

    expect(quantity).toBeDisabled();
    expect(screen.getByText("Todo o estoque já está no carrinho.")).toBeVisible();
    expect(screen.getByRole("button", ADD)).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it(`says when the cart already has ${CART_LIMIT} products`, async () => {
    storeCart(Array.from({ length: CART_LIMIT }, (_, index) => item(`produto-${index}`)));
    await openAsManager();

    await userEvent.click(screen.getByRole("button", ADD));

    expect(screen.getByRole("alert")).toHaveTextContent(
      `O carrinho já tem ${CART_LIMIT} produtos, o limite de uma compra`,
    );
    expect(storedCart()).toHaveLength(CART_LIMIT);
  });

  it("does not add a product that cannot be bought", async () => {
    await openAsManager({ ...sampleProduct, is_available: false });

    expect(screen.getByText("Indisponível")).toBeVisible();
    expect(screen.getByRole("button", ADD)).toBeDisabled();
  });

  it("never offers the cart to the resident", async () => {
    stubFetch(...pageLoad());
    renderDetail(fakeAuth({ user: anaAsBuyer("APROVADO") }));

    expect(await screen.findByRole("button", { name: "Registrar interesse" })).toBeVisible();
    expect(screen.queryByRole("button", ADD)).not.toBeInTheDocument();
    expect(screen.queryByText(/No carrinho/)).not.toBeInTheDocument();
  });
});
