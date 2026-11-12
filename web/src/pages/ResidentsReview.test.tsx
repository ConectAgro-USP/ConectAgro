import { screen, waitFor, within } from "@testing-library/react";
import { jsonResponse } from "../test/helpers";
import { bia, findCard, press, renderResidents, tita } from "../test/residents";

describe("Residents review", () => {
  it("approves a request and keeps it in place with the answer", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), jsonResponse(tita));
    const card = await findCard("Tita Russell");

    await press(card, "Aprovar");

    const answer = "Aprovado, Tita Russell já pode usar o ConectAgro";
    expect(await within(card).findByText(answer)).toHaveRole("status");
    expect(within(card).queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.getByText("1 pedido esperando sua resposta")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers/morador-1/approve");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });

  it("asks before rejecting, and moves the focus to the way back", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita]));
    const card = await findCard("Tita Russell");

    await press(card, "Recusar");

    expect(within(card).getByText("Recusar o pedido de Tita Russell?")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps the request when the manager goes back", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita]));
    const card = await findCard("Tita Russell");
    await press(card, "Recusar");

    await press(card, "Voltar");

    expect(within(card).getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
    expect(within(card).queryByText(/Recusar o pedido/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a request after the confirmation", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), jsonResponse(tita));
    const card = await findCard("Tita Russell");
    await press(card, "Recusar");

    await press(card, "Recusar pedido");

    const answer = "Recusado, Tita Russell não pode usar o ConectAgro";
    expect(await within(card).findByText(answer)).toHaveRole("status");
    expect(within(card).queryByText(/Recusar o pedido/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers/morador-1/reject");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });

  it("names the resident in what each button does", async () => {
    renderResidents(jsonResponse([tita]));
    const card = await findCard("Tita Russell");

    expect(within(card).getByRole("button", { name: "Aprovar" })).toHaveAccessibleDescription(
      "Tita Russell",
    );
  });

  it("shows the API message and reloads the list when the answer fails", async () => {
    const gone = jsonResponse({ detail: "Morador não encontrado" }, 404);
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), gone, jsonResponse([bia]));

    await press(await findCard("Tita Russell"), "Aprovar");

    expect(await screen.findByRole("alert")).toHaveTextContent("Morador não encontrado");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.getByRole("heading", { name: "Bia Lima" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/apartments/me/buyers?status=PENDENTE");
  });

  it("keeps the confirmation open when the refusal fails", async () => {
    renderResidents(jsonResponse([tita]), jsonResponse({}, 500), jsonResponse([tita]));
    const card = await findCard("Tita Russell");
    await press(card, "Recusar");

    await press(card, "Recusar pedido");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await within(card).findByRole("button", { name: "Recusar pedido" })).toBeEnabled();
  });

  it("reloads the user when the session ended before the answer", async () => {
    const denied = () => jsonResponse({ detail: "Não autenticado" }, 401);
    const { auth } = renderResidents(jsonResponse([tita]), denied(), denied());

    await press(await findCard("Tita Russell"), "Aprovar");

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("locks the buttons while the list reloads after a failed answer", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), jsonResponse({}, 500));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));

    await press(await findCard("Tita Russell"), "Aprovar");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Carregando...");
    expect(screen.getAllByRole("button", { name: "Aprovar" })[1]).toBeDisabled();
  });

  it("locks every button while an answer is on its way", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));

    await press(await findCard("Tita Russell"), "Aprovar");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const button of screen.getAllByRole("button", { name: /Aprovar|Recusar/ })) {
      expect(button).toBeDisabled();
    }
    // trocar de lista no meio da resposta deixaria o aviso de erro na lista errada
    expect(screen.getByRole("button", { name: "Aprovados" })).toBeDisabled();
  });
});
