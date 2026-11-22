import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import {
  alface,
  fillDeliveryDate,
  groupOf,
  laranja,
  mandioca,
  openPurchase,
  renderNeeds,
  soldOutAlface,
} from "../test/needs";

const JOAO = "João Vikator, Sítio LabXP";

function quantityOf(name: string, group = document.body): HTMLElement {
  return within(group).getByRole("spinbutton", { name: `Quantidade de ${name} em kg` });
}

describe("BuildingNeeds purchase", () => {
  it("groups the selected products by farmer, with subtotals and the total", async () => {
    renderNeeds(jsonResponse([mandioca, alface, laranja]));
    await openPurchase("Mandioca", "Alface", "Laranja");

    expect(screen.getByRole("heading", { name: "Fechar compra" })).toHaveFocus();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const joao = groupOf(JOAO);
    expect(quantityOf("Mandioca", joao)).toHaveValue(12);
    expect(quantityOf("Mandioca").closest("li")).toHaveTextContent(
      /Mandioca\s*R\$ 240,00\s*kg × R\$ 20,00/,
    );
    expect(quantityOf("Alface", joao)).toHaveValue(4);
    expect(quantityOf("Alface")).toHaveAccessibleDescription("4 kg disponíveis");
    expect(joao).toHaveTextContent(/Subtotal\s*R\$ 254,00/);
    const maria = groupOf("Maria F.");
    expect(quantityOf("Laranja", maria)).toHaveValue(1);
    expect(maria).not.toHaveTextContent("Subtotal");
    expect(document.body).toHaveTextContent(/Total\s*R\$ 258,50/);
  });

  it("updates the subtotals and the total as the quantities change", async () => {
    renderNeeds(jsonResponse([mandioca, alface, laranja]));
    await openPurchase("Mandioca", "Alface", "Laranja");

    await userEvent.clear(quantityOf("Mandioca"));
    await userEvent.type(quantityOf("Mandioca"), "10");

    expect(groupOf(JOAO)).toHaveTextContent(/Subtotal\s*R\$ 214,00/);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 218,50/);
    await userEvent.clear(quantityOf("Mandioca"));
    expect(groupOf(JOAO)).toHaveTextContent(/Subtotal\s*R\$ 14,00/);
    expect(document.body).toHaveTextContent(/Total\s*R\$ 18,50/);
  });

  it("sends the purchase and opens the purchases of the building", async () => {
    const fetchMock = renderNeeds(
      jsonResponse([mandioca, alface, laranja]),
      jsonResponse({ public_id: "compra-1" }, 201),
    );
    await openPurchase("Mandioca", "Alface", "Laranja");

    fillDeliveryDate("2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(await screen.findByRole("heading", { name: "Compras do prédio" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/purchases");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(sentBody(fetchMock, 1)).toEqual({
      expected_delivery_date: "2026-12-01",
      items: [
        { product_public_id: "produto-1", quantity: 12, unit_price: "20.00" },
        { product_public_id: "produto-2", quantity: 4, unit_price: "3.50" },
        { product_public_id: "produto-3", quantity: 1, unit_price: "4.50" },
      ],
    });
  });

  it("goes back to the list with the same selection", async () => {
    renderNeeds(jsonResponse([mandioca, alface, laranja]));
    await openPurchase("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("checkbox", { name: /^Selecionar Mandioca de/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Fechar compra" })).toBeVisible();
  });

  it("waits for the delivery date before sending", async () => {
    const fetchMock = renderNeeds(jsonResponse([mandioca]));
    await openPurchase("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    expect(screen.getByLabelText("Entrega prevista")).toBeInvalid();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("gives a product that rejoins the purchase its starting quantity", async () => {
    const lowStockMandioca = { ...mandioca, product: { ...mandioca.product, quantity: 10 } };
    renderNeeds(
      jsonResponse([mandioca, alface]),
      jsonResponse([soldOutAlface, mandioca]),
      jsonResponse({ detail: "O produto Mandioca não tem a quantidade pedida" }, 409),
      jsonResponse([alface, lowStockMandioca]),
    );
    await userEvent.click(await screen.findByRole("checkbox", { name: /^Selecionar Alface de/ }));
    await userEvent.click(screen.getByRole("button", { name: "Menor primeiro" }));
    await screen.findByText("Sem estoque");
    await openPurchase("Mandioca");
    fillDeliveryDate("2026-12-01");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));

    await waitFor(() => expect(quantityOf("Alface")).toHaveValue(4));
    expect(document.body).toHaveTextContent(/Total\s*R\$ 254,00/);
    expect(document.body).not.toHaveTextContent("NaN");
  });
});
