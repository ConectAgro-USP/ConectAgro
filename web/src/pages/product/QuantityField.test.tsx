import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityField } from "./QuantityField";

const EXCEEDS = "A quantidade informada excede o estoque disponível.";

function renderField(changes: Partial<Parameters<typeof QuantityField>[0]> = {}) {
  const onChange = vi.fn<(value: string) => void>();
  render(
    <QuantityField
      stock="Estoque: 25 kg"
      value="1"
      disabled={false}
      hint="Escolha uma quantidade de até 25 kg."
      exceeds={false}
      onChange={onChange}
      {...changes}
    />,
  );
  return onChange;
}

describe("QuantityField", () => {
  it("shows the stock and the hint next to the quantity", () => {
    renderField();

    const field = screen.getByLabelText("Quantidade");
    expect(field).toHaveValue("1");
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText("Estoque: 25 kg")).toBeVisible();
    expect(screen.getByText("Escolha uma quantidade de até 25 kg.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("passes on digits and ignores the rest", async () => {
    const onChange = renderField({ value: "" });

    await userEvent.type(screen.getByLabelText("Quantidade"), "4a");

    expect(onChange.mock.calls).toEqual([["4"]]);
  });

  it("warns when the quantity is above the stock", () => {
    renderField({ value: "30", exceeds: true });

    expect(screen.getByRole("alert")).toHaveTextContent(EXCEEDS);
  });

  it("hides the hint of a product that cannot be chosen", () => {
    renderField({ hint: null, disabled: true, value: "" });

    expect(screen.getByLabelText("Quantidade")).toBeDisabled();
    expect(screen.queryByText(/Escolha uma quantidade/)).not.toBeInTheDocument();
  });
});
