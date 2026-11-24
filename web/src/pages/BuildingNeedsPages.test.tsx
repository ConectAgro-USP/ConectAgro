import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { item, storedCart } from "../test/cart";
import { jsonResponse, pageResponse } from "../test/helpers";
import { laranja, mandioca, renderNeeds } from "../test/needs";

const MORE = { name: "Mostrar mais produtos" };
const FIRST = { total: 21, total_pages: 2 };
const SECOND = { page: 2, total: 21, total_pages: 2 };

async function select(name: string) {
  const box = await screen.findByRole("checkbox", { name: new RegExp(`^Selecionar ${name} de`) });
  await userEvent.click(box);
}

describe("BuildingNeeds, pages", () => {
  beforeEach(() => localStorage.clear());

  it("shows the next page in the same order below the first one", async () => {
    const fetchMock = renderNeeds(
      pageResponse([mandioca], FIRST),
      pageResponse([laranja], SECOND),
    );
    await screen.findByRole("heading", { name: "Mandioca" });

    await userEvent.click(screen.getByRole("button", MORE));

    expect(await screen.findByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/needs?page=2&descending=true");
    expect(screen.getAllByRole("heading", { level: 2 }).map((title) => title.textContent)).toEqual(
      ["Mandioca", "Laranja"],
    );
    expect(screen.queryByRole("button", MORE)).not.toBeInTheDocument();
  });

  it("puts products of both pages in the cart", async () => {
    renderNeeds(pageResponse([mandioca], FIRST), pageResponse([laranja], SECOND));
    await select("Mandioca");
    await userEvent.click(screen.getByRole("button", MORE));
    await select("Laranja");

    expect(screen.getByRole("region", { name: "Seleção" })).toHaveTextContent(
      "2 produtos selecionados, de 2 agricultores",
    );
    await userEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(storedCart()).toEqual([item("produto-1", 12, "20.00"), item("produto-3", 1, "4.50")]);
  });

  it("starts again from the first page in the other order", async () => {
    const fetchMock = renderNeeds(
      pageResponse([mandioca], FIRST),
      pageResponse([laranja], FIRST),
    );
    await screen.findByRole("heading", { name: "Mandioca" });

    await userEvent.click(screen.getByRole("button", { name: "Menor primeiro" }));

    expect(await screen.findByRole("heading", { name: "Laranja" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mandioca" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/needs?page=1&descending=false");
  });

  it("keeps the first page when the next one fails", async () => {
    renderNeeds(pageResponse([mandioca], FIRST), jsonResponse({ detail: "Sem conexão" }, 500));
    await screen.findByRole("heading", { name: "Mandioca" });

    await userEvent.click(screen.getByRole("button", MORE));

    expect(await screen.findByText("Sem conexão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mandioca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
  });
});
