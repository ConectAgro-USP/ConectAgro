import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FARMER_STATUS_LABELS, MANAGER_STATUS_LABELS } from "../format";
import {
  findCard as findPurchase,
  pageOf as purchasesPage,
  purchase,
  renderPurchases,
} from "../test/purchases";
import { findCard as findSale, pageOf, pendingSale, renderSales } from "../test/sales";

describe("vocabulário do estado do pedido", () => {
  it("dá um nome para cada lado da entrega e o mesmo para os estados fechados", () => {
    expect(FARMER_STATUS_LABELS).toEqual({
      "EM PROGRESSO": "A entregar",
      ENTREGUE: "Entregue",
      CANCELADA: "Cancelada",
    });
    expect(MANAGER_STATUS_LABELS).toEqual({
      "EM PROGRESSO": "A caminho",
      ENTREGUE: "Entregue",
      CANCELADA: "Cancelada",
    });
  });

  it("mostra A entregar ao agricultor, no cartão, no total e no filtro", async () => {
    renderSales(pageOf(pendingSale));

    const card = await findSale(pendingSale.building_name);
    expect(within(card).getByText("A entregar")).toBeVisible();
    expect(screen.getByText("Total a entregar")).toBeInTheDocument();
    expect(screen.queryByText(/pendente/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    const status = screen.getByRole("combobox", { name: "Status" });
    expect(within(status).getByRole("option", { name: "A entregar" })).toBeInTheDocument();
  });

  it("mostra A caminho ao síndico, no cartão e no total", async () => {
    renderPurchases(purchasesPage(purchase));

    const card = await findPurchase("Osvaldo S. e Maria F.");
    expect(within(card).getAllByText("A caminho")[0]).toBeVisible();
    expect(screen.getByText("Total a caminho")).toBeInTheDocument();
    expect(screen.queryByText("A entregar")).not.toBeInTheDocument();
  });
});
