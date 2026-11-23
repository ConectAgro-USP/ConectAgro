import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../../api/client";
import { comment, renderForm, send, star } from "../../test/reviews";

describe("ReviewForm, sending", () => {
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
