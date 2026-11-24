import type { ReactNode } from "react";
import { Route, Routes } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { MyProfile } from "./pages/MyProfile";
import { NotFound } from "./pages/NotFound";
import { ProductDetail } from "./pages/ProductDetail";
import { SignUp } from "./pages/SignUp";
import { RESTRICTED_PAGES } from "./restrictedPages";

function Titled({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  useDocumentTitle(title);
  return children;
}

function Home() {
  const { profileType } = useAuth();
  // o morador e o síndico começam no catálogo
  return (
    <Titled title={profileType === "farmer" ? "Início" : "Produtos"}>
      <Dashboard />
    </Titled>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Titled title="Entrar">
            <Login />
          </Titled>
        }
      />
      <Route
        path="/cadastro"
        element={
          <Titled title="Criar conta">
            <SignUp />
          </Titled>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route
          path="/perfil"
          element={
            <Titled title="Meu perfil">
              <MyProfile />
            </Titled>
          }
        />
        <Route path="/produtos/:publicId" element={<ProductDetail />} />
        {RESTRICTED_PAGES.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={
              <ProtectedRoute allowedProfiles={page.profiles}>
                <Titled title={page.title}>{page.element}</Titled>
              </ProtectedRoute>
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
