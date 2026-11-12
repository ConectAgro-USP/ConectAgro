import { Navigate, Outlet, Route, Routes } from "react-router";
import { AppHeader } from "./components/AppHeader";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { MyProfile } from "./pages/MyProfile";
import { SignUp } from "./pages/SignUp";
import { RESTRICTED_PAGES } from "./restrictedPages";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<SignUp />} />
      <Route
        element={
          <ProtectedRoute>
            <AppHeader />
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/perfil" element={<MyProfile />} />
        {RESTRICTED_PAGES.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={<ProtectedRoute allowedProfile={page.profile}>{page.element}</ProtectedRoute>}
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
