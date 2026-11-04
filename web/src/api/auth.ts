import { apiFetch } from "./client";

export function login(email: string, password: string): Promise<void> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string): Promise<void> {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}
