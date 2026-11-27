import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openInterest, renderResident } from "../test/productInterest";

const QUESTION = "Remover o seu interesse neste produto?";

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

describe("ProductDetail, interest removal", () => {
  it("asks before removing, with the focus on Voltar", async () => {
    const fetchMock = renderResident([[openInterest]]);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");

    await userEvent.click(await screen.findByRole("button", { name: "Remover" }));
    const lastFocus = focus.mock.lastCall;
    focus.mockRestore();

    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(button("Voltar")).toHaveFocus();
    expect(lastFocus).toEqual([{ preventScroll: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("puts Voltar before the button that removes", async () => {
    renderResident([[openInterest]]);

    await userEvent.click(await screen.findByRole("button", { name: "Remover" }));

    const buttons = screen.getAllByRole("button").map((element) => element.textContent);
    expect(buttons.indexOf("Voltar")).toBeLessThan(buttons.indexOf("Remover"));
    expect(screen.queryByRole("button", { name: "Atualizar interesse" })).not.toBeInTheDocument();
  });

  it("goes back without removing", async () => {
    const fetchMock = renderResident([[openInterest]]);
    await userEvent.click(await screen.findByRole("button", { name: "Remover" }));

    await userEvent.click(button("Voltar"));

    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
    expect(button("Atualizar interesse")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("removes the interest and offers to register again", async () => {
    const removed = new Response(null, { status: 204 });
    const fetchMock = renderResident([[openInterest]], removed);
    await userEvent.click(await screen.findByRole("button", { name: "Remover" }));

    await userEvent.click(button("Remover"));

    expect(await screen.findByText("Interesse removido")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe("/api/interests/interesse-9");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("DELETE");
    expect(button("Registrar interesse")).toBeEnabled();
    expect(screen.getByLabelText("Quantidade")).toHaveValue("1");
  });

  it("sends one removal while it is pending", async () => {
    const fetchMock = renderResident([[openInterest]]);
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    await userEvent.click(await screen.findByRole("button", { name: "Remover" }));

    await userEvent.dblClick(button("Remover"));

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(button("Voltar")).toBeDisabled();
  });
});
