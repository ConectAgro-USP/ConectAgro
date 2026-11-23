import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { comment, renderForm, star } from "../../test/reviews";

describe("ReviewForm", () => {
  it("starts at the farmer, with the delivery and no rating yet", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "Osvaldo S." })).toHaveFocus();
    expect(screen.getByText("Entregue em 19/11 · Mandioca e Alface")).toBeVisible();
    expect(screen.getByRole("group", { name: "Sua nota" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

  it("starts with the star chosen before", () => {
    renderForm({ initial: { rating: 4, comment: "" } });

    expect(star(4)).toBeChecked();
    expect(screen.getByText("Bom")).toBeVisible();
  });

  it("edits a review starting from what it already says", async () => {
    const { onSubmit } = renderForm({
      initial: { rating: 3, comment: "Boa mandioca" },
      editing: true,
    });

    expect(star(3)).toBeChecked();
    expect(comment()).toHaveValue("Boa mandioca");
    expect(comment()).toHaveAccessibleDescription("12/500 caracteres");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ rating: 3, comment: "Boa mandioca" });
  });

  it("names the rating next to the stars", async () => {
    renderForm();

    await userEvent.click(star(5));

    expect(star(5)).toBeChecked();
    expect(screen.getByText("Incrível")).toBeVisible();
    expect(star(1)).toHaveAccessibleName("1 estrela, Péssimo");
  });

  it("counts the characters of the comment up to the limit", async () => {
    renderForm();

    await userEvent.type(comment(), "Ótima");

    expect(comment()).toHaveAttribute("maxlength", "500");
    expect(comment()).toHaveAccessibleDescription("5/500 caracteres");
  });
});
