import { render, screen } from "@testing-library/react";
import { DangerButton, PrimaryButton, SecondaryButton } from "./Button";

describe("tamanho dos botões", () => {
  it("usa 56 px quando ninguém escolhe o tamanho", () => {
    render(
      <>
        <PrimaryButton>Salvar</PrimaryButton>
        <SecondaryButton>Voltar</SecondaryButton>
        <DangerButton>Remover</DangerButton>
      </>,
    );

    for (const name of ["Salvar", "Voltar", "Remover"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("h-14", "px-8");
      expect(button).not.toHaveClass("h-11");
    }
  });

  it("usa 44 px e menos espaço dos lados no tamanho compacto", () => {
    render(
      <>
        <PrimaryButton size="compact">Salvar</PrimaryButton>
        <SecondaryButton size="compact">Voltar</SecondaryButton>
        <DangerButton size="compact">Remover</DangerButton>
      </>,
    );

    for (const name of ["Salvar", "Voltar", "Remover"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("h-11", "px-5");
      expect(button).not.toHaveClass("h-14");
    }
  });

  it("mantém o tipo e as classes de quem chama", () => {
    render(
      <PrimaryButton size="compact" type="button" className="w-full">
        Editar
      </PrimaryButton>,
    );

    const button = screen.getByRole("button", { name: "Editar" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("w-full", "h-11");
    expect(button).not.toHaveAttribute("size");
  });
});
