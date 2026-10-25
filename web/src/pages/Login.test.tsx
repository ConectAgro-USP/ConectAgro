import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext, type User } from "../auth/AuthContext";
import { Login } from "./Login";

const ana: User = { id: 1, email: "ana@example.com", name: "Ana", picture_url: null };

function renderLogin({ user = null, url = "/login" }: { user?: User | null; url?: string } = {}) {
  const login = vi.fn();
  const auth = { user, loading: false, sessionError: false, login, logout: vi.fn() };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<p>Painel</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { login };
}

describe("Login", () => {
  it("calls login when the Google button is clicked", async () => {
    const { login } = renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    expect(login).toHaveBeenCalledOnce();
  });

  it("shows the Google error from the URL", () => {
    renderLogin({ url: "/login?error=google" });

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível entrar com o Google.");
  });

  it("redirects a logged in user to the dashboard", () => {
    renderLogin({ user: ana });

    expect(screen.getByText("Painel")).toBeInTheDocument();
  });
});
