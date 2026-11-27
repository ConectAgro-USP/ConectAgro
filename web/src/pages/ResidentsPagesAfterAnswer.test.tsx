import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, pageResponse } from "../test/helpers";
import { bia, findCard, press, renderResidents, tita } from "../test/residents";

const MORE = { name: "Mostrar mais moradores" };
const PENDING = "/api/apartments/me/buyers?page=1&status=PENDENTE";
// 21 pedidos em duas páginas, e um deles recebe resposta
const BEFORE = { total: 21, total_pages: 2 };
const AFTER = { total: 20, total_pages: 1 };

describe("Residents, pages after an answer", () => {
  it("asks for the first page again, so the request that moved up shows", async () => {
    const { fetchMock } = renderResidents(
      pageResponse([tita], BEFORE),
      jsonResponse(tita),
      pageResponse([bia], AFTER),
    );
    const card = await findCard("Tita Russell");
    await press(card, "Aprovar");
    await within(card).findByRole("status");

    await userEvent.click(screen.getByRole("button", MORE));

    expect(await findCard("Bia Lima")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe(PENDING);
    expect(within(card).getByRole("status")).toHaveTextContent(/^Aprovado/);
    expect(screen.queryByRole("button", MORE)).not.toBeInTheDocument();
  });

  it("keeps the count of the API after the page comes again", async () => {
    renderResidents(pageResponse([tita], BEFORE), jsonResponse(tita), pageResponse([bia], AFTER));
    const card = await findCard("Tita Russell");
    await press(card, "Aprovar");
    expect(await screen.findByText("20 pedidos esperando sua resposta")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", MORE));

    await findCard("Bia Lima");
    expect(screen.getByText("20 pedidos esperando sua resposta")).toBeInTheDocument();
  });
});
