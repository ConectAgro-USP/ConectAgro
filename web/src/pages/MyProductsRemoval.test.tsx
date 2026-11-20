import { waitFor, within } from "@testing-library/react";
import { jsonResponse } from "../test/helpers";
import { findCard, orange, press, renderProducts } from "../test/products";

const SOLD =
  "Este produto já foi vendido e não pode ser removido. Zere a quantidade para tirá-lo do catálogo";

describe("MyProducts removal", () => {
  it("asks inside the card before removing a product", async () => {
    const fetchMock = renderProducts(jsonResponse([orange]));
    const card = await findCard("Laranja");

    await press(card, "Remover");

    expect(within(card).getByText("Remover Laranja?")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("removes the product after the confirmation", async () => {
    const fetchMock = renderProducts(jsonResponse([orange]), new Response(null, { status: 204 }));
    const card = await findCard("Laranja");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(card).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/produto-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
  });

  it("explains inside the card why a sold product can't be removed", async () => {
    renderProducts(jsonResponse([orange]), jsonResponse({ detail: SOLD }, 409));
    const card = await findCard("Laranja");
    await press(card, "Remover");

    await press(card, "Remover");

    expect(await within(card).findByRole("alert")).toHaveTextContent(SOLD);
    expect(within(card).getByText("Remover Laranja?")).toBeInTheDocument();
  });

  it("goes back without removing and forgets the refusal", async () => {
    const fetchMock = renderProducts(jsonResponse([orange]), jsonResponse({ detail: SOLD }, 409));
    const card = await findCard("Laranja");
    await press(card, "Remover");
    await press(card, "Remover");
    await within(card).findByRole("alert");

    await press(card, "Voltar");
    expect(within(card).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    await press(card, "Remover");

    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
