import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CART_LIMIT } from "../hooks/useCart";
import { item, storeCart, storedCart } from "../test/cart";
import { pageResponse } from "../test/helpers";
import { alface, laranja, mandioca, renderNeeds, select, soldOutAlface } from "../test/needs";

const ADD = { name: "Adicionar ao carrinho" };

describe("BuildingNeeds cart", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the selection in a bar fixed above the bottom menu on phones", async () => {
    renderNeeds(pageResponse([mandioca, alface, laranja]));
    await select("Mandioca", "Laranja");

    const bar = screen.getByRole("region", { name: "Seleção" });
    expect(bar).toHaveTextContent("2 produtos selecionados, de 2 agricultores");
    expect(within(bar).getByRole("button", ADD)).toBeVisible();
    expect(bar).toHaveClass("fixed", "bottom-[calc(4rem+env(safe-area-inset-bottom))]");
    expect(bar).toHaveClass("md:sticky");
    expect(screen.getAllByRole("listitem").at(-1)!.compareDocumentPosition(bar)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("hides the bar when nothing is selected", async () => {
    renderNeeds(pageResponse([mandioca]));
    await select("Mandioca", "Mandioca");

    expect(screen.queryByRole("region", { name: "Seleção" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", ADD)).not.toBeInTheDocument();
  });

  it("puts the requested total in the cart, up to the stock, and opens it", async () => {
    renderNeeds(pageResponse([mandioca, alface, laranja]));
    await select("Mandioca", "Alface");

    await userEvent.click(screen.getByRole("button", ADD));

    expect(screen.getByRole("heading", { name: "Carrinho" })).toBeInTheDocument();
    expect(storedCart()).toEqual([item("produto-1", 12, "20.00"), item("produto-2", 4, "3.50")]);
  });

  it("keeps what was already in the cart and updates the selected products", async () => {
    storeCart([item("produto-9", 2, "8.00"), item("produto-1", 30, "20.00")]);
    renderNeeds(pageResponse([mandioca]));
    await select("Mandioca");

    await userEvent.click(screen.getByRole("button", ADD));

    expect(storedCart()).toEqual([item("produto-9", 2, "8.00"), item("produto-1", 12, "20.00")]);
  });

  it("leaves a sold out need out of the cart", async () => {
    renderNeeds(pageResponse([mandioca, alface]), pageResponse([mandioca, soldOutAlface]));
    await select("Mandioca", "Alface");
    await userEvent.click(screen.getByRole("button", { name: "Menor primeiro" }));
    await screen.findByText("Sem estoque");

    expect(screen.getByRole("region", { name: "Seleção" })).toHaveTextContent(
      "1 produto selecionado, de 1 agricultor",
    );
    await userEvent.click(screen.getByRole("button", ADD));
    expect(storedCart()).toEqual([item("produto-1", 12, "20.00")]);
  });

  it(`stays on the needs when the cart reaches ${CART_LIMIT} products`, async () => {
    storeCart(Array.from({ length: CART_LIMIT - 1 }, (_, index) => item(`outro-${index}`)));
    renderNeeds(pageResponse([mandioca, alface]));
    await select("Mandioca", "Alface");

    await userEvent.click(screen.getByRole("button", ADD));

    expect(screen.getByRole("alert")).toHaveTextContent(
      `O carrinho chegou ao limite de ${CART_LIMIT} produtos, 1 produto ficou de fora`,
    );
    expect(screen.queryByRole("heading", { name: "Carrinho" })).not.toBeInTheDocument();
    expect(storedCart()).toHaveLength(CART_LIMIT);
  });
});
