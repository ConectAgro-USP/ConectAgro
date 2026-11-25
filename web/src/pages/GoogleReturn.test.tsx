import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { anaAsBuyer, fakeAuth, renderWithAuth } from "../test/helpers";
import { renderVisitorApp } from "../test/visitor";
import { Login } from "./Login";
import { SignUp } from "./SignUp";

const KEY = "conectagro:proximo";

function renderAuthPage(url: string) {
  const auth = fakeAuth();
  renderWithAuth(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<SignUp />} />
    </Routes>,
    auth,
    url,
  );
  return auth;
}

describe("return path with the Google login", () => {
  afterEach(() => sessionStorage.clear());

  it("keeps the page in the tab before leaving for Google", async () => {
    const auth = renderAuthPage("/login?proximo=%2Fprodutos%2Fprod-123");

    await userEvent.click(screen.getByRole("button", { name: "Entrar com o Google" }));

    expect(sessionStorage.getItem(KEY)).toBe("/produtos/prod-123");
    expect(auth.loginWithGoogle).toHaveBeenCalledOnce();
  });

  it("keeps the page from the sign up too", async () => {
    renderAuthPage("/cadastro?proximo=%2Fprodutos%2Fprod-123");

    await userEvent.click(screen.getByRole("button", { name: "Criar conta com o Google" }));

    expect(sessionStorage.getItem(KEY)).toBe("/produtos/prod-123");
  });

  it("keeps nothing for a return from outside the site", async () => {
    renderAuthPage("/login?proximo=%2F%2Fevil.example");

    await userEvent.click(screen.getByRole("button", { name: "Entrar com o Google" }));

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("opens the kept page once the session is back", async () => {
    sessionStorage.setItem(KEY, "/produtos/prod-123");

    renderVisitorApp("/", {}, fakeAuth({ user: anaAsBuyer("APROVADO") }));

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(/^\/produtos\/prod-123$/);
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the page for another try when the Google login fails", async () => {
    sessionStorage.setItem(KEY, "/produtos/prod-123");

    const { auth } = renderVisitorApp("/login?error=google");

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(
        /^\/login\?error=google&proximo=%2Fprodutos%2Fprod-123$/,
      );
    });
    expect(screen.getByText("Não foi possível entrar com o Google")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Entrar com o Google" }));
    expect(sessionStorage.getItem(KEY)).toBe("/produtos/prod-123");
    expect(auth.loginWithGoogle).toHaveBeenCalledOnce();
  });

  it("forgets the kept page when a visitor opens the home", () => {
    sessionStorage.setItem(KEY, "/produtos/prod-123");

    renderVisitorApp("/");

    expect(screen.getByTestId("address")).toHaveTextContent(/^\/$/);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("refuses a kept page from outside the site", () => {
    sessionStorage.setItem(KEY, "//evil.example");

    renderVisitorApp("/", {}, fakeAuth({ user: anaAsBuyer("APROVADO") }));

    expect(screen.getByTestId("address")).toHaveTextContent(/^\/$/);
  });
});
