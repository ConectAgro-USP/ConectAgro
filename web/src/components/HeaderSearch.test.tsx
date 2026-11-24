import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { anaAsBuyer, anaAsFarmer, fakeAuth, renderWithAuth, stubSilentApi } from "../test/helpers";
import { Address } from "../test/RouterProbe";
import { AppHeader } from "./AppHeader";

function renderHeader(url: string, profileType: "farmer" | "apartment" | "buyer" | null) {
  renderWithAuth(
    <>
      <AppHeader />
      <Address />
    </>,
    fakeAuth({ profileType }),
    url,
  );
}

async function search(term: string) {
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar produto" }), `${term}{Enter}`);
}

describe("HeaderSearch", () => {
  it.each(["buyer", "apartment"] as const)("lets the %s profile search products", (profile) => {
    renderHeader("/perfil", profile);

    const box = screen.getByRole("searchbox", { name: "Buscar produto" });
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute("placeholder", "Buscar produto");
    expect(screen.getByRole("search")).toHaveClass("hidden", "lg:flex");
  });

  it.each(["farmer", null] as const)("shows no search to the %s profile", (profile) => {
    renderHeader("/", profile);

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("takes the search to the catalog", async () => {
    renderHeader("/agricultores?name=maria", "buyer");

    await search("couve");

    expect(screen.getByTestId("address")).toHaveTextContent(/^\/\?q=couve$/);
  });

  it("keeps the order and the filters chosen in the catalog", async () => {
    renderHeader("/?q=feijao&sort=lowest_price", "apartment");
    const box = screen.getByRole("searchbox", { name: "Buscar produto" });
    expect(box).toHaveValue("feijao");

    await userEvent.clear(box);
    await search("couve");

    expect(screen.getByTestId("address")).toHaveTextContent(/^\/\?sort=lowest_price&q=couve$/);
  });

  it("searches the catalog from another page of the app", async () => {
    const fetchMock = stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: anaAsBuyer("APROVADO") }), "/perfil");

    await search("mandioca");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Resultados para “mandioca”",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/products?q=mandioca&page=1", expect.anything());
  });

  it("is never shown to the farmer in the app", () => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: anaAsFarmer }), "/");

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
