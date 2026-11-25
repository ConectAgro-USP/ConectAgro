import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ProfileRead } from "../api/profiles";
import { AuthContext } from "../auth/AuthContext";
import { ana, anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { Address } from "../test/RouterProbe";
import { Login } from "./Login";
import { SignUp } from "./SignUp";

// a sessão abre de verdade depois do login, como no AuthProvider
function SignInLater({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<ProfileRead | null>(null);
  const auth = fakeAuth({ user, refreshUser: async () => setUser(anaAsBuyer("APROVADO")) });
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

const ROUTES = (
  <>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<SignUp />} />
      <Route path="/produtos/:publicId" element={<p>Página do produto</p>} />
      <Route path="/" element={<p>Início</p>} />
    </Routes>
    <Address />
  </>
);

async function loginAt(url: string) {
  stubFetch(jsonResponse({ message: "Login realizado com sucesso" }));
  render(
    <SignInLater>
      <MemoryRouter initialEntries={[url]}>{ROUTES}</MemoryRouter>
    </SignInLater>,
  );
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-forte");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("login with a return path", () => {
  it("takes the user back to the page after the e-mail login", async () => {
    await loginAt("/login?proximo=%2Fprodutos%2Fprod-123");

    expect(await screen.findByText("Página do produto")).toBeVisible();
    expect(screen.getByTestId("address")).toHaveTextContent(/^\/produtos\/prod-123$/);
  });

  it("keeps the search of the catalog", async () => {
    await loginAt("/login?proximo=%2F%3Fq%3Dcouve");

    expect(await screen.findByText("Início")).toBeVisible();
    expect(screen.getByTestId("address")).toHaveTextContent(/^\/\?q=couve$/);
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "produtos"])(
    "goes to the start for the return %j",
    async (next) => {
      await loginAt(`/login?proximo=${encodeURIComponent(next)}`);

      expect(await screen.findByText("Início")).toBeVisible();
      expect(screen.getByTestId("address")).toHaveTextContent(/^\/$/);
    },
  );

  it("sends a user already logged in to the return path", () => {
    renderWithAuth(ROUTES, fakeAuth({ user: ana }), "/login?proximo=%2Fprodutos%2Fprod-123");

    expect(screen.getByText("Página do produto")).toBeVisible();
  });

  it("keeps the return in the link to the sign up and back", async () => {
    renderWithAuth(ROUTES, fakeAuth(), "/login?proximo=%2Fprodutos%2Fprod-123");

    await userEvent.click(screen.getByRole("link", { name: "Criar conta" }));

    expect(screen.getByTestId("address")).toHaveTextContent(
      /^\/cadastro\?proximo=%2Fprodutos%2Fprod-123$/,
    );
    const back = screen.getByRole("link", { name: "Entrar" });
    expect(back).toHaveAttribute("href", "/login?proximo=%2Fprodutos%2Fprod-123");
  });

  it("leaves the links plain without a return", () => {
    renderWithAuth(ROUTES, fakeAuth(), "/login");

    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
  });

  it("sends a new account to the return path", () => {
    renderWithAuth(ROUTES, fakeAuth({ user: ana }), "/cadastro?proximo=%2Fprodutos%2Fprod-123");

    expect(screen.getByText("Página do produto")).toBeVisible();
  });
});
