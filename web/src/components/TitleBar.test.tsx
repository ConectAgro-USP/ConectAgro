import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { TitleBar, type Back } from "./TitleBar";

function renderBar(back?: Back) {
  render(
    <MemoryRouter>
      <TitleBar title="Meus produtos" back={back} />
    </MemoryRouter>,
  );
}

describe("TitleBar", () => {
  it("shows the title with no way back on a top level page", () => {
    renderBar();

    expect(screen.getByRole("heading", { level: 1, name: "Meus produtos" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("links back to the parent page", () => {
    renderBar({ to: "/avaliar", label: "Voltar às avaliações" });

    const back = screen.getByRole("link", { name: "Voltar às avaliações" });
    expect(back).toHaveAttribute("href", "/avaliar");
  });

  it("goes back to the list inside the same page", async () => {
    const onClick = vi.fn();
    renderBar({ onClick, label: "Voltar aos meus produtos" });

    await userEvent.click(screen.getByRole("button", { name: "Voltar aos meus produtos" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
