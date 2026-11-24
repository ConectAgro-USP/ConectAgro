import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import { findCard, orange, press, productsResponse, renderProducts } from "../test/products";

const LINK = /^Link para a imagem/;

async function openNewForm() {
  await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));
}

async function fillRequired(name: string) {
  await userEvent.type(screen.getByLabelText("Nome do produto"), name);
  await userEvent.type(screen.getByLabelText("Preço por quilo (R$)"), "4.99");
  await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "12");
  fireEvent.change(screen.getByLabelText("Data de vencimento"), {
    target: { value: "2030-10-25" },
  });
}

function refusal(field: string, msg: string): Response {
  return jsonResponse({ detail: [{ loc: ["body", field], msg }] }, 422);
}

describe("MyProducts form", () => {
  it("creates a product with all fields and shows it in the list", async () => {
    const fetchMock = renderProducts(productsResponse([]), jsonResponse(orange, 201));
    await openNewForm();

    expect(screen.getByRole("heading", { name: "Cadastrar produto" })).toHaveFocus();
    await userEvent.type(screen.getByLabelText(LINK), "https://example.com/laranja.png");
    await fillRequired("Laranja");
    await userEvent.type(screen.getByLabelText(/^Descrição/), "Laranja pera");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await findCard("Laranja")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(sentBody(fetchMock, 1)).toEqual({
      name: "Laranja",
      description: "Laranja pera",
      picture_url: "https://example.com/laranja.png",
      quantity: 12,
      price: "4.99",
      unit: "kg",
      expiration_date: "2030-10-25",
    });
  });

  it("adds the new product at the end of the list, in the API's order", async () => {
    const cassava = { ...orange, public_id: "produto-2", name: "Mandioca" };
    renderProducts(productsResponse([orange]), jsonResponse(cassava, 201));
    await openNewForm();
    await fillRequired("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await findCard("Mandioca");
    const names = screen.getAllByRole("heading", { level: 2 }).map((title) => title.textContent);
    expect(names).toEqual(["Laranja", "Mandioca"]);
  });

  it("opens the product's data for editing and saves the changes", async () => {
    const changed = { ...orange, name: "Laranja doce" };
    const fetchMock = renderProducts(productsResponse([orange]), jsonResponse(changed));
    await press(await findCard("Laranja"), "Editar");

    expect(screen.getByRole("heading", { name: "Editar produto" })).toHaveFocus();
    expect(screen.getByLabelText("Quantidade (kg)")).toHaveValue(12);
    expect(screen.getByLabelText("Data de vencimento")).toHaveValue("2030-10-25");
    await userEvent.clear(screen.getByLabelText("Nome do produto"));
    await userEvent.type(screen.getByLabelText("Nome do produto"), "Laranja doce");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await findCard("Laranja doce")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/produto-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toMatchObject({ name: "Laranja doce", quantity: 12 });
  });

  it("previews the picture once the farmer leaves the link", async () => {
    renderProducts(productsResponse([]));
    await openNewForm();
    await userEvent.type(screen.getByLabelText(LINK), "https://example.com/quebrada.png");
    expect(document.querySelector("form img")).not.toBeInTheDocument();
    await userEvent.tab();
    fireEvent.error(document.querySelector("form img")!);

    await userEvent.clear(screen.getByLabelText(LINK));
    await userEvent.type(screen.getByLabelText(LINK), "https://example.com/laranja.png");
    await userEvent.tab();

    expect(document.querySelector("form img")).toHaveAttribute("src", orange.picture_url);
  });

  it("goes back to the list without saving", async () => {
    const fetchMock = renderProducts(productsResponse([orange]));
    await press(await findCard("Laranja"), "Editar");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await findCard("Laranja")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "expiration_date",
      "Value error, Não é possível cadastrar produto vencido",
      "Não é possível cadastrar produto vencido",
    ],
    [
      "price",
      "Input should be greater than or equal to 0",
      "O preço deve ser não negativo e ter até 2 casas decimais",
    ],
  ])("shows in the form why the API refused the %s", async (field, msg, message) => {
    renderProducts(productsResponse([]), refusal(field, msg));
    await openNewForm();
    await fillRequired("Laranja");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("heading", { name: "Cadastrar produto" })).toBeInTheDocument();
  });
});
