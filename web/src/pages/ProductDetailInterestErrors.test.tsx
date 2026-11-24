import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { delivered, inPurchase, openInterest, renderResident } from "../test/productInterest";

const IN_PURCHASE = "Este interesse já está numa compra do prédio";
const OFF_CATALOG = "Este produto não está mais disponível no catálogo";

async function typeQuantity(value: string) {
  const field = await screen.findByLabelText("Quantidade");
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

describe("ProductDetail, interest errors", () => {
  it("rereads the interest when it joined a purchase meanwhile", async () => {
    renderResident([[openInterest], [inPurchase]], jsonResponse({ detail: IN_PURCHASE }, 409));
    await typeQuantity("8");

    await userEvent.click(screen.getByRole("button", { name: "Atualizar interesse" }));

    expect(await screen.findByText(IN_PURCHASE)).toBeInTheDocument();
    expect(
      await screen.findByText("Incluído na compra de 20/11, entrega prevista 27/11"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
  });

  it("explains when the product left the catalog before ordering again", async () => {
    renderResident([[delivered]], jsonResponse({ detail: OFF_CATALOG }, 409));

    await userEvent.click(await screen.findByRole("button", { name: "Pedir de novo" }));

    expect(await screen.findByText(OFF_CATALOG)).toBeInTheDocument();
    expect(await screen.findByText("Entregue em 25/11")).toBeInTheDocument();
    expect(screen.queryByText("Interesse registrado de novo")).not.toBeInTheDocument();
  });

  it("shows the existing interest after registering from a stale page", async () => {
    const duplicate = jsonResponse({ detail: "Interesse nesse produto já registrado" }, 409);
    renderResident([[], [openInterest]], duplicate);

    await userEvent.click(await screen.findByRole("button", { name: "Registrar interesse" }));

    expect(await screen.findByText("No seu interesse: 5 kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar interesse" })).toBeInTheDocument();
  });

  it("shows the error and tries the interests again", async () => {
    const failure = jsonResponse({ detail: "Algo deu errado no servidor" }, 500);
    renderResident([failure, [openInterest]]);

    expect(await screen.findByText("Algo deu errado no servidor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar interesse" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("No seu interesse: 5 kg")).toBeInTheDocument();
  });
});
