import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { bia, findRequest, renderResidents, tita } from "../test/residents";

function press(request: HTMLElement, button: string) {
  return userEvent.click(within(request).getByRole("button", { name: button }));
}

describe("Residents review", () => {
  it("approves a request and keeps it in place with the answer", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), jsonResponse(tita));
    const request = await findRequest("Tita Russell");

    await press(request, "Aprovar");

    const answer = "Aprovado, Tita Russell já pode usar o ConectAgro";
    expect(await within(request).findByText(answer)).toHaveRole("status");
    expect(within(request).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("1 pedido esperando sua resposta")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers/morador-1/approve");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });

  it("asks before rejecting, and moves the focus to the way back", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita]));
    const request = await findRequest("Tita Russell");

    await press(request, "Recusar");

    expect(within(request).getByText("Recusar o pedido de Tita Russell?")).toBeInTheDocument();
    expect(within(request).queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(within(request).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps the request when the manager goes back", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita]));
    const request = await findRequest("Tita Russell");
    await press(request, "Recusar");

    await press(request, "Voltar");

    expect(within(request).getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
    expect(within(request).queryByText(/Recusar o pedido/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a request after the confirmation", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), jsonResponse(tita));
    const request = await findRequest("Tita Russell");
    await press(request, "Recusar");

    await press(request, "Recusar pedido");

    expect(await within(request).findByText("Pedido recusado")).toHaveRole("status");
    expect(within(request).queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers/morador-1/reject");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });

  it("names the resident in what each button does", async () => {
    renderResidents(jsonResponse([tita]));
    const request = await findRequest("Tita Russell");

    expect(within(request).getByRole("button", { name: "Aprovar" })).toHaveAccessibleDescription(
      "Tita Russell",
    );
  });

  it("shows the API message and reloads the list when the answer fails", async () => {
    const gone = jsonResponse({ detail: "Morador não encontrado" }, 404);
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), gone, jsonResponse([bia]));

    await press(await findRequest("Tita Russell"), "Aprovar");

    expect(await screen.findByRole("alert")).toHaveTextContent("Morador não encontrado");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.getByRole("heading", { name: "Bia Lima" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/apartments/me/buyers?status=PENDENTE");
  });

  it("keeps the confirmation open when the refusal fails", async () => {
    renderResidents(jsonResponse([tita]), jsonResponse({}, 500), jsonResponse([tita]));
    const request = await findRequest("Tita Russell");
    await press(request, "Recusar");

    await press(request, "Recusar pedido");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await within(request).findByRole("button", { name: "Recusar pedido" })).toBeEnabled();
  });

  it("reloads the user when the session ended before the answer", async () => {
    const denied = () => jsonResponse({ detail: "Não autenticado" }, 401);
    const { auth } = renderResidents(jsonResponse([tita]), denied(), denied());

    await press(await findRequest("Tita Russell"), "Aprovar");

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("locks the buttons while the list reloads after a failed answer", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]), jsonResponse({}, 500));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));

    await press(await findRequest("Tita Russell"), "Aprovar");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Carregando...");
    expect(screen.getAllByRole("button", { name: "Aprovar" })[1]).toBeDisabled();
  });

  it("locks every button while an answer is on its way", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));

    await press(await findRequest("Tita Russell"), "Aprovar");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const button of screen.getAllByRole("button", { name: /Aprovar|Recusar/ })) {
      expect(button).toBeDisabled();
    }
  });
});
