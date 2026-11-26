import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Sale } from "../api/sales";
import { jsonResponse } from "../test/helpers";
import { findCard, pendingSale, press, renderSales } from "../test/sales";

const ACACIAS = "Edifício Jardim das Acácias";
const older: Sale = {
  ...pendingSale,
  purchase_public_id: "compra-3",
  apartment_public_id: "predio-2",
  building_name: ACACIAS,
};
const delivered: Sale = { ...older, status: "ENTREGUE", closed_at: "2026-11-21T10:00:00Z" };
const BEFORE = { realized_total: "0.00", expected_total: "42.00" };
const AFTER = { realized_total: "21.00", expected_total: "21.00" };

// uma venda por página, com os totais que a API soma de todas
function page(sale: Sale, number: number, totals: object): Response {
  return jsonResponse({
    items: [sale],
    page: number,
    page_size: 1,
    total_pages: 2,
    counterparts: [],
    ...totals,
  });
}

describe("MySales, delivering a sale from an older page", () => {
  it("keeps the sale on screen with its new state and the new totals", async () => {
    const fetchMock = renderSales(
      page(pendingSale, 1, BEFORE),
      page(older, 2, BEFORE),
      jsonResponse({}),
      page(pendingSale, 1, AFTER),
      page(delivered, 2, AFTER),
    );
    await findCard("Cond. Village Vila Verde");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar pedidos mais antigos" }));
    const card = await findCard(ACACIAS);

    await press(card, "Marcar como entregue");
    await press(card, "Confirmar entrega");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(String(fetchMock.mock.calls[3][0])).toContain("page=1");
    expect(String(fetchMock.mock.calls[4][0])).toContain("page=2");
    const after = await findCard(ACACIAS);
    await waitFor(() => expect(within(after).getByText("Entregue")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Cond. Village Vila Verde" })).toBeInTheDocument();
    const more = screen.queryByRole("button", { name: "Mostrar pedidos mais antigos" });
    expect(more).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Total entregue\s*R\$\s*21,00/);
  });
});
