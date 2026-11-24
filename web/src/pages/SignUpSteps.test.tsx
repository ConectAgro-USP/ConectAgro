import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ana, fakeAuth, renderWithAuth } from "../test/helpers";
import { Login } from "./Login";
import { ProfileSetup } from "./ProfileSetup";
import { SignUp } from "./SignUp";

const CPF_REASON = "Usamos o CPF só para garantir um perfil por pessoa.";

async function chooseProfile(option: string) {
  renderWithAuth(<ProfileSetup />, fakeAuth({ user: ana }));
  await userEvent.click(screen.getByText(option));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("sign-up steps", () => {
  it("opens the sign-up at step 1", () => {
    renderWithAuth(<SignUp />, fakeAuth());

    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.getByText("Passo 1 de 3")).toBeInTheDocument();
  });

  it("asks how the user will use the app at step 2", () => {
    renderWithAuth(<ProfileSetup />, fakeAuth({ user: ana }));

    const question = "Como você vai usar o ConectAgro?";
    expect(screen.getByRole("heading", { name: question })).toBeInTheDocument();
    expect(screen.getByText("Passo 2 de 3")).toBeInTheDocument();
  });

  it("keeps step 2 for whoever arrives through Google", () => {
    const fromGoogle = { ...ana, name: "Ana do Google", email: "ana@gmail.com" };
    renderWithAuth(<ProfileSetup />, fakeAuth({ user: fromGoogle }));

    expect(screen.getByText("Passo 2 de 3")).toBeInTheDocument();
    expect(screen.queryByText("Passo 1 de 3")).not.toBeInTheDocument();
  });

  it.each([
    ["Quero vender", "Dados do sítio"],
    ["Sou síndico", "Dados do prédio"],
    ["Quero comprar", "Seu apartamento"],
  ])("names step 3 after the choice %s", async (option, title) => {
    await chooseProfile(option);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("Passo 3 de 3")).toBeInTheDocument();
  });

  it("goes back to step 2 from step 3", async () => {
    await chooseProfile("Quero vender");

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByText("Passo 2 de 3")).toBeInTheDocument();
  });

  it("shows no step on the login", () => {
    renderWithAuth(<Login />, fakeAuth());

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText(/^Passo/)).not.toBeInTheDocument();
  });
});

describe("CPF field", () => {
  it.each([
    ["Quero vender", "CPF"],
    ["Sou síndico", "CPF do síndico"],
    ["Quero comprar", "CPF"],
  ])("explains why the CPF is asked after %s", async (option, label) => {
    await chooseProfile(option);

    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(CPF_REASON);
  });
});
