import { useState, type SubmitEvent } from "react";
import { Link, Navigate } from "react-router";
import { login, register } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleButton, PrimaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { PasswordField, TextField } from "../components/TextField";
import { useAction } from "../hooks/useAction";

export function SignUp() {
  const { user, loading, loginWithGoogle, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { error, setError, pending, run } = useAction();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("As senhas não são iguais");
      return;
    }
    run(async () => {
      await register(name, email, password);
      await login(email, password);
      await refreshUser();
    });
  }

  return (
    <AuthLayout title="Conta">
      <GoogleButton onClick={loginWithGoogle}>Criar conta com o Google</GoogleButton>
      <p className="my-8 text-center font-bold">Ou com e-mail</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <TextField
          label="Nome completo"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label="Crie uma senha"
          autoComplete="new-password"
          minLength={8}
          hint="Pelo menos 8 caracteres."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <PasswordField
          label="Confirme sua senha"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <FormError message={error} />
        <PrimaryButton disabled={pending} className="w-full">
          Continuar
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center text-stone-600">
        Já tem conta?{" "}
        <Link to="/login" className="font-bold text-lime-800 underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
