import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ApiError } from "../api/client";
import type { ProfileRead } from "../api/profiles";
import { ana, anaAsBuyer, jsonResponse, stubFetch } from "../test/helpers";
import { useAuth } from "./AuthContext";
import { AuthProvider } from "./AuthProvider";

const farmer: ProfileRead = { ...ana, profile_type: "farmer" };

function ShowSession() {
  const { user, profileType, linkStatus, loading, sessionError, refreshUser, saveProfile, logout } =
    useAuth();
  const [saveError, setSaveError] = useState("");

  function saveWithConflict() {
    saveProfile(Promise.reject(new ApiError(409, "Conflito"))).catch((conflictError: Error) =>
      setSaveError(conflictError.message),
    );
  }

  if (loading) return <p>Carregando</p>;
  return (
    <>
      <p>{user ? user.name : "Sem sessão"}</p>
      <p>Perfil: {profileType ?? "nenhum"}</p>
      <p>Vínculo: {linkStatus ?? "nenhum"}</p>
      {sessionError && <p>Erro de sessão</p>}
      {saveError && <p>Erro ao salvar: {saveError}</p>}
      <button onClick={() => refreshUser()}>Atualizar</button>
      <button onClick={() => saveProfile(Promise.resolve(farmer))}>Salvar</button>
      <button onClick={saveWithConflict}>Salvar com conflito</button>
      <button onClick={() => logout()}>Sair</button>
    </>
  );
}

function renderSession() {
  render(
    <AuthProvider>
      <ShowSession />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  it("loads the user with the profile type and the link status", async () => {
    const fetchMock = stubFetch(jsonResponse(anaAsBuyer("PENDENTE")));

    renderSession();

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Perfil: buyer")).toBeInTheDocument();
    expect(screen.getByText("Vínculo: PENDENTE")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/profiles/me");
  });

  it("treats 401 as a visitor without session", async () => {
    stubFetch(jsonResponse({ detail: "Não autenticado" }, 401));

    renderSession();

    expect(await screen.findByText("Sem sessão")).toBeInTheDocument();
    expect(screen.queryByText("Erro de sessão")).not.toBeInTheDocument();
  });

  it("reports a session error when the profile cannot be loaded", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(jsonResponse({ detail: "Erro" }, 500));

    renderSession();

    expect(await screen.findByText("Erro de sessão")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("forgets the session error once a reload works", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(jsonResponse({ detail: "Erro" }, 500), jsonResponse(ana));
    renderSession();
    await screen.findByText("Erro de sessão");

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.queryByText("Erro de sessão")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("reloads the user on refresh and forgets it on logout", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ detail: "Não autenticado" }, 401),
      jsonResponse(anaAsBuyer("APROVADO")),
      jsonResponse({ ok: true }),
    );
    renderSession();
    await screen.findByText("Sem sessão");

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("Vínculo: APROVADO")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByText("Sem sessão")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/auth/logout");
  });

  it("keeps the profile the API returns after saving it", async () => {
    stubFetch(jsonResponse(ana));
    renderSession();
    await screen.findByText("Perfil: nenhum");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Perfil: farmer")).toBeInTheDocument();
  });

  it("reloads the session on a conflict and still reports it", async () => {
    const fetchMock = stubFetch(jsonResponse(ana), jsonResponse(farmer));
    renderSession();
    await screen.findByText("Perfil: nenhum");

    await userEvent.click(screen.getByRole("button", { name: "Salvar com conflito" }));

    expect(await screen.findByText("Perfil: farmer")).toBeInTheDocument();
    expect(screen.getByText("Erro ao salvar: Conflito")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the user without profile when the conflict was not about the profile", async () => {
    stubFetch(jsonResponse(ana), jsonResponse(ana));
    renderSession();
    await screen.findByText("Perfil: nenhum");

    await userEvent.click(screen.getByRole("button", { name: "Salvar com conflito" }));

    expect(await screen.findByText("Erro ao salvar: Conflito")).toBeInTheDocument();
    expect(screen.getByText("Perfil: nenhum")).toBeInTheDocument();
  });
});
