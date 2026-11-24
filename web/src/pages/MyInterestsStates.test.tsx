import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Interest } from "../api/interests";
import { jsonResponse, sentBody } from "../test/helpers";
import { findCard, interestsResponse, mandioca, renderInterests } from "../test/interests";
import { press } from "../test/products";
import { delivered, inPurchase } from "../test/productInterest";

const QUANTITY = "Quantidade (kg)";
const IN_PURCHASE = "Incluído na compra de 20/11, entrega prevista 27/11";
const bought: Interest = { ...mandioca, purchase: inPurchase.purchase };
const received: Interest = { ...mandioca, purchase: delivered.purchase };

describe("MyInterests, states of the interest", () => {
  it("shows an interest in a purchase without editing, but removable", async () => {
    renderInterests(interestsResponse([bought]));

    const card = await findCard("Mandioca");
    expect(card).toHaveTextContent(IN_PURCHASE);
    expect(card).toHaveTextContent("5 kg");
    expect(within(card).getByText("Na compra do prédio")).toBeInTheDocument();
    expect(within(card).queryByLabelText(QUANTITY)).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Remover" })).toBeEnabled();
  });

  it("explains what the removal does to an interest in a purchase", async () => {
    renderInterests(interestsResponse([bought]));
    const card = await findCard("Mandioca");

    await press(card, "Remover");

    expect(card).toHaveTextContent("A compra do prédio continua");
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
  });

  it("orders a delivered interest again, which reopens it", async () => {
    const reopened = { ...mandioca, quantity: 2 };
    const fetchMock = renderInterests(interestsResponse([received]), jsonResponse(reopened));
    const card = await findCard("Mandioca");
    expect(card).toHaveTextContent("Entregue em 25/11");
    expect(within(card).getByText("Entregue")).toBeInTheDocument();
    const field = within(card).getByLabelText(QUANTITY);
    await userEvent.clear(field);
    await userEvent.type(field, "2");

    await press(card, "Pedir de novo");

    expect(await within(card).findByText("Interesse registrado de novo")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({ quantity: 2, unit: "kg" });
    expect(within(card).getByText("Disponível")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Remover" })).toBeEnabled();
  });

  it("orders again with the same quantity", async () => {
    renderInterests(interestsResponse([received]));

    const card = await findCard("Mandioca");

    expect(within(card).getByRole("button", { name: "Pedir de novo" })).toBeEnabled();
  });

  it("keeps a delivered interest only removable when the product is off sale", async () => {
    renderInterests(interestsResponse([{ ...received, product_status: "Indisponível" }]));

    const card = await findCard("Mandioca");

    expect(card).toHaveTextContent("Entregue em 25/11. O produto não está à venda agora.");
    expect(within(card).queryByRole("button", { name: "Pedir de novo" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Remover" })).toBeEnabled();
  });

  it("rereads the list when the interest joined a purchase meanwhile", async () => {
    const refusal = jsonResponse({ detail: "Este interesse já está numa compra do prédio" }, 409);
    renderInterests(interestsResponse([mandioca]), refusal, interestsResponse([bought]));
    const card = await findCard("Mandioca");
    const field = within(card).getByLabelText(QUANTITY);
    await userEvent.clear(field);
    await userEvent.type(field, "8");

    await press(card, "Salvar");

    expect(await within(card).findByRole("alert")).toHaveTextContent("numa compra do prédio");
    expect(await within(card).findByText(IN_PURCHASE)).toBeInTheDocument();
    expect(within(card).queryByLabelText(QUANTITY)).not.toBeInTheDocument();
  });
});
