import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { findCard, interestsResponse, laranja, mandioca, renderInterests } from "../test/interests";
import { MyInterests } from "./MyInterests";

describe("MyInterests, list", () => {
  it("lists the interests in the API order, with a link to each product", async () => {
    const fetchMock = renderInterests(interestsResponse([mandioca, laranja]));

    expect(screen.getByRole("heading", { level: 1, name: "Meus interesses" })).toBeInTheDocument();
    const card = await findCard("Mandioca");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/interests/me?page=1",
      expect.anything(),
    );
    expect(within(card).getByRole("link", { name: "Mandioca" })).toHaveAttribute(
      "href",
      "/produtos/produto-1",
    );
    expect(within(card).getByText("Disponível")).toBeInTheDocument();
    const unavailable = await findCard("Laranja");
    expect(unavailable).toHaveTextContent("3 kg");
    expect(within(unavailable).getByRole("link")).toHaveAttribute("href", "/produtos/produto-2");
    const names = screen.getAllByRole("heading", { level: 2 }).map((name) => name.textContent);
    expect(names).toEqual(["Mandioca", "Laranja"]);
  });

  it("shows a deleted product's name without a link", async () => {
    renderInterests(interestsResponse([{ ...laranja, product_public_id: null }]));

    const card = await findCard("Laranja");
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("Indisponível");
  });

  it("falls back to Produto removido, without a link, when the API sends no product", async () => {
    const removed = { ...laranja, product_public_id: null, product_name: null };
    renderInterests(interestsResponse([removed]));

    const card = await findCard("Produto removido");
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when there are no interests, only after loading them", async () => {
    renderInterests(interestsResponse([]));
    expect(screen.queryByText(/Você ainda não registrou interesses/)).not.toBeInTheDocument();

    expect(await screen.findByText(/Você ainda não registrou interesses/)).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the error and tries again", async () => {
    renderInterests(jsonResponse({}, 500), interestsResponse([mandioca]));

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado");
    expect(screen.queryByText(/Você ainda não registrou interesses/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await findCard("Mandioca")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reloads the user when the API refuses the profile", async () => {
    const message = "Acesso permitido apenas para moradores";
    stubFetch(jsonResponse({ detail: message }, 403));
    const auth = fakeAuth({ user: anaAsBuyer("APROVADO") });

    renderWithAuth(<MyInterests />, auth);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });
});
