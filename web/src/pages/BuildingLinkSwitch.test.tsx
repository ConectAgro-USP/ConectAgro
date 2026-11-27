import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  confirmBuilding,
  edificioBauru,
  NAME_SEARCH_WAIT,
  searchByCnpj,
  typeInto,
} from "../test/buildings";
import {
  anaAsBuyer,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  savedUser,
  sentBody,
  stubFetch,
} from "../test/helpers";
import { PendingLink } from "./BuildingLink";

const PENDING_TITLE = "Aguardando aprovação";

async function openSwitch() {
  const auth = fakeAuth({ user: anaAsBuyer("PENDENTE") });
  renderWithAuth(<PendingLink />, auth);
  await userEvent.click(screen.getByRole("button", { name: "Trocar de prédio" }));
  return auth;
}

function askLink() {
  return userEvent.click(screen.getByRole("button", { name: "Pedir vínculo" }));
}

describe("switching building while pending", () => {
  it("opens the building choice keeping block and unit", async () => {
    stubFetch();
    await openSwitch();

    const title = screen.getByRole("heading", { name: "Trocar de prédio" });
    expect(title).toHaveFocus();
    expect(screen.getByLabelText("Nome do prédio")).toHaveValue("");
    expect(screen.getByLabelText("Bloco (opcional)")).toHaveValue("B");
    expect(screen.getByLabelText("Apartamento")).toHaveValue("42");
  });

  it("asks for the building found by name and goes back to the wait", async () => {
    const moved = anaAsBuyer("PENDENTE");
    const fetchMock = stubFetch(jsonResponse([edificioBauru]), jsonResponse(moved));
    const auth = await openSwitch();

    await typeInto("Nome do prédio", "Bauru");
    await screen.findByLabelText("Este é o seu condomínio?", {}, NAME_SEARCH_WAIT);
    await confirmBuilding();
    await askLink();

    expect(await screen.findByRole("heading", { name: PENDING_TITLE })).toBeInTheDocument();
    await expect(savedUser(auth)).resolves.toEqual(moved);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments?name=Bauru");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/profiles/me");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({
      apartment_public_id: edificioBauru.public_id,
      block: "B",
      unit: "42",
    });
  });

  it("asks for the building found by CNPJ", async () => {
    const moved = anaAsBuyer("PENDENTE");
    const fetchMock = stubFetch(jsonResponse([edificioBauru]), jsonResponse(moved));
    const auth = await openSwitch();

    await searchByCnpj();
    await typeInto("CNPJ do Prédio", "60.701.190/0001-04");
    await screen.findByLabelText("Este é o seu condomínio?");
    await confirmBuilding();
    await askLink();

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments?cnpj=60.701.190%2F0001-04");
    expect(sentBody(fetchMock, 1)).toMatchObject({ apartment_public_id: edificioBauru.public_id });
  });

  it("keeps the current request when the switch is cancelled", async () => {
    const fetchMock = stubFetch();
    const auth = await openSwitch();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("heading", { name: PENDING_TITLE })).toBeInTheDocument();
    expect(screen.getByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.saveProfile).not.toHaveBeenCalled();
  });

  it("stays on the choice when the API refuses the building", async () => {
    const refused = { detail: "Prédio não encontrado" };
    stubFetch(jsonResponse([edificioBauru]), jsonResponse(refused, 422));
    await openSwitch();

    await typeInto("Nome do prédio", "Bauru");
    await screen.findByLabelText("Este é o seu condomínio?", {}, NAME_SEARCH_WAIT);
    await confirmBuilding();
    await askLink();

    expect(await screen.findByRole("alert")).toHaveTextContent("Prédio não encontrado");
    expect(screen.getByRole("heading", { name: "Trocar de prédio" })).toBeInTheDocument();
  });

  it("does not ask for a building that was not confirmed", async () => {
    const fetchMock = stubFetch(jsonResponse([edificioBauru]));
    const auth = await openSwitch();

    await typeInto("Nome do prédio", "Bauru");
    await screen.findByLabelText("Este é o seu condomínio?", {}, NAME_SEARCH_WAIT);
    await askLink();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(auth.saveProfile).not.toHaveBeenCalled();
  });
});
