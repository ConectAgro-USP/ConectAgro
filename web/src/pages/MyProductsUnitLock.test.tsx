import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
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
const LOCKED = "A unidade não muda depois que o produto recebeu interesse ou foi vendido.";
const REFUSED = "A unidade não pode mudar depois que o produto recebeu interesse ou foi vendido";

describe("MyProducts, locked unit", () => {
  it("keeps the unit of a product that already had interest or sales", async () => {
    renderProducts(productsResponse([{ ...orange, unit_locked: true }]));
    await press(await findCard("Laranja"), "Editar");

    const unit = screen.getByLabelText(UNIT);
    expect(unit).toBeDisabled();
    expect(unit).toHaveValue("kg");
    expect(unit).toHaveAccessibleDescription(LOCKED);
  });

  it("lets the unit change while the product has no interest or sales", async () => {
    renderProducts(productsResponse([orange]));
    await press(await findCard("Laranja"), "Editar");

    expect(screen.getByLabelText(UNIT)).toBeEnabled();
    expect(screen.queryByText(LOCKED)).not.toBeInTheDocument();
  });

  it("starts a new product with the unit free to choose", async () => {
    renderProducts(productsResponse([]));
    await openNewForm();

    expect(screen.getByLabelText(UNIT)).toBeEnabled();
  });

  it("shows the refusal of the API when the unit changed meanwhile", async () => {
    renderProducts(productsResponse([orange]), jsonResponse({ detail: REFUSED }, 409));
    await press(await findCard("Laranja"), "Editar");

    await userEvent.selectOptions(screen.getByLabelText(UNIT), "Dúzia");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(REFUSED);
    expect(screen.getByRole("heading", { name: "Editar produto" })).toBeInTheDocument();
  });
});
