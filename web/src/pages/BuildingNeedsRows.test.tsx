import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { alface, mandioca, renderNeeds, soldOutAlface } from "../test/needs";

async function findRow(name: string): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { name })).closest("li")!;
}

describe("BuildingNeeds rows", () => {
  it("selects the need by a click anywhere on the row", async () => {
    renderNeeds(jsonResponse([mandioca, alface]));
    const row = await findRow("Mandioca");
    const checkbox = within(row).getByRole("checkbox");

    await userEvent.click(within(row).getByText("12 kg no total, de 3 moradores interessados"));
    expect(checkbox).toBeChecked();
    await userEvent.click(within(row).getByRole("heading", { name: "Mandioca" }));

    expect(checkbox).not.toBeChecked();
  });

  it("shows the picture, the price, the stock and the estimated cost", async () => {
    renderNeeds(jsonResponse([mandioca, alface]));

    const row = await findRow("Mandioca");
    expect(row.querySelector("img")).toHaveAttribute("src", "https://example.com/mandioca.jpg");
    expect(row).toHaveTextContent("R$ 20,00 por kg, 25 kg disponíveis");
    expect(row).toHaveTextContent("Custo estimado R$ 240,00");
    const lettuce = await findRow("Alface");
    expect(lettuce).toHaveTextContent("R$ 3,50 por kg, 4 kg disponíveis");
    expect(lettuce).toHaveTextContent("Custo estimado R$ 17,50");
  });

  it("links each row to its product, without selecting it", async () => {
    renderNeeds(jsonResponse([mandioca]));
    const row = await findRow("Mandioca");

    const link = within(row).getByRole("link", { name: "Ver o produto Mandioca" });

    expect(link).toHaveAttribute("href", "/produtos/produto-1");
    expect(link.closest("label")).toBeNull();
  });

  it("keeps a sold out need disabled, even when its row is clicked", async () => {
    renderNeeds(jsonResponse([mandioca, soldOutAlface]));
    const row = await findRow("Alface");
    const checkbox = within(row).getByRole("checkbox");

    await userEvent.click(within(row).getByRole("heading", { name: "Alface" }));

    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAccessibleDescription("Sem estoque");
    expect(screen.queryByRole("region", { name: "Seleção" })).not.toBeInTheDocument();
  });
});
