import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import {
  alface,
  fillDeliveryDate,
  laranja,
  mandioca,
  openPurchase,
  renderNeeds,
  renderNeedsWithSlowPurchases,
  soldOutAlface,
} from "../test/needs";

const PAST_DATE = {
  detail: [
    {
      type: "value_error",
      loc: ["body", "expected_delivery_date"],
      msg: "Value error, A data prevista de entrega não pode estar no passado",
    },
  ],
};
const UNAVAILABLE = "O produto Mandioca está indisponível e não pode ser comprado";
const PRICE_CHANGED = "O preço do produto Mandioca mudou, confira o resumo da compra";

describe("BuildingNeeds purchase errors", () => {
  it.each([
    [
      "the product expired",
      jsonResponse({ detail: "O produto Mandioca está vencido e não pode ser comprado" }, 409),
      "O produto Mandioca está vencido e não pode ser comprado",
    ],
    ["the product is unavailable", jsonResponse({ detail: UNAVAILABLE }, 409), UNAVAILABLE],
    ["the price changed", jsonResponse({ detail: PRICE_CHANGED }, 409), PRICE_CHANGED],
    [
      "the stock is short",
      jsonResponse({ detail: "O produto Mandioca não tem a quantidade pedida" }, 409),
      "O produto Mandioca não tem a quantidade pedida",
    ],
    [
      "the date is past",
      jsonResponse(PAST_DATE, 422),
      "A data prevista de entrega não pode estar no passado",
    ],
  ])("shows the API message when %s", async (_case, response, message) => {
    renderNeeds(jsonResponse([mandioca]), response, jsonResponse([mandioca]));
    await openPurchase("Mandioca");
    fillDeliveryDate("2026-12-01");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("heading", { name: "Fechar compra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
  });

  it("loads the needs again after a refusal, with the current price and stock", async () => {
    const pricier = { ...mandioca, product: { ...mandioca.product, price: "22.00" } };
    const fetchMock = renderNeeds(
      jsonResponse([mandioca, alface]),
      jsonResponse({ detail: PRICE_CHANGED }, 409),
      jsonResponse([pricier, soldOutAlface]),
    );
    await openPurchase("Mandioca", "Alface");
    fillDeliveryDate("2026-12-01");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByText("kg × R$ 22,00")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(PRICE_CHANGED);
    expect(screen.queryByLabelText("Quantidade de Alface em kg")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Total\s*R\$ 264,00/);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/apartments/me/needs?descending=true");
  });

  it("closes the purchase and blocks the need when its stock runs out", async () => {
    renderNeeds(
      jsonResponse([mandioca, alface]),
      jsonResponse({ detail: "O produto Alface não tem a quantidade pedida" }, 409),
      jsonResponse([mandioca, soldOutAlface]),
    );
    await openPurchase("Alface");
    fillDeliveryDate("2026-12-01");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    const soldOut = await screen.findByRole("checkbox", { name: /^Selecionar Alface de/ });
    expect(soldOut).toBeDisabled();
    expect(soldOut).not.toBeChecked();
    expect(soldOut).toHaveAccessibleDescription("Sem estoque");
    expect(screen.queryByRole("heading", { name: "Fechar compra" })).not.toBeInTheDocument();
  });

  it("keeps the purchase closed after every selected need sells out", async () => {
    const soldOutMandioca = { ...mandioca, product: { ...mandioca.product, quantity: 0 } };
    renderNeeds(
      jsonResponse([mandioca, alface, laranja]),
      jsonResponse({ detail: "O produto Mandioca não tem a quantidade pedida" }, 409),
      jsonResponse([soldOutMandioca, soldOutAlface, laranja]),
    );
    await openPurchase("Mandioca", "Alface");
    fillDeliveryDate("2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
    const laranjaBox = await screen.findByRole("checkbox", { name: /^Selecionar Laranja de/ });

    await userEvent.click(laranjaBox);

    expect(laranjaBox).toBeChecked();
    expect(screen.queryByRole("heading", { name: "Fechar compra" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar compra" })).toBeVisible();
  });

  it("sends the purchase only once while it is on its way", async () => {
    const fetchMock = renderNeeds(jsonResponse([mandioca]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    await openPurchase("Mandioca");
    fillDeliveryDate("2026-12-01");
    const confirmButton = screen.getByRole("button", { name: "Confirmar compra" });

    await userEvent.click(confirmButton);
    await userEvent.click(confirmButton);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Confirmando..." })).toBeDisabled();
  });

  it("keeps the form blocked after the purchase is accepted", async () => {
    const fetchMock = renderNeedsWithSlowPurchases(jsonResponse([mandioca]));
    let accept: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (accept = resolve)));
    await openPurchase("Mandioca");
    fillDeliveryDate("2026-12-01");
    const confirmButton = screen.getByRole("button", { name: "Confirmar compra" });
    await userEvent.click(confirmButton);

    await act(async () => accept(jsonResponse({ public_id: "compra-1" }, 201)));
    await userEvent.click(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
