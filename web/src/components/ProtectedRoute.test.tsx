import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import type { ProfileRead, ProfileType } from "../api/profiles";
import {
  ana,
  anaAsBuyer,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  stubFetch,
  villageVilaVerde,
} from "../test/helpers";
import { ProtectedRoute } from "./ProtectedRoute";

function renderRoute(user: ProfileRead | null, allowedProfile?: ProfileType) {
  return renderWithAuth(
    <Routes>
      <Route path="/login" element={<p>Tela de entrada</p>} />
      <Route path="/" element={<p>Painel</p>} />
      <Route
        path="/restrita"
        element={
          <ProtectedRoute allowedProfile={allowedProfile}>
            <p>Área restrita</p>
          </ProtectedRoute>
        }
      />
    </Routes>,
    fakeAuth({ user }),
    "/restrita",
  );
}

describe("ProtectedRoute", () => {
  it("renders nothing while the session loads", () => {
    const { container } = renderWithAuth(
      <ProtectedRoute>
        <p>Área restrita</p>
      </ProtectedRoute>,
      fakeAuth({ loading: true }),
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("warns when the session could not be checked", () => {
    renderWithAuth(
      <ProtectedRoute>
        <p>Área restrita</p>
      </ProtectedRoute>,
      fakeAuth({ sessionError: true }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Erro ao verificar sua sessão");
  });

  it("sends a visitor to the login", () => {
    renderRoute(null);

    expect(screen.getByText("Tela de entrada")).toBeInTheDocument();
  });

  it("asks a user without profile to choose one", () => {
    renderRoute(ana);

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
  });

  it("shows the pending link instead of the page", () => {
    renderRoute(anaAsBuyer("PENDENTE"));

    expect(screen.getByRole("heading", { name: "Aguardando aprovação" })).toBeInTheDocument();
    expect(screen.queryByText("Área restrita")).not.toBeInTheDocument();
  });

  it("shows the rejected link instead of the page", async () => {
    stubFetch(jsonResponse([villageVilaVerde]));

    renderRoute(anaAsBuyer("RECUSADO"));

    expect(screen.getByRole("heading", { name: "Vínculo recusado" })).toBeInTheDocument();
    expect(await screen.findByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(screen.queryByText("Área restrita")).not.toBeInTheDocument();
  });

  it("lets an approved buyer in", () => {
    renderRoute(anaAsBuyer("APROVADO"));

    expect(screen.getByText("Área restrita")).toBeInTheDocument();
  });

  it("sends another profile to the dashboard when the route is restricted", () => {
    renderRoute({ ...ana, profile_type: "farmer" }, "apartment");

    expect(screen.getByText("Painel")).toBeInTheDocument();
  });

  it("lets the allowed profile in when the route is restricted", () => {
    renderRoute({ ...ana, profile_type: "apartment" }, "apartment");

    expect(screen.getByText("Área restrita")).toBeInTheDocument();
  });
});
