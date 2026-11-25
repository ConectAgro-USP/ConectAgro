import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { farmerReviews, sampleProduct } from "../test/productDetail";
import { closedCalls, renderVisitorApp } from "../test/visitor";

const URL = "/produtos/prod-123";
const written = [
  {
    public_id: "avaliacao-1",
    rating: 5,
    comment: "Entregou no dia combinado",
    created_at: "2026-11-20T15:00:00Z",
    updated_at: null,
  },
];

async function openProduct(product: unknown = sampleProduct) {
  const view = renderVisitorApp(URL, { product, reviews: farmerReviews(written, 4.5, 2) });
  await screen.findByRole("heading", { name: "Mandioca Natural" });
  return view;
}

describe("product page for a visitor", () => {
  it("shows the product, the seller, the rating and the written reviews", async () => {
    const { fetchMock } = await openProduct();

    expect(document.querySelector("img")).toHaveAttribute("src", sampleProduct.picture_url);
    expect(screen.getByText("por quilo").parentElement).toHaveTextContent("R$ 20,00 por quilo");
    expect(screen.getByText("20/10/2099")).toBeVisible();
    expect(screen.getByText("25 kg disponíveis")).toBeVisible();
    expect(screen.getByText(/Mandioca orgânica plantada no sítio/)).toBeVisible();
    expect(screen.getByText("João Vikator")).toBeVisible();
    expect(await screen.findByText("Entregou no dia combinado")).toBeVisible();
    const seller = screen.getByText("Vendido por").parentElement!.parentElement!;
    expect(seller).toHaveTextContent("4,5 de 5 (2 avaliações)");
    expect(closedCalls(fetchMock)).toEqual([]);
  });

  it("offers the login in place of the quantity and the actions", async () => {
    await openProduct();

    const login = screen.getByRole("link", { name: "Entrar para pedir" });
    expect(login).toHaveAttribute("href", "/login?proximo=%2Fprodutos%2Fprod-123");
    expect(login).toHaveClass("bg-lime-800", "h-14");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Quantidade/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quero|Adicionar|carrinho/ })).toBeNull();
  });

  it("shows no WhatsApp contact", async () => {
    const { fetchMock } = await openProduct();
    await screen.findByText("Entregou no dia combinado");

    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.endsWith("/contact"))).toBe(false);
  });

  it("takes the visitor to the login and keeps the way back", async () => {
    await openProduct();

    await userEvent.click(screen.getByRole("link", { name: "Entrar para pedir" }));

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeVisible();
    expect(screen.getByTestId("address")).toHaveTextContent(
      "/login?proximo=%2Fprodutos%2Fprod-123",
    );
  });

  it("only shows the stock of a product that is not on sale", async () => {
    await openProduct({ ...sampleProduct, quantity: 0 });

    expect(screen.getByText("Indisponível")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Entrar para pedir" })).toBeNull();
  });
});
