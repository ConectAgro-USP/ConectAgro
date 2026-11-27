import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { NotFound } from "../pages/NotFound";
import { PrimaryButton, SecondaryButton } from "./Button";
import { buttonClasses } from "./buttonClasses";

describe("buttonClasses", () => {
  it("gives the buttons their size and colors", () => {
    render(
      <>
        <PrimaryButton>Salvar</PrimaryButton>
        <SecondaryButton size="compact">Editar</SecondaryButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass(
      ...buttonClasses("primary").split(" "),
    );
    expect(screen.getByRole("button", { name: "Editar" })).toHaveClass("h-11", "px-5", "border");
  });

  it("gives a link that looks like a button the same classes", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    const link = screen.getAllByRole("link").at(-1)!;
    expect(link).toHaveClass(...buttonClasses("primary").split(" "));
  });
});
