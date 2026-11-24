import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProfileRead } from "../../api/profiles";
import { CART_LIMIT } from "../../hooks/useCart";
import { Dashboard } from "../../pages/Dashboard";
import { item, storeCart, storedCart } from "../../test/cart";
import { laranja, mandioca, pageOf } from "../../test/farmers";
import {
  anaAsBuyer,
  anaAsFarmer,
  anaAsManager,
  fakeAuth,
  renderWithAuth,
  stubFetch,
} from "../../test/helpers";
import { FarmerProducts } from "./FarmerProducts";
import { ProductRow } from "./ProductRow";

const ADD_LARANJA = { name: "Adicionar Laranja ao carrinho" };

function renderRow(product = laranja, user: ProfileRead = anaAsManager) {
  renderWithAuth(
    <ul>
      <ProductRow product={product} />
    </ul>,
    fakeAuth({ user }),
  );
}

describe("ProductRow, cart", () => {
  beforeEach(() => localStorage.clear());

  it("adds one kilo at a time and shows how much is in the cart", async () => {
    renderRow();
    const add = screen.getByRole("button", ADD_LARANJA);
    expect(add).toHaveTextContent("Adicionar");

    await userEvent.click(add);
    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 1 kg");
    await userEvent.click(add);

    expect(screen.getByRole("status")).toHaveTextContent("No carrinho: 2 kg");
    expect(storedCart()).toEqual([item("produto-1", 2, "4.99")]);
  });

  it("stops at the stock", async () => {
    renderRow(mandioca);

    await userEvent.click(screen.getByRole("button", { name: "Adicionar Mandioca ao carrinho" }));

    expect(screen.getByRole("button", { name: /^Adicionar Mandioca/ })).toBeDisabled();
    expect(storedCart()).toEqual([item("produto-2", 1, "7.00")]);
  });

  it(`says when the cart already has ${CART_LIMIT} products`, async () => {
    storeCart(Array.from({ length: CART_LIMIT }, (_, index) => item(`outro-${index}`)));
    renderRow();

    await userEvent.click(screen.getByRole("button", ADD_LARANJA));

    expect(screen.getByRole("alert")).toHaveTextContent(`O carrinho já tem ${CART_LIMIT} produtos`);
  });

  it.each<[string, ProfileRead]>([
    ["resident", anaAsBuyer("APROVADO")],
    ["farmer", anaAsFarmer],
  ])("shows no cart button to the %s", (_profile, user) => {
    renderRow(laranja, user);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("R$ 4,99 por quilo");
  });

  it("is in the catalog rows", async () => {
    stubFetch(pageOf([{ ...laranja, farmer_short_name: "Maria S.", farmer_farm_name: null }]));
    renderWithAuth(<Dashboard />, fakeAuth({ user: anaAsManager }));

    const row = (await screen.findByRole("link", { name: "Laranja" })).closest("li")!;
    await userEvent.click(within(row).getByRole("button", ADD_LARANJA));

    expect(within(row).getByRole("status")).toHaveTextContent("No carrinho: 1 kg");
  });

  it("is in the product rows of a farmer", async () => {
    storeCart([item("produto-1", 3, "4.99")]);
    stubFetch(pageOf([laranja]));
    const auth = fakeAuth({ user: anaAsManager });
    renderWithAuth(<FarmerProducts farmerPublicId="agricultor-1" interests={new Map()} />, auth);

    expect(await screen.findByRole("button", ADD_LARANJA)).toBeEnabled();
    expect(screen.getByText("No carrinho: 3 kg")).toBeVisible();
  });
});
