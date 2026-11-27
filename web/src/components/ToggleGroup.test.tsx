import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChip } from "./FilterChip";
import { ToggleGroup } from "./ToggleGroup";

const ORDERS = [
  { value: "near", label: "Mais próximos" },
  { value: "best", label: "Melhor avaliados" },
];

function renderGroup(changes: Partial<Parameters<typeof ToggleGroup<string>>[0]> = {}) {
  const onChange = vi.fn<(value: string) => void>();
  render(
    <ToggleGroup label="Ordem" options={ORDERS} value="best" onChange={onChange} {...changes} />,
  );
  return onChange;
}

describe("ToggleGroup", () => {
  it("names the group and presses the chosen option", async () => {
    const onChange = renderGroup();

    const group = screen.getByRole("group", { name: "Ordem" });
    expect(within(group).getByRole("button", { name: "Melhor avaliados" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(group).getByRole("button", { name: "Mais próximos" }));
    expect(onChange).toHaveBeenCalledWith("near");
  });

  it("keeps the name for screen readers when the label is hidden", () => {
    renderGroup({ hideLabel: true });

    expect(screen.getByRole("group", { name: "Ordem" })).toBeInTheDocument();
    expect(screen.queryByText("Ordem")).not.toBeInTheDocument();
  });

  it("turns every option off while disabled", () => {
    renderGroup({ disabled: true });

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});

describe("FilterChip", () => {
  it("says what it removes and removes it", async () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Busca: alface" onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover Busca: alface" }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
