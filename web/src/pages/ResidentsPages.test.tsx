import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, pageResponse } from "../test/helpers";
import { bia, caio, findCard, press, renderResidents, tita } from "../test/residents";

const MORE = { name: "Mostrar mais moradores" };
// a API conta 25 pedidos, mesmo mandando só os da página
const FIRST = { total: 25, total_pages: 2 };
const SECOND = { page: 2, total: 25, total_pages: 2 };

describe("Residents, pages", () => {
  it("shows the next page below the first one", async () => {
    const { fetchMock } = renderResidents(
      pageResponse([tita], FIRST),
      pageResponse([bia], SECOND),
    );
    await findCard("Tita Russell");

    await userEvent.click(screen.getByRole("button", MORE));

    expect(await findCard("Bia Lima")).toBeInTheDocument();
    expect(await findCard("Tita Russell")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers?page=2&status=PENDENTE");
    expect(screen.queryByRole("button", MORE)).not.toBeInTheDocument();
  });

  it("counts every request of the API, not only the ones on screen", async () => {
    renderResidents(pageResponse([tita], FIRST));

    expect(await screen.findByText("25 pedidos esperando sua resposta")).toBeInTheDocument();
  });

  it("takes an answered request out of the API count", async () => {
    renderResidents(pageResponse([tita], FIRST), jsonResponse(tita));
    const card = await findCard("Tita Russell");

    await press(card, "Aprovar");

    expect(await within(card).findByRole("status")).toHaveTextContent(/^Aprovado/);
    expect(screen.getByText("24 pedidos esperando sua resposta")).toBeInTheDocument();
  });

  it("starts again from the first page of another status", async () => {
    const { fetchMock } = renderResidents(
      pageResponse([tita], FIRST),
      pageResponse([caio], { total: 1 }),
    );
    await findCard("Tita Russell");

    await userEvent.click(screen.getByRole("button", { name: "Aprovados" }));

    expect(await findCard("Caio Nogueira")).toBeInTheDocument();
    expect(screen.getByText("1 morador aprovado")).toBeInTheDocument();
    expect(screen.queryByRole("button", MORE)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/apartments/me/buyers?page=1&status=APROVADO");
  });
});
