import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { ApiError } from "../../api/client";
import { ReviewForm } from "./ReviewForm";

function renderForm(props: Partial<ComponentProps<typeof ReviewForm>> = {}) {
  const onSubmit = vi.fn<(review: unknown) => Promise<void>>().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <ReviewForm
      farmerName="Osvaldo S."
      context="Entregue em 19/11 · Mandioca e Alface"
      initial={{ rating: 0, comment: "" }}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSubmit, onCancel };
}

function star(rating: number): HTMLElement {
  return screen.getByRole("radio", { name: new RegExp(`^${rating} estrelas?,`) });
}

function comment(): HTMLElement {
  return screen.getByLabelText("Comentário (opcional)");
}

function send() {
  return userEvent.click(screen.getByRole("button", { name: "Enviar" }));
}

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

  it("asks for a rating before sending", async () => {
    const { onSubmit } = renderForm();

    await send();

    expect(screen.getByRole("alert")).toHaveTextContent("Escolha uma nota de 1 a 5 estrelas");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(star(3));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends the rating and the comment without extra spaces", async () => {
    const { onSubmit } = renderForm();
    await userEvent.click(star(4));
    await userEvent.type(comment(), "  Mandioca fresquinha  ");

    await send();

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      rating: 4,
      comment: "Mandioca fresquinha",
    });
  });

  it("sends without a comment", async () => {
    const { onSubmit } = renderForm({ initial: { rating: 2, comment: "" } });

    await send();

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ rating: 2, comment: "" });
  });

  it("counts the characters of the comment up to the limit", async () => {
    renderForm();

    await userEvent.type(comment(), "Ótima");

    expect(comment()).toHaveAttribute("maxlength", "500");
    expect(comment()).toHaveAccessibleDescription("5/500 caracteres");
  });

  it("cancels without sending", async () => {
    const { onSubmit, onCancel } = renderForm({ initial: { rating: 5, comment: "" } });

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("locks the form while sending", async () => {
    let finish = () => {};
    const sending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    renderForm({ initial: { rating: 5, comment: "" }, onSubmit: () => sending });

    await send();

    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(star(1)).toBeDisabled();
    expect(comment()).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
  });

  it("shows the API message and keeps what was written when sending fails", async () => {
    const already = new ApiError(409, "Você já avaliou este agricultor nesta compra");
    renderForm({
      initial: { rating: 5, comment: "" },
      onSubmit: vi.fn().mockRejectedValue(already),
    });
    await userEvent.type(comment(), "Chegou tudo");

    await send();

    expect(await screen.findByRole("alert")).toHaveTextContent(already.message);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
    expect(star(5)).toBeChecked();
    expect(comment()).toHaveValue("Chegou tudo");
  });
});
