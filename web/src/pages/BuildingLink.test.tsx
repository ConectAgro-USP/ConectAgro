import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api/client";
import type { ApartmentMatch } from "../api/profiles";
import {
  anaAsBuyer,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  savedUser,
  sentBody,
  stubFetch,
  villageVilaVerde,
  villageVilaVerdeMatch,
} from "../test/helpers";
import { PendingLink, RejectedLink } from "./BuildingLink";

const bauru: ApartmentMatch = {
  ...villageVilaVerdeMatch,
  public_id: "0b9f8d2a-1c3e-4f5a-9b7c-6d5e4f3a2b1c",
  building_name: "Edifício Bauru",
  building_cnpj: "60701190000104",
  manager_short_name: "Bruno C.",
};

describe("PendingLink", () => {
  it("shows the building and reloads the session", async () => {
    const auth = fakeAuth({ user: anaAsBuyer("PENDENTE") });
    renderWithAuth(<PendingLink />, auth);

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(screen.getByRole("heading", { name: "Aguardando aprovação" })).toBeInTheDocument();
    expect(screen.getByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(auth.refreshUser).toHaveBeenCalledOnce();
  });

  it("shows why the session could not be reloaded", async () => {
    const refreshUser = vi.fn().mockRejectedValue(new ApiError(503, "Tente mais tarde"));
    renderWithAuth(<PendingLink />, fakeAuth({ user: anaAsBuyer("PENDENTE"), refreshUser }));

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tente mais tarde");
  });

  it("keeps the buttons disabled while the session reloads", async () => {
    const refreshUser = vi.fn(() => new Promise<void>(() => {}));
    renderWithAuth(<PendingLink />, fakeAuth({ user: anaAsBuyer("PENDENTE"), refreshUser }));

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(screen.getByRole("button", { name: "Atualizar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeDisabled();
  });

  it("logs out while waiting", async () => {
    const auth = fakeAuth({ user: anaAsBuyer("PENDENTE") });
    renderWithAuth(<PendingLink />, auth);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(auth.logout).toHaveBeenCalledOnce();
  });
});

describe("RejectedLink", () => {
  it("asks for the same building again with the previous data", async () => {
    const pending = anaAsBuyer("PENDENTE");
    const fetchMock = stubFetch(jsonResponse([villageVilaVerdeMatch]), jsonResponse(pending));
    const auth = fakeAuth({ user: anaAsBuyer("RECUSADO") });
    renderWithAuth(<RejectedLink />, auth);

    expect(screen.getByLabelText("CNPJ do Prédio")).toHaveValue("50673649000144");
    expect(screen.getByLabelText("Bloco (opcional)")).toHaveValue("B");
    expect(screen.getByLabelText("Apartamento")).toHaveValue("42");
    await userEvent.click(await screen.findByLabelText("Este é o seu condomínio?"));
    await userEvent.click(screen.getByRole("button", { name: "Pedir vínculo" }));

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    await expect(savedUser(auth)).resolves.toEqual(pending);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/profiles/me");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 1)).toEqual({
      apartment_public_id: villageVilaVerde.public_id,
      block: "B",
      unit: "42",
    });
  });

  it("asks for another building", async () => {
    const fetchMock = stubFetch(
      jsonResponse([villageVilaVerdeMatch]),
      jsonResponse([bauru]),
      jsonResponse(anaAsBuyer("PENDENTE")),
    );
    renderWithAuth(<RejectedLink />, fakeAuth({ user: anaAsBuyer("RECUSADO") }));
    await screen.findByText("Cond. Village Vila Verde");
    const cnpj = screen.getByLabelText("CNPJ do Prédio");
    const unit = screen.getByLabelText("Apartamento");

    await userEvent.clear(cnpj);
    await userEvent.clear(screen.getByLabelText("Bloco (opcional)"));
    await userEvent.clear(unit);
    await userEvent.type(unit, "101");
    await userEvent.type(cnpj, "60.701.190/0001-04");
    await userEvent.click(await screen.findByLabelText("Este é o seu condomínio?"));
    await userEvent.click(screen.getByRole("button", { name: "Pedir vínculo" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText("Edifício Bauru")).toBeInTheDocument();
    expect(sentBody(fetchMock, 2)).toEqual({
      apartment_public_id: bauru.public_id,
      block: null,
      unit: "101",
    });
  });

  it("needs a registered building to ask again", async () => {
    const fetchMock = stubFetch(jsonResponse([]));
    renderWithAuth(<RejectedLink />, fakeAuth({ user: anaAsBuyer("RECUSADO") }));
    await screen.findByText(/Nenhum prédio cadastrado com este CNPJ/);

    await userEvent.click(screen.getByRole("button", { name: "Pedir vínculo" }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps the buttons disabled while the new request is sent", async () => {
    const fetchMock = stubFetch(jsonResponse([villageVilaVerdeMatch]));
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
    renderWithAuth(<RejectedLink />, fakeAuth({ user: anaAsBuyer("RECUSADO") }));

    await userEvent.click(await screen.findByLabelText("Este é o seu condomínio?"));
    await userEvent.click(screen.getByRole("button", { name: "Pedir vínculo" }));

    expect(screen.getByRole("button", { name: "Pedir vínculo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeDisabled();
  });

  it("logs out from the rejected link", async () => {
    stubFetch(jsonResponse([villageVilaVerdeMatch]));
    const auth = fakeAuth({ user: anaAsBuyer("RECUSADO") });
    renderWithAuth(<RejectedLink />, auth);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
