import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { alface, fillDeliveryDate, mandioca, openPurchase, renderNeeds } from "../test/needs";

const NOT_NEEDED = "O produto Mandioca não está nas necessidades do prédio";

async function refuseMandioca(reloadedNeeds: Response) {
  renderNeeds(
    jsonResponse([mandioca, alface]),
    jsonResponse({ detail: NOT_NEEDED }, 409),
    reloadedNeeds,
  );
  await openPurchase("Mandioca");
  fillDeliveryDate("2026-12-01");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
}

describe("BuildingNeeds refusal", () => {
  it("keeps the refusal on the list when the refused product leaves the needs", async () => {
    await refuseMandioca(jsonResponse([alface]));

    expect(await screen.findByRole("checkbox", { name: /^Selecionar Alface de/ })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(NOT_NEEDED);
    expect(screen.queryByRole("heading", { name: "Fechar compra" })).not.toBeInTheDocument();
  });

  it("clears the refusal when the purchase is opened again", async () => {
    await refuseMandioca(jsonResponse([alface]));
    await screen.findByRole("checkbox", { name: /^Selecionar Alface de/ });

    await openPurchase("Alface");

    expect(screen.getByRole("heading", { name: "Fechar compra" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaves the refusal behind when the manager goes back to the list", async () => {
    await refuseMandioca(jsonResponse([mandioca, alface]));
    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_NEEDED);

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("checkbox", { name: /^Selecionar Mandioca de/ })).toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
