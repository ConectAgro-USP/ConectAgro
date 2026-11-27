import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Resident } from "../api/residents";
import { jsonResponse, pageResponse } from "../test/helpers";
import { findCard, press, renderResidents, tita } from "../test/residents";

const MORE = { name: "Mostrar mais moradores" };
const FIRST_PAGE = "/api/apartments/me/buyers?page=1&status=PENDENTE";
const BEFORE = { page_size: 2, total: 4, total_pages: 2 };
const AFTER = { page_size: 2, total: 3, total_pages: 2 };

function pending(id: number, name: string): Resident {
  return { ...tita, public_id: `morador-${id}`, user: { name, email: `${id}@example.com` } };
}

const ana = pending(1, "Ana Alves");
const bruno = pending(2, "Bruno Braga");
const carla = pending(3, "Carla Costa");
const davi = pending(4, "Davi Dias");

// sem a Ana a Carla sobe para a primeira página, e o Davi fica na segunda
function withoutAna(url: string): Response {
  const page = new URL(url, "http://localhost").searchParams.get("page");
  return page === "1" ? pageResponse([bruno, carla], AFTER) : pageResponse([davi], AFTER);
}

describe("Residents, list after an answer that failed", () => {
  it("reads again from the first page, so no request is left out", async () => {
    const { fetchMock } = renderResidents(
      pageResponse([ana, bruno], BEFORE),
      pageResponse([carla, davi], { ...BEFORE, page: 2 }),
      jsonResponse({ ...ana, link_status: "APROVADO" }),
      new TypeError("Failed to fetch"),
    );
    fetchMock.mockImplementationOnce(async (url) => withoutAna(String(url)));
    await findCard("Ana Alves");
    await userEvent.click(screen.getByRole("button", MORE));
    await findCard("Carla Costa");
    await press(await findCard("Ana Alves"), "Aprovar");
    expect(await screen.findByText("3 pedidos esperando sua resposta")).toBeInTheDocument();

    await press(await findCard("Davi Dias"), "Aprovar");

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
    await waitFor(() => expect(screen.queryByText("Carregando...")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Carla Costa" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][0]).toBe(FIRST_PAGE);
    expect(screen.getByText("3 pedidos esperando sua resposta")).toBeInTheDocument();
    expect(screen.getByRole("button", MORE)).toBeEnabled();
  });
});
