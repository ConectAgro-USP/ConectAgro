import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { login } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleButton, PrimaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { PasswordField, TextField } from "../components/TextField";
import { useAction } from "../hooks/useAction";

export function Login() {
  const { user, loading, loginWithGoogle, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, pending, run } = useAction();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await login(email, password);
      await refreshUser();
    });
  }

  return (
    <AuthLayout title="Entrar">
      <div className="space-y-4">
        <GoogleButton onClick={loginWithGoogle}>Entrar com o Google</GoogleButton>
        {searchParams.get("error") === "google" && (
          <FormError message="Não foi possível entrar com o Google" />
        )}
      </div>
      <p className="my-8 text-center font-bold">Ou com e-mail</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <TextField
          label="E-mail"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormError message={error} />
        <PrimaryButton disabled={pending} className="w-full">
          Entrar
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center text-stone-600">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-bold text-lime-800 underline">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}
