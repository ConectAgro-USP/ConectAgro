import { useAuth } from "../auth/AuthContext";

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow">
        <h1 className="mb-2 text-xl font-semibold text-slate-800">Olá, {user?.name}</h1>
        <p className="mb-6 text-slate-500">{user?.email}</p>
        <button
          onClick={logout}
          className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-100"
        >
          Sair
        </button>
      </div>
    </main>
  );
}
