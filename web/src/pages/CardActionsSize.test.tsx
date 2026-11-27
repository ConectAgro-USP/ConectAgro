import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { pageResponse } from "../test/helpers";
import {
  findCard as findInterest,
  interestsResponse,
  mandioca,
  renderInterests,
} from "../test/interests";
import {
  findCard as findProduct,
  orange,
  productsResponse,
  renderProducts,
} from "../test/products";
import { findCard as findResident, renderResidents, tita } from "../test/residents";
import { findCard as findSale, pageOf, pendingSale, renderSales } from "../test/sales";

function expectCompact(card: HTMLElement, names: string[]) {
  for (const name of names) {
    expect(within(card).getByRole("button", { name })).toHaveClass("h-11");
  }
}

describe("ações dentro dos cartões", () => {
  it("usa botões compactos no cartão do produto e na confirmação", async () => {
    renderProducts(productsResponse([orange]));

    const card = await findProduct("Laranja");
    expectCompact(card, ["Remover", "Editar"]);

    await userEvent.click(within(card).getByRole("button", { name: "Remover" }));
    expectCompact(card, ["Voltar", "Remover"]);
  });

  it("usa botões compactos nas ações da venda", async () => {
    renderSales(pageOf(pendingSale));

    const card = await findSale(pendingSale.building_name);
    expectCompact(card, ["Cancelar venda", "Marcar como entregue"]);

    await userEvent.click(within(card).getByRole("button", { name: "Cancelar venda" }));
    expectCompact(card, ["Cancelar venda", "Voltar"]);
  });

  it("usa botões compactos no pedido do morador", async () => {
    renderResidents(pageResponse([tita]));

    const card = await findResident("Tita Russell");
    expectCompact(card, ["Recusar", "Aprovar"]);
  });

  it("usa botões compactos no interesse, com o campo da mesma altura", async () => {
    renderInterests(interestsResponse([mandioca]));

    const card = await findInterest("Mandioca");
    expectCompact(card, ["Salvar", "Remover"]);
    expect(within(card).getByRole("textbox", { name: "Quantidade (kg)" })).toHaveClass("h-11");
  });
});
