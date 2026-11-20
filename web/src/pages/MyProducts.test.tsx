import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findCard, orange, renderProducts } from "../test/products";

describe("MyProducts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the farmer's products with picture, stock, price and expiration", async () => {
    const fetchMock = renderProducts(jsonResponse([orange]));

    const card = await findCard("Laranja");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/me");
    expect(card.querySelector("img")).toHaveAttribute("src", orange.picture_url);
    expect(card).toHaveTextContent("Estoque: 12 kg");
    expect(card).toHaveTextContent("Valor R$ 4,99");
    expect(card).toHaveTextContent("Vence 25/10/2030");
  });

  it("turns the tab amber a week before the expiration and says Venceu after it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // ainda é 20 de novembro em Brasília
    vi.setSystemTime(new Date("2026-11-21T02:00:00Z"));
    renderProducts(
      jsonResponse([
        { ...orange, public_id: "a", name: "Vencida", expiration_date: "2026-11-19" },
        { ...orange, public_id: "b", name: "Em uma semana", expiration_date: "2026-11-27" },
        { ...orange, public_id: "c", name: "Em oito dias", expiration_date: "2026-11-28" },
      ]),
    );

    expect(await screen.findByText("Venceu 19/11/2026")).toHaveClass("bg-amber-700");
    expect(screen.getByText("Vence 27/11/2026")).toHaveClass("bg-amber-700");
    expect(screen.getByText("Vence 28/11/2026")).toHaveClass("bg-lime-700");
  });

  it("tells the farmer when there are no products yet", async () => {
    renderProducts(jsonResponse([]));

    expect(await screen.findByText("Você ainda não cadastrou produtos.")).toBeInTheDocument();
  });

  it("lets the farmer try again when the list does not load", async () => {
    const fetchMock = renderProducts(new Response("", { status: 500 }), jsonResponse([orange]));

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await findCard("Laranja")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("restricts the route to farmers", async () => {
    const fetchMock = stubFetch();
    renderWithAuth(<App />, fakeAuth({ user: anaAsManager }), "/meus-produtos");

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
