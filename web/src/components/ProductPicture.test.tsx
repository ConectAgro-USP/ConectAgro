import { fireEvent, render } from "@testing-library/react";
import { ProductPicture } from "./ProductPicture";

describe("ProductPicture", () => {
  it("mostra a foto em 4:3, recortada e com fundo neutro enquanto carrega", () => {
    const { container } = render(
      <ProductPicture url="https://example.com/laranja.jpg" className="w-24" />,
    );

    const picture = container.querySelector("img")!;
    expect(picture).toHaveAttribute("src", "https://example.com/laranja.jpg");
    expect(picture).toHaveClass("aspect-4/3", "object-cover", "bg-stone-200", "w-24");
  });

  it("não deixa a linha esticar a foto e quebrar a proporção", () => {
    const { container } = render(<ProductPicture url={null} className="w-24" />);

    const placeholder = container.firstElementChild!;
    expect(placeholder).toHaveClass("aspect-4/3", "self-start");
    expect(placeholder.className).not.toMatch(/\bh-\d|self-stretch/);
  });

  it("mostra o broto quando a foto falta ou não abre", () => {
    const { container } = render(
      <ProductPicture url="https://example.com/quebrada.jpg" className="w-24" />,
    );

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    const placeholder = container.firstElementChild!;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveClass("aspect-4/3", "bg-stone-200");
    expect(placeholder.querySelector("svg")).toHaveClass("lucide-sprout");
  });
});
