import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { bia, findRequest, manager, renderResidents, tita } from "../test/residents";

const RETRY = "Tentar de novo";

describe("Residents", () => {
  it("shows the name, e-mail, block, unit and date of each pending request", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita, bia]));

    const request = await findRequest("Tita Russell");

    expect(within(request).getByText("tita@example.com")).toBeInTheDocument();
    expect(within(request).getByText("Bloco B, apartamento 132")).toBeInTheDocument();
    expect(request).toHaveTextContent("Pediu em 31/10");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments/me/buyers?status=PENDENTE");
  });

  it("leaves the block out when the resident has none", async () => {
    renderResidents(jsonResponse([bia]));

    const request = await findRequest("Bia Lima");

    expect(within(request).getByText("Apartamento 21")).toBeInTheDocument();
  });

  it.each([
    [[tita, bia], "2 pedidos esperando sua resposta"],
    [[tita], "1 pedido esperando sua resposta"],
  ])("counts the requests waiting for an answer", async (residents, summary) => {
    renderResidents(jsonResponse(residents));

    expect(await screen.findByText(summary)).toBeInTheDocument();
  });

  it("says when no request is waiting and how one gets there", async () => {
    renderResidents(jsonResponse([]));

    expect(await screen.findByText("Nenhum pedido esperando resposta")).toBeInTheDocument();
    expect(screen.getByText(/Quando um morador pedir para entrar no prédio/)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("tells the screen reader while the requests load", async () => {
    renderResidents(jsonResponse([tita]));

    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Carregando...");
    expect(screen.queryByText("Nenhum pedido esperando resposta")).not.toBeInTheDocument();
    await findRequest("Tita Russell");

    expect(screen.getAllByRole("status")[0]).toBeEmptyDOMElement();
  });

  it("shows why the requests did not load and tries again", async () => {
    const detail = "Muitas tentativas. Tente novamente mais tarde";
    renderResidents(jsonResponse({ detail }, 429), jsonResponse([tita]));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText("Nenhum pedido esperando resposta")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: RETRY }));

    await findRequest("Tita Russell");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
  });

  it("asks to try again when the server cannot be reached", async () => {
    renderResidents(new TypeError("Failed to fetch"), jsonResponse([tita]));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
    await userEvent.click(screen.getByRole("button", { name: RETRY }));

    expect(await findRequest("Tita Russell")).toBeInTheDocument();
  });

  it.each([401, 403])("reloads the user when the API answers %i", async (status) => {
    const { auth } = renderResidents(jsonResponse({ detail: "Sem acesso" }, status));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("opens at /moradores for the manager", async () => {
    stubFetch(jsonResponse([tita]));
    renderWithAuth(<App />, fakeAuth({ user: manager }), "/moradores");

    expect(await screen.findByRole("heading", { name: "Moradores" })).toBeInTheDocument();
    expect(await findRequest("Tita Russell")).toBeInTheDocument();
  });

  it("sends a resident at /moradores back to the home", () => {
    const fetchMock = stubFetch();
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), "/moradores");

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
