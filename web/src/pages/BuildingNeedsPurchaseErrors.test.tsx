import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { fillDeliveryDate, mandioca, openPurchase, renderNeeds } from "../test/needs";

const PAST_DATE = {
  detail: [
    {
      type: "value_error",
      loc: ["body", "expected_delivery_date"],
      msg: "Value error, A data prevista de entrega não pode estar no passado",
    },
  ],
};

describe("BuildingNeeds purchase errors", () => {
  it.each([
    [
      "the product expired",
      jsonResponse({ detail: "O produto Mandioca está vencido e não pode ser comprado" }, 409),
      "O produto Mandioca está vencido e não pode ser comprado",
    ],
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
    renderNeeds(jsonResponse([mandioca]), response);
    await openPurchase("Mandioca");
    fillDeliveryDate("2026-12-01");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("heading", { name: "Fechar compra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
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
});
