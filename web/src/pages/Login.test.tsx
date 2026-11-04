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
import { Login } from "./Login";

function renderLogin(auth: AuthContextValue = fakeAuth(), url = "/login") {
  renderWithAuth(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<p>Tela de cadastro</p>} />
      <Route path="/" element={<p>Painel</p>} />
    </Routes>,
    auth,
    url,
  );
  return auth;
}

async function submitLogin(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("E-mail"), email);
  await userEvent.type(screen.getByLabelText("Senha"), password);
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Login", () => {
  it("calls loginWithGoogle when the Google button is clicked", async () => {
    const auth = renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Entrar com o Google" }));

    expect(auth.loginWithGoogle).toHaveBeenCalledOnce();
  });

  it("shows the Google error from the URL", () => {
    renderLogin(fakeAuth(), "/login?error=google");

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível entrar com o Google");
  });

  it("redirects a logged in user to the dashboard", () => {
    renderLogin(fakeAuth({ user: ana }));

    expect(screen.getByText("Painel")).toBeInTheDocument();
  });

  it("logs in with e-mail and password and reloads the session", async () => {
    const fetchMock = stubFetch(jsonResponse({ message: "Login realizado com sucesso" }));
    const auth = renderLogin();

    await submitLogin("ana@example.com", "senha-forte");

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
    expect(sentBody(fetchMock, 0)).toEqual({ email: "ana@example.com", password: "senha-forte" });
  });

  it("shows the API message when the password is wrong", async () => {
    stubFetch(jsonResponse({ detail: "E-mail ou senha incorretos" }, 401));
    const auth = renderLogin();

    await submitLogin("ana@example.com", "senha-errada");

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos");
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });

  it("lets password managers fill the e-mail as the username", () => {
    renderLogin();

    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
  });

  it("links to the sign up page", async () => {
    renderLogin();

    await userEvent.click(screen.getByRole("link", { name: "Criar conta" }));

    expect(screen.getByText("Tela de cadastro")).toBeInTheDocument();
  });
});
