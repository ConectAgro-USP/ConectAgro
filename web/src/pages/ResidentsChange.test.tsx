import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { caio, davi, findCard, press, renderResidents, tita } from "../test/residents";

async function open(tab: string) {
  await userEvent.click(await screen.findByRole("button", { name: tab }));
}

describe("Residents, changing a decision", () => {
  it("lists the approved residents without their e-mail", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita]), jsonResponse([caio]));
    await findCard("Tita Russell");

    await open("Aprovados");

    const card = await findCard("Caio Nogueira");
    expect(within(card).getByText("Bloco A, apartamento 14")).toBeInTheDocument();
    expect(card).not.toHaveTextContent("@");
    expect(screen.getByText("1 morador aprovado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tita Russell" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers?status=APROVADO");
  });

  it("lists the refused requests", async () => {
    const { fetchMock } = renderResidents(jsonResponse([]), jsonResponse([davi]));

    await open("Recusados");

    expect(await findCard("Davi Rocha")).toBeInTheDocument();
    expect(screen.getByText("1 pedido recusado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recusados" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers?status=RECUSADO");
  });

  it.each([
    ["Aprovados", "Nenhum morador aprovado"],
    ["Recusados", "Nenhum pedido recusado"],
  ])("says when the %s list is empty", async (tab, summary) => {
    renderResidents(jsonResponse([tita]), jsonResponse([]));

    await open(tab);

    expect(await screen.findByText(summary)).toBeInTheDocument();
    expect(screen.queryByText(/Quando um morador pedir/)).not.toBeInTheDocument();
  });

  it("asks before taking an approved resident out of the building", async () => {
    const { fetchMock } = renderResidents(jsonResponse([]), jsonResponse([caio]));
    await open("Aprovados");
    const card = await findCard("Caio Nogueira");

    await press(card, "Tirar do prédio");

    expect(within(card).getByText("Tirar Caio Nogueira do prédio?")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Voltar" })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("takes an approved resident out after the confirmation", async () => {
    const { fetchMock } = renderResidents(jsonResponse([]), jsonResponse([caio]), jsonResponse(caio));
    await open("Aprovados");
    const card = await findCard("Caio Nogueira");
    await press(card, "Tirar do prédio");

    await press(card, "Tirar do prédio");

    const answer = "Recusado, Caio Nogueira não pode usar o ConectAgro";
    expect(await within(card).findByText(answer)).toHaveRole("status");
    expect(screen.getByText("Nenhum morador aprovado")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/apartments/me/buyers/morador-3/reject");
  });

  it("approves a refused request only after a confirmation", async () => {
    const { fetchMock } = renderResidents(jsonResponse([]), jsonResponse([davi]), jsonResponse(davi));
    await open("Recusados");
    const card = await findCard("Davi Rocha");

    await press(card, "Aprovar");
    expect(within(card).getByText("Aprovar Davi Rocha?")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await press(card, "Aprovar");

    const answer = "Aprovado, Davi Rocha já pode usar o ConectAgro";
    expect(await within(card).findByText(answer)).toHaveRole("status");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/apartments/me/buyers/morador-4/approve");
  });

  it("keeps the answer on screen while asking to undo it", async () => {
    renderResidents(jsonResponse([tita]), jsonResponse(tita));
    const card = await findCard("Tita Russell");
    await press(card, "Aprovar");
    const answer = await within(card).findByText("Aprovado, Tita Russell já pode usar o ConectAgro");

    await press(card, "Tirar do prédio");

    expect(answer).toBeVisible();
    expect(within(card).getByText("Tirar Tita Russell do prédio?")).toBeInTheDocument();
  });

  it("ignores a list that arrives after the manager chose another one", async () => {
    let answerLate: (response: Response) => void = () => {};
    const late = new Promise<Response>((resolve) => (answerLate = resolve));
    renderResidents(late, jsonResponse([caio]));
    await open("Aprovados");
    await findCard("Caio Nogueira");

    answerLate(jsonResponse([tita]));
    // dá tempo de a resposta velha chegar antes de olhar a lista
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByRole("heading", { name: "Tita Russell" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Caio Nogueira" })).toBeInTheDocument();
  });

  it("lets the manager undo an approval right after giving it", async () => {
    const { fetchMock } = renderResidents(jsonResponse([tita]), jsonResponse(tita), jsonResponse(tita));
    const card = await findCard("Tita Russell");
    await press(card, "Aprovar");
    await within(card).findByText("Aprovado, Tita Russell já pode usar o ConectAgro");

    await press(card, "Tirar do prédio");
    await press(card, "Tirar do prédio");

    const answer = "Recusado, Tita Russell não pode usar o ConectAgro";
    expect(await within(card).findByText(answer)).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/apartments/me/buyers/morador-1/reject");
  });
});
