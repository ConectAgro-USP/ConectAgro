import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MyProduct } from "../api/products";
import { jsonResponse, sentBody } from "../test/helpers";
import {
  findCard,
  openNewForm,
  orange,
  press,
  productsResponse,
  renderProducts,
  save,
} from "../test/products";

const UNIT = "Vendido por";
const eggs: MyProduct = {
  ...orange,
  public_id: "produto-2",
  name: "Ovos caipiras",
  quantity: 4,
  price: "12.00",
  unit: "duzia",
};

describe("MyProducts, unit of sale", () => {
  it("starts a new product sold by the kilo", async () => {
    renderProducts(productsResponse([]));
    await openNewForm();

    expect(screen.getByLabelText(UNIT)).toHaveValue("kg");
    expect(screen.getByRole("option", { name: "Quilo (kg)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Preço por quilo (R$)")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade (kg)")).toBeInTheDocument();
  });

  it("offers each unit the API accepts", async () => {
    renderProducts(productsResponse([]));
    await openNewForm();

    const options = screen.getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(options).toEqual(["kg", "unidade", "duzia", "maco", "litro"]);
  });

  it("changes the labels with the unit and sends it with the new product", async () => {
    const fetchMock = renderProducts(productsResponse([]), jsonResponse(eggs, 201));
    await openNewForm();

    await userEvent.selectOptions(screen.getByLabelText(UNIT), "Dúzia");
    await userEvent.type(screen.getByLabelText("Nome do produto"), "Ovos caipiras");
    await userEvent.type(screen.getByLabelText("Preço por dúzia (R$)"), "12.5");
    await userEvent.type(screen.getByLabelText("Quantidade (dúzias)"), "4");
    fireEvent.change(screen.getByLabelText("Data de vencimento"), {
      target: { value: "2030-10-25" },
    });
    await save();

    await findCard("Ovos caipiras");
    expect(sentBody(fetchMock, 1)).toMatchObject({ unit: "duzia", price: "12.5", quantity: 4 });
  });

  it("opens the product with its unit and sends the one chosen on edit", async () => {
    const bunches = { ...eggs, unit: "maco" as const };
    const fetchMock = renderProducts(productsResponse([eggs]), jsonResponse(bunches));
    await press(await findCard("Ovos caipiras"), "Editar");

    expect(screen.getByLabelText(UNIT)).toHaveValue("duzia");
    expect(screen.getByLabelText("Quantidade (dúzias)")).toHaveValue(4);
    await userEvent.selectOptions(screen.getByLabelText(UNIT), "Maço");
    await save();

    await findCard("Ovos caipiras");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toMatchObject({ unit: "maco" });
  });

  it("shows the stock and the price of each card in its unit", async () => {
    renderProducts(productsResponse([orange, eggs]));

    expect(await findCard("Ovos caipiras")).toHaveTextContent("Estoque: 4 dúzias");
    expect(await findCard("Ovos caipiras")).toHaveTextContent("Valor R$ 12,00 por dúzia");
    expect(await findCard("Laranja")).toHaveTextContent("Estoque: 12 kg");
    expect(await findCard("Laranja")).toHaveTextContent("Valor R$ 4,99 por quilo");
  });
});
