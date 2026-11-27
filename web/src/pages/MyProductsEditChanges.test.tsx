import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import { findCard, orange, press, productsResponse, renderProducts, save } from "../test/products";

async function changeAndSave(label: string, value: string) {
  const fetchMock = renderProducts(productsResponse([orange]), jsonResponse(orange));
  await press(await findCard("Laranja"), "Editar");
  await userEvent.clear(screen.getByLabelText(label));
  await userEvent.type(screen.getByLabelText(label), value);

  await save();

  await findCard("Laranja");
  expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  return sentBody(fetchMock, 1);
}

describe("MyProducts, editing a product", () => {
  it("leaves the stock out when only the price changed", async () => {
    // uma compra pode ter baixado o estoque desde que o formulário abriu
    expect(await changeAndSave("Preço por quilo (R$)", "5.75")).toEqual({ price: "5.75" });
  });

  it("sends the stock the farmer changed", async () => {
    expect(await changeAndSave("Quantidade (kg)", "8")).toEqual({ quantity: 8 });
  });
});
