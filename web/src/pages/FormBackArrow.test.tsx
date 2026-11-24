import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { alface, mandioca, openPurchase, renderNeeds } from "../test/needs";
import { orange, renderProducts } from "../test/products";

describe("back arrow of the forms opened from a list", () => {
  it("takes the farmer from the product form back to the products", async () => {
    renderProducts(jsonResponse([orange]));
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));

    expect(screen.getByRole("heading", { level: 1, name: "Meus produtos" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos meus produtos" }));

    expect(screen.queryByLabelText("Nome do produto")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Voltar/ })).not.toBeInTheDocument();
  });

  it("takes the manager from the purchase back to the needs", async () => {
    renderNeeds(jsonResponse([mandioca, alface]));
    await screen.findByRole("checkbox", { name: /^Selecionar Mandioca de/ });
    expect(screen.queryByRole("button", { name: "Voltar às necessidades" })).toBeNull();
    await openPurchase("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Voltar às necessidades" }));

    expect(screen.queryByRole("heading", { name: "Fechar compra" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Selecionar Mandioca de/ })).toBeChecked();
  });
});
