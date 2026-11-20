import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { orange, renderProducts } from "../test/products";

describe("MyProducts removal", () => {
  it("requires confirmation before removing a product", async () => {
    const fetchMock = renderProducts(jsonResponse([orange]), new Response(null, { status: 204 }));
    await userEvent.click(await screen.findByRole("button", { name: "Remover Laranja" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Tem certeza");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Laranja" })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/produto-1");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
  });
});
