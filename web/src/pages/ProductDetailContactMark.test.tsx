import { screen } from "@testing-library/react";
import { anaAsManager, fakeAuth, jsonResponse, stubFetch } from "../test/helpers";
import {
  emptyReviews,
  managerContact,
  pageLoad,
  renderDetail,
  sampleProduct,
} from "../test/productDetail";

function expectWhatsAppMark(contact: HTMLElement) {
  const icons = contact.querySelectorAll("svg");
  expect(icons).toHaveLength(1);
  expect(icons[0]).toHaveAttribute("aria-hidden", "true");
  expect(icons[0]).not.toHaveClass("lucide-message-circle");
}

describe("ProductDetail, botão do WhatsApp", () => {
  it("fala com o síndico num botão secundário com a marca do WhatsApp", async () => {
    stubFetch(...pageLoad());

    renderDetail();

    const link = await screen.findByRole("link", { name: "Falar com o síndico" });
    expectWhatsAppMark(link);
    expect(link).toHaveClass("border", "bg-white");
    expect(link).not.toHaveClass("bg-stone-800");
  });

  it("deixa o verde só para Registrar interesse", async () => {
    stubFetch(...pageLoad());

    renderDetail();

    await screen.findByRole("link", { name: "Falar com o síndico" });
    const primary = screen.getByRole("button", { name: "Registrar interesse" });
    expect(primary).toHaveClass("bg-lime-800");
    expect(screen.getAllByRole("button").filter((b) => b.className.includes("bg-lime-"))).toEqual(
      [primary],
    );
  });

  it("mantém a marca e o aviso quando o agricultor não tem telefone", async () => {
    stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse({ ...managerContact, cellphone: null }),
      jsonResponse(emptyReviews),
    );

    renderDetail(fakeAuth({ user: anaAsManager }));

    expect(
      await screen.findByText("O agricultor ainda não cadastrou um telefone."),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Falar com o agricultor" });
    expect(button).toBeDisabled();
    expectWhatsAppMark(button);
  });
});
