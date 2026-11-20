import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import { orange, renderProducts, setDate } from "../test/products";

describe("MyProducts form", () => {
  it("creates a product with all fields and adds it to the list", async () => {
    const fetchMock = renderProducts(jsonResponse([]), jsonResponse(orange, 201));
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));

    await userEvent.type(screen.getByLabelText("Nome do produto"), "Laranja");
    await userEvent.type(screen.getByLabelText(/^Descrição/), "Laranja pera");
    await userEvent.type(screen.getByLabelText(/^URL da foto/), "https://example.com/laranja.png");
    await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "12");
    await userEvent.type(screen.getByLabelText("Preço (R$)"), "4.99");
    setDate("2030-10-25");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(sentBody(fetchMock, 1)).toEqual({
      name: "Laranja",
      description: "Laranja pera",
      picture_url: "https://example.com/laranja.png",
      quantity: 12,
      price: "4.99",
      expiration_date: "2030-10-25",
    });
  });

  it("updates the selected product", async () => {
    const changed = { ...orange, name: "Laranja doce", quantity: 8 };
    const fetchMock = renderProducts(jsonResponse([orange]), jsonResponse(changed));
    await userEvent.click(await screen.findByRole("button", { name: "Editar Laranja" }));
    await userEvent.clear(screen.getByLabelText("Nome do produto"));
    await userEvent.type(screen.getByLabelText("Nome do produto"), "Laranja doce");
    await userEvent.clear(screen.getByLabelText("Quantidade (kg)"));
    await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("heading", { name: "Laranja doce" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/produto-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toMatchObject({ name: "Laranja doce", quantity: 8 });
  });

  it("shows the backend message for an expired product in the form", async () => {
    renderProducts(
      jsonResponse([]),
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "expiration_date"],
              msg: "Value error, Não é possível cadastrar produto vencido",
            },
          ],
        },
        422,
      ),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));
    await userEvent.type(screen.getByLabelText("Nome do produto"), "Produto vencido");
    await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "1");
    await userEvent.type(screen.getByLabelText("Preço (R$)"), "2");
    setDate("2020-01-01");
    fireEvent.submit(screen.getByRole("heading", { name: "Cadastrar produto" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não é possível cadastrar produto vencido",
    );
    expect(screen.getByRole("heading", { name: "Cadastrar produto" })).toBeInTheDocument();
  });

  it("translates a negative price validation error into a form message", async () => {
    renderProducts(
      jsonResponse([]),
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "price"],
              msg: "Input should be greater than or equal to 0",
            },
          ],
        },
        422,
      ),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));
    await userEvent.type(screen.getByLabelText("Nome do produto"), "Laranja");
    await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "1");
    fireEvent.change(screen.getByLabelText("Preço (R$)"), { target: { value: "-2" } });
    setDate("2030-10-25");
    fireEvent.submit(screen.getByRole("heading", { name: "Cadastrar produto" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O preço deve ser não negativo e ter até 2 casas decimais",
    );
  });
});
