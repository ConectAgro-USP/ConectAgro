import { screen, within } from "@testing-library/react";
import type { MyProduct } from "../api/products";
import { findSummary, renderHome, salesPage } from "../test/home";
import { orange } from "../test/products";
import { pendingSale } from "../test/sales";

function sale(id: string, building: string, expected: string, total: string) {
  return {
    ...pendingSale,
    purchase_public_id: id,
    building_name: building,
    expected_delivery_date: expected,
    total,
  };
}

function product(name: string, changes: Partial<MyProduct> = {}): MyProduct {
  return { ...orange, public_id: name, name, ...changes };
}

// na ordem da API, a entrega mais próxima primeiro
const SALES = [
  sale("c2", "Cond. Village Vila Verde", "2026-11-22", "56.00"),
  sale("c4", "Res. Acácias", "2026-11-25", "28.00"),
  sale("c1", "Ed. Ipê", "2026-11-28", "14.00"),
  sale("c3", "Ed. Primavera", "2026-11-30", "21.00"),
];

describe("FarmerHome, with sales and products", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("greets the farmer and offers to add a product", async () => {
    renderHome({ products: [orange] });

    expect(screen.getByRole("heading", { level: 1, name: "Início" })).toBeInTheDocument();
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Cadastrar produto" })).toHaveAttribute(
      "href",
      "/meus-produtos?novo=1",
    );
  });

  it("asks only for the sales still to deliver", async () => {
    const fetchMock = renderHome();

    await findSummary("Vendas a entregar");

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain("/api/farmers/me/sales?page=1&status=EM+PROGRESSO&sort=delivery");
    expect(urls).toContain("/api/products/me?page=1&page_size=1");
    expect(urls).toContain("/api/farmers/me/reviews");
  });

  it("sums the sales to deliver and lists the three next deliveries", async () => {
    renderHome({ products: [orange], sales: salesPage(SALES, 4, "119.00") });
    const summary = await findSummary("Vendas a entregar");

    expect(await within(summary).findByText(/para entregar/)).toHaveTextContent(
      "4 vendas para entregar, R$ 119,00 a receber.",
    );
    const links = within(summary).getAllByRole("link");
    const sales = links.filter((link) => link.textContent?.includes("Entrega prevista"));
    expect(sales.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Cond. Village Vila Verde"),
      expect.stringContaining("Res. Acácias"),
      expect.stringContaining("Ed. Ipê"),
    ]);
    expect(sales[0]).toHaveTextContent("Entrega prevista 22/11R$ 56,00");
    for (const link of sales) expect(link).toHaveAttribute("href", "/vendas");
    expect(within(summary).getByRole("link", { name: "Ver todas as vendas" })).toBeVisible();
  });

  it("says when there is nothing to deliver", async () => {
    renderHome({ products: [orange] });
    const summary = await findSummary("Vendas a entregar");

    expect(await within(summary).findByText("Nenhuma venda para entregar agora.")).toBeVisible();
  });

  it("splits the products into available, sold out and expiring soon", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
    renderHome({
      products: [
        product("Mandioca", { expiration_date: "2026-12-30" }),
        product("Alface", { expiration_date: "2026-11-27" }),
        product("Couve", { quantity: 0 }),
        product("Milho", { quantity: 0 }),
        product("Laranja", { expiration_date: "2026-11-19" }),
        product("Tomate", { is_available: false, expiration_date: "2026-11-21" }),
      ],
    });
    const summary = await findSummary("Seus produtos");

    await within(summary).findByText("Disponíveis");
    const counts = within(summary)
      .getAllByRole("definition")
      .map((count) => count.textContent);
    expect(counts).toEqual(["2", "2", "1"]);
    expect(within(summary).getByRole("link", { name: "Ver meus produtos" })).toHaveAttribute(
      "href",
      "/meus-produtos",
    );
  });

  it("shows the average rating and how many reviews it has", async () => {
    renderHome({
      products: [orange],
      reviews: { average_rating: 4.6, reviews_count: 12, reviews: [] },
    });
    const summary = await findSummary("Sua nota");

    expect(await within(summary).findByText("4,6")).toBeVisible();
    expect(within(summary).getByText("12 avaliações")).toBeVisible();
  });

  it("says when no one reviewed the farmer yet", async () => {
    renderHome({ products: [orange] });
    const summary = await findSummary("Sua nota");

    expect(
      await within(summary).findByText(/Você ainda não recebeu avaliações/),
    ).toBeVisible();
  });
});
