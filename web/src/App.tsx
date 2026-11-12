import { Navigate, Outlet, Route, Routes } from "react-router";
import { AppHeader } from "./components/AppHeader";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { BuildingPurchases } from "./pages/BuildingPurchases";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { MyProfile } from "./pages/MyProfile";
import { MySales } from "./pages/MySales";
import { SignUp } from "./pages/SignUp";

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
        <Route
          path="/compras"
          element={
            <ProtectedRoute allowedProfile="apartment">
              <BuildingPurchases />
            </ProtectedRoute>
          }
        />
        <Route path="/perfil" element={<MyProfile />} />
        <Route
          path="/vendas"
          element={
            <ProtectedRoute allowedProfile="farmer">
              <MySales />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
