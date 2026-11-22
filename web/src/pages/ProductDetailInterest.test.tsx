import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { anaAsManager, fakeAuth, jsonResponse, sentBody, stubFetch } from "../test/helpers";
import { pageLoad, renderDetail, sampleProduct } from "../test/productDetail";

const interest = {
  public_id: "int-1",
  buyer_public_id: "buyer-1",
  product_public_id: "prod-123",
  product_name: "Mandioca Natural",
  product_status: "Disponível",
  quantity: 5,
  created_at: "2026-11-19T10:00:00Z",
  updated_at: null,
};

function renderProduct(...more: Response[]) {
  const fetchMock = stubFetch(...pageLoad(), ...more);
  renderDetail();
  return fetchMock;
}

describe("ProductDetail, interest", () => {
  it("lets the resident register interest in a quantity, only once", async () => {
    const fetchMock = renderProduct(jsonResponse(interest, 201));
    const quantity = await screen.findByLabelText("Quantidade");
    expect(quantity).toHaveValue("1");

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "5");
    await userEvent.click(screen.getByRole("button", { name: "Registrar interesse" }));

    expect(await screen.findByText("Interesse registrado com sucesso!")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe("/api/interests");
    expect(sentBody(fetchMock, 3)).toEqual({ product_public_id: "prod-123", quantity: 5 });
    expect(screen.getByRole("button", { name: "Registrar interesse" })).toBeDisabled();
    expect(quantity).toBeDisabled();
  });

  it("accepts only digits, up to the stock", async () => {
    renderProduct();
    const quantity = await screen.findByLabelText("Quantidade");
    const register = screen.getByRole("button", { name: "Registrar interesse" });
    expect(screen.getByText("Escolha uma quantidade de até 25 kg.")).toBeInTheDocument();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "2a5");
    expect(quantity).toHaveValue("25");
    expect(register).toBeEnabled();

    await userEvent.type(quantity, "0");
    expect(screen.getByRole("alert")).toHaveTextContent("excede o estoque disponível");
    expect(register).toBeDisabled();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "0");
    expect(register).toBeDisabled();
  });

  it("shows the API message when the interest fails", async () => {
    renderProduct(jsonResponse({ detail: "Interesse nesse produto já registrado" }, 409));

    await userEvent.click(await screen.findByRole("button", { name: "Registrar interesse" }));

    expect(await screen.findByText("Interesse nesse produto já registrado")).toBeInTheDocument();
  });

  it.each([
    ["unavailable", { quantity: 0, is_available: false }],
    ["expired", { expiration_date: "2020-01-01" }],
  ])("blocks the interest when the product is %s", async (_, changes) => {
    stubFetch(...pageLoad({ ...sampleProduct, ...changes }));

    renderDetail();

    expect(await screen.findByText("Indisponível")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Registrar interesse" })).toBeDisabled();
  });

  it("shows the stock to the manager, without the quantity or the interest", async () => {
    stubFetch(...pageLoad());

    renderDetail(fakeAuth({ user: anaAsManager }));

    expect(await screen.findByText("25 kg disponíveis")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar interesse" })).not.toBeInTheDocument();
  });
});
