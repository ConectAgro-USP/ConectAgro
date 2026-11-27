import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MyProduct } from "../api/products";
import { jsonResponse } from "../test/helpers";
import { countsOf, findCard, orange, productsResponse, renderProducts } from "../test/products";

const paused: MyProduct = { ...orange, public_id: "produto-2", name: "Couve", is_available: false };
const counts = countsOf([orange, paused]);
const failure = () => jsonResponse({ detail: "Erro interno" }, 500);

async function chooseFailingTab(label: RegExp, ...after: Response[]) {
  renderProducts(productsResponse([orange, paused]), failure(), ...after);
  await findCard("Laranja");
  await userEvent.click(screen.getByRole("button", { name: label }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno");
}

describe("MyProducts, a tab that fails to load", () => {
  it("does not say every product is on sale", async () => {
    await chooseFailingTab(/^Fora do catálogo/, productsResponse([paused], { counts }));

    expect(screen.queryByText("Todos os seus produtos estão à venda.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await findCard("Couve")).toBeInTheDocument();
  });

  it("does not say no product is on sale", async () => {
    await chooseFailingTab(/^Disponíveis/);

    expect(screen.queryByText("Nenhum produto à venda agora.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
