import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import type { AuthContextValue } from "../auth/AuthContext";
import {
  ana,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  sentBody,
  stubFetch,
} from "../test/helpers";
import { SignUp } from "./SignUp";

function renderSignUp(auth: AuthContextValue = fakeAuth()) {
  renderWithAuth(
    <Routes>
      <Route path="/cadastro" element={<SignUp />} />
      <Route path="/login" element={<p>Tela de entrada</p>} />
      <Route path="/" element={<p>Painel</p>} />
    </Routes>,
    auth,
    "/cadastro",
  );
  return auth;
}

async function fillForm(password: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText("Nome completo"), "Ana Souza");
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await userEvent.type(screen.getByLabelText("Crie uma senha"), password);
  await userEvent.type(screen.getByLabelText("Confirme sua senha"), confirmation);
}

describe("SignUp", () => {
  it("creates the account, logs in and reloads the session", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ message: "Conta criada com sucesso", user_id: 1 }, 201),
      jsonResponse({ message: "Login realizado com sucesso" }),
    );
    const auth = renderSignUp();

    await fillForm("senha-forte", "senha-forte");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/register");
    expect(sentBody(fetchMock, 0)).toEqual({
      name: "Ana Souza",
      email: "ana@example.com",
      password: "senha-forte",
    });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/login");
  });

  it("does not call the API when the passwords differ", async () => {
    const fetchMock = stubFetch();
    renderSignUp();

    await fillForm("senha-forte", "senha-fraca");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("As senhas não são iguais");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the API message when the e-mail is taken", async () => {
    const fetchMock = stubFetch(jsonResponse({ detail: "E-mail já cadastrado" }, 400));
    const auth = renderSignUp();

    await fillForm("senha-forte", "senha-forte");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail já cadastrado");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });

  it("explains the password size and shows the password on request", async () => {
    renderSignUp();
    const password = screen.getByLabelText("Crie uma senha");

    await userEvent.click(screen.getAllByRole("button", { name: "Mostrar senha" })[0]);

    expect(password).toHaveAccessibleDescription("Pelo menos 8 caracteres.");
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveAttribute("spellcheck", "false");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();
  });

  it("creates the account with Google", async () => {
    const auth = renderSignUp();

    await userEvent.click(screen.getByRole("button", { name: "Criar conta com o Google" }));

    expect(auth.loginWithGoogle).toHaveBeenCalledOnce();
  });

  it("redirects a logged in user to the dashboard", () => {
    renderSignUp(fakeAuth({ user: ana }));

    expect(screen.getByText("Painel")).toBeInTheDocument();
  });

  it("links to the login page", async () => {
    renderSignUp();

    await userEvent.click(screen.getByRole("link", { name: "Entrar" }));

    expect(screen.getByText("Tela de entrada")).toBeInTheDocument();
  });
});
