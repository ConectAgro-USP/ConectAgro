import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { findCard, FIRST_SEARCH, joao, maria, pageOf, renderFarmers, RETRY } from "../test/farmers";

describe("NearbyFarmers, loading the farmers", () => {
  it("tells the screen reader while the distances are calculated", async () => {
    renderFarmers(pageOf([maria]));

    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Calculando as distâncias...");
    expect(screen.queryByText(/Nenhum agricultor/)).not.toBeInTheDocument();
    await findCard("Maria S.");

    expect(screen.getAllByRole("status")[0]).toBeEmptyDOMElement();
  });

  it("shows why the distances could not be calculated and tries again", async () => {
    const detail = "Não foi possível calcular as distâncias agora. Tente novamente mais tarde";
    const { fetchMock } = renderFarmers(jsonResponse({ detail }, 503), pageOf([maria]));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText(/Nenhum agricultor/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: RETRY }));

    await findCard("Maria S.");
    expect(fetchMock.mock.calls[1][0]).toBe(FIRST_SEARCH);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
  });

  it("asks to try again when the server cannot be reached", async () => {
    renderFarmers(new TypeError("Failed to fetch"), pageOf([maria]));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
    await userEvent.click(screen.getByRole("button", { name: RETRY }));

    expect(await findCard("Maria S.")).toBeInTheDocument();
  });

  it.each([401, 403])("reloads the user when the API answers %i", async (status) => {
    const { auth } = renderFarmers(jsonResponse({ detail: "Sem acesso" }, status));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("shows more farmers when there is another page", async () => {
    const { fetchMock } = renderFarmers(pageOf([maria], 1, 2, 2), pageOf([joao], 2, 2, 2));
    await findCard("Maria S.");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais agricultores" }));

    expect(await findCard("João V.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/farmers?max_distance_km=15&page=2&page_size=100");
    expect(screen.getByRole("heading", { name: "Maria S." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar mais/ })).not.toBeInTheDocument();
  });

  it("shows a farmer repeated on the next page once, where it first appeared", async () => {
    renderFarmers(pageOf([maria], 1, 2, 2), pageOf([joao, maria], 2, 2, 2));
    await findCard("Maria S.");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais agricultores" }));

    await findCard("João V.");
    const names = screen.getAllByRole("heading", { level: 2 }).map((title) => title.textContent);
    expect(names).toEqual(["Maria S.", "João V."]);
  });
});
