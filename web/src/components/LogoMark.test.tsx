import { screen } from "@testing-library/react";
import App from "../App";
import { Login } from "../pages/Login";
import { anaAsFarmer, fakeAuth, renderWithAuth } from "../test/helpers";

function mark(): HTMLElement {
  return screen.getByRole("presentation");
}

describe("ConectAgro mark", () => {
  it("sits above the name on the login, hidden from screen readers", () => {
    renderWithAuth(<Login />, fakeAuth(), "/login");

    expect(mark()).toHaveAttribute("alt", "");
    expect(mark().getAttribute("src")).toMatch(/logo-mark/);
    expect(mark().nextElementSibling).toHaveTextContent("ConectAgro");
  });

  it("shows on the page for an unknown address", () => {
    renderWithAuth(<App />, fakeAuth({ user: anaAsFarmer }), "/pagina-que-nao-existe");

    expect(mark().getAttribute("src")).toMatch(/logo-mark/);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Página não encontrada");
  });
});
