import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { user, loading, login } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <h1 className="mb-6 text-2xl font-semibold text-slate-800">ConectAgro</h1>
        <button
          onClick={login}
          className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Continuar com Google
        </button>
      </div>
    </main>
  );
}
