import { screen, within } from "@testing-library/react";
import { findCard, pageOf, pendingSale, press, renderSales } from "../test/sales";

const VILLAGE = "Cond. Village Vila Verde";
const ADDRESS = "Rua Quatro, 251 - Vila Verde, Rio Grande da Serra";
const CONTACT = "Falar com o síndico";

async function openDetails(): Promise<HTMLElement> {
  const card = await findCard(VILLAGE);
  await press(card, "Ver detalhes");
  return card;
}

function shown(card: HTMLElement, term: string): string | null {
  const title = within(card).getByText(term, { selector: "dt" });
  return title.nextElementSibling?.textContent ?? null;
}

describe("MySales, where to deliver and who to call", () => {
  it("shows the delivery address and the manager in the details", async () => {
    renderSales(pageOf(pendingSale));

    const card = await openDetails();

    expect(shown(card, "Local de entrega")).toBe(ADDRESS);
    expect(shown(card, "Síndico")).toBe("Maria Silva");
  });

  it("shows the CEP when the building has no address", async () => {
    renderSales(pageOf({ ...pendingSale, delivery_address: null }));

    const card = await openDetails();

    expect(shown(card, "Local de entrega")).toBe("CEP 09450-000");
  });

  it("opens WhatsApp with a message about the order date", async () => {
    renderSales(pageOf(pendingSale));

    const card = await openDetails();

    const link = within(card).getByRole("link", { name: CONTACT });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe("https://wa.me/5511987654321");
    expect(url.searchParams.get("text")).toBe(
      "Olá, Maria Silva! Falo sobre a entrega do pedido de 10/11/2026 do " +
        "Cond. Village Vila Verde, feito pelo ConectAgro.",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("uses the secondary button with the WhatsApp mark", async () => {
    renderSales(pageOf(pendingSale));

    const card = await openDetails();

    const link = within(card).getByRole("link", { name: CONTACT });
    expect(link).toHaveClass("border", "bg-white");
    expect(link.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(1);
  });

  it("disables the contact when the manager has no cellphone", async () => {
    renderSales(pageOf({ ...pendingSale, manager_cellphone: null }));

    const card = await openDetails();

    expect(within(card).queryByRole("link", { name: CONTACT })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: CONTACT })).toBeDisabled();
    expect(within(card).getByText("O síndico ainda não cadastrou um telefone.")).toBeVisible();
  });

  it("greets without a name when the manager has none", async () => {
    renderSales(pageOf({ ...pendingSale, manager_name: "" }));

    const card = await openDetails();

    expect(within(card).queryByText("Síndico", { selector: "dt" })).not.toBeInTheDocument();
    const link = within(card).getByRole("link", { name: CONTACT });
    const text = new URL(link.getAttribute("href")!).searchParams.get("text");
    expect(text).toMatch(/^Olá! Falo sobre a entrega/);
  });

  it("keeps the delivery data hidden until the details open", async () => {
    renderSales(pageOf(pendingSale));

    await findCard(VILLAGE);

    expect(screen.queryByRole("link", { name: CONTACT })).not.toBeInTheDocument();
  });
});
