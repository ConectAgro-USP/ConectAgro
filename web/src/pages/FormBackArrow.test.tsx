import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { orange, productsResponse, renderProducts } from "../test/products";

describe("back arrow of the forms opened from a list", () => {
  it("takes the farmer from the product form back to the products", async () => {
    renderProducts(productsResponse([orange]));
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));

    expect(screen.getByRole("heading", { level: 1, name: "Meus produtos" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos meus produtos" }));

    expect(screen.queryByLabelText("Nome do produto")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Voltar/ })).not.toBeInTheDocument();
  });
});
