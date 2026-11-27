import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findCard, orange, press, productsResponse } from "../test/products";
import { MyProducts } from "./MyProducts";

function loggedOut(): Response {
  return jsonResponse({ detail: "Não autenticado" }, 401);
}

function renderFarmer(...responses: Response[]) {
  stubFetch(...responses);
  const auth = fakeAuth({ user: anaAsFarmer });
  renderWithAuth(<MyProducts />, auth);
  return auth;
}

describe("MyProducts, session ended while writing", () => {
  it("reloads the user when saving a new product", async () => {
    const auth = renderFarmer(productsResponse([]), loggedOut());
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar produto" }));
    await userEvent.type(screen.getByLabelText("Nome do produto"), "Laranja");
    await userEvent.type(screen.getByLabelText("Preço por quilo (R$)"), "4.99");
    await userEvent.type(screen.getByLabelText("Quantidade (kg)"), "12");
    fireEvent.change(screen.getByLabelText("Data de vencimento"), {
      target: { value: "2030-10-25" },
    });

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("reloads the user when saving an edit", async () => {
    const auth = renderFarmer(productsResponse([orange]), loggedOut());
    await press(await findCard("Laranja"), "Editar");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("reloads the user when removing a product", async () => {
    const auth = renderFarmer(productsResponse([orange]), loggedOut());
    const card = await findCard("Laranja");
    await press(card, "Remover");

    await press(card, "Remover");

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });
});
