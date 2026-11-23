import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { PurchaseItem } from "../../api/history";
import { HistoryCard } from "./HistoryCard";
import { HistoryMonths } from "./HistoryMonths";
import { ItemLines } from "./ItemLines";

const mandioca: PurchaseItem = {
  product_public_id: "produto-1",
  product_name: "Mandioca",
  quantity: 3,
  unit_price: "7.00",
  subtotal: "21.00",
};
const tomate: PurchaseItem = {
  product_public_id: "produto-2",
  product_name: "Tomate",
  quantity: 2,
  unit_price: "9.50",
  subtotal: "19.00",
};

function renderCard(props: Partial<ComponentProps<typeof HistoryCard>> = {}) {
  render(
    <ul>
      <HistoryCard
        names={["Maria F."]}
        items={[mandioca, tomate]}
        status="ENTREGUE"
        statusLabel="Entregue"
        orderedAt="2026-11-03T14:00:00Z"
        expectedOn="2026-11-20"
        closedAt="2026-11-07T15:00:00Z"
        total="40.00"
        {...props}
      >
        <ItemLines items={[mandioca, tomate]} />
      </HistoryCard>
    </ul>,
  );
  return screen.getByRole("listitem");
}

describe("HistoryCard", () => {
  it("shows who the order is with, the products and the status", () => {
    const card = renderCard();

    expect(within(card).getByRole("heading", { name: "Maria F." })).toBeInTheDocument();
    expect(within(card).getByText("Mandioca e Tomate")).toBeVisible();
    expect(within(card).getByText("Entregue")).toBeVisible();
  });

  it("joins the names and lists a repeated product once", () => {
    const sameProduct = { ...mandioca, product_public_id: "produto-3" };
    const card = renderCard({ names: ["Osvaldo S.", "Maria F."], items: [mandioca, sameProduct] });

    const title = within(card).getByRole("heading", { name: "Osvaldo S. e Maria F." });
    expect(title.nextElementSibling).toHaveTextContent(/^Mandioca$/);
  });

  it("shows the delivery date and the value of a delivered order", () => {
    const card = renderCard();

    expect(card).toHaveTextContent(/Data do pedido:\s*03\/11/);
    expect(card).toHaveTextContent(/Data de entrega:\s*07\/11/);
    expect(card).toHaveTextContent(/Valor\s*R\$ 40,00/);
    expect(card).not.toHaveTextContent("Entrega prevista");
  });

  it("shows the agreed value and the expected delivery while the order is open", () => {
    const card = renderCard({ status: "EM PROGRESSO", statusLabel: "A caminho", closedAt: null });

    expect(card).toHaveTextContent(/Valor combinado\s*R\$ 40,00/);
    expect(card).toHaveTextContent(/Entrega prevista:\s*20\/11/);
    expect(card).not.toHaveTextContent("Data de entrega");
  });

  it("shows the cancellation date and no value of a cancelled order", () => {
    const card = renderCard({ status: "CANCELADA", statusLabel: "Cancelada" });

    expect(card).toHaveTextContent(/Data do cancelamento:\s*07\/11/);
    expect(card).not.toHaveTextContent("Valor");
  });

  it("shows the dates in the time of Brasília", () => {
    const card = renderCard({ orderedAt: "2026-11-01T02:00:00Z" });

    expect(card).toHaveTextContent(/Data do pedido:\s*31\/10/);
  });

  it("opens and closes the details with the items", async () => {
    const card = renderCard();
    const price = within(card).getByText("3 × R$ 7,00");
    expect(price).not.toBeVisible();

    await userEvent.click(within(card).getByRole("button", { name: "Ver detalhes" }));

    expect(price).toBeVisible();
    expect(card).toHaveTextContent(/Tomate\s*2 × R\$ 9,50\s*R\$ 19,00/);
    await userEvent.click(within(card).getByRole("button", { name: "Ocultar detalhes" }));

    expect(price).not.toBeVisible();
  });
});

describe("HistoryMonths", () => {
  it("groups the orders by month, in the time of Brasília", () => {
    // o último ainda é 31 de outubro em Brasília
    const days = ["2026-11-10T14:00:00Z", "2026-11-03T14:00:00Z", "2026-11-01T02:00:00Z"];
    render(
      <HistoryMonths items={days} dateOf={(day) => day}>
        {(day) => <li key={day}>{day}</li>}
      </HistoryMonths>,
    );

    const november = screen.getByRole("heading", { name: "novembro de 2026" }).closest("section")!;
    const october = screen.getByRole("heading", { name: "outubro de 2026" }).closest("section")!;

    expect(within(november).getAllByRole("listitem")).toHaveLength(2);
    expect(within(october).getByRole("listitem")).toHaveTextContent("2026-11-01T02:00:00Z");
  });
});
