import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, sentBody } from "../test/helpers";
import { delivered, inPurchase, openInterest, renderResident } from "../test/productInterest";

const UPDATE = { name: "Atualizar interesse" };

async function typeQuantity(value: string) {
  const field = await screen.findByLabelText("Quantidade");
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

describe("ProductDetail, interest states", () => {
  it("offers to register when the resident has no interest in the product", async () => {
    renderResident([[{ ...openInterest, product_public_id: "outro-produto" }]]);

    expect(await screen.findByRole("button", { name: "Registrar interesse" })).toBeEnabled();
    expect(screen.getByLabelText("Quantidade")).toHaveValue("1");
    expect(screen.queryByText(/No seu interesse/)).not.toBeInTheDocument();
  });

  it("shows the open interest with its quantity, ready to update", async () => {
    const saved = jsonResponse({ ...openInterest, quantity: 8 });
    const fetchMock = renderResident([[openInterest]], saved);

    expect(await screen.findByText("No seu interesse: 5 kg")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toHaveValue("5");
    expect(screen.getByRole("button", UPDATE)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Registrar interesse" })).not.toBeInTheDocument();

    await typeQuantity("8");
    await userEvent.click(screen.getByRole("button", UPDATE));

    expect(await screen.findByText("Interesse atualizado")).toBeInTheDocument();
    expect(screen.getByText("No seu interesse: 8 kg")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe("/api/interests/interesse-9");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 3)).toEqual({ quantity: 8 });
  });

  it("lets the resident lower an open interest above the stock", async () => {
    renderResident([[{ ...openInterest, quantity: 40 }]]);

    await typeQuantity("30");

    expect(screen.getByRole("button", UPDATE)).toBeEnabled();
  });

  it("shows the purchase of the building, without editing", async () => {
    renderResident([[inPurchase]]);

    const note = await screen.findByText(
      "Incluído na compra de 20/11, entrega prevista 27/11",
    );
    expect(note).toBeInTheDocument();
    expect(screen.getByText("No seu interesse: 5 kg")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", UPDATE)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver meus interesses" })).toHaveAttribute(
      "href",
      "/interesses",
    );
  });

  it("orders a delivered interest again, which reopens it", async () => {
    const reopened = { ...openInterest, quantity: 2 };
    const fetchMock = renderResident([[delivered]], jsonResponse(reopened));

    expect(await screen.findByText("Entregue em 25/11")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toHaveValue("5");
    await typeQuantity("2");
    await userEvent.click(screen.getByRole("button", { name: "Pedir de novo" }));

    expect(await screen.findByText("Interesse registrado de novo")).toBeInTheDocument();
    expect(sentBody(fetchMock, 3)).toEqual({ quantity: 2 });
    expect(fetchMock.mock.calls[3][1]?.method).toBe("PATCH");
    expect(screen.getByText("No seu interesse: 2 kg")).toBeInTheDocument();
    expect(screen.getByRole("button", UPDATE)).toBeDisabled();
  });

  it("orders again with the same quantity", async () => {
    renderResident([[delivered]]);

    expect(await screen.findByRole("button", { name: "Pedir de novo" })).toBeEnabled();
  });
});
