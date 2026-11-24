import { render, waitFor } from "@testing-library/react";
import App from "./App";
import type { ProfileRead, ProfileType } from "./api/profiles";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { RESTRICTED_PAGES } from "./restrictedPages";
import {
  anaAsBuyer,
  anaAsFarmer,
  anaAsManager,
  fakeAuth,
  renderWithAuth,
  stubFetch,
  stubSilentApi,
} from "./test/helpers";
import { pageLoad, renderDetail } from "./test/productDetail";

const USERS: Record<ProfileType, ProfileRead> = {
  farmer: anaAsFarmer,
  apartment: anaAsManager,
  buyer: anaAsBuyer("APROVADO"),
};

function openApp(url: string, user: ProfileRead | null = USERS.buyer) {
  stubSilentApi();
  renderWithAuth(<App />, fakeAuth({ user }), url);
}

describe("document title", () => {
  it.each(RESTRICTED_PAGES)("names $path after the page", (page) => {
    openApp(page.path, USERS[page.profiles[0]]);

    expect(document.title).toBe(`${page.title} · ConectAgro`);
  });

  it.each<[string, ProfileRead | null, string]>([
    ["/", USERS.buyer, "Produtos · ConectAgro"],
    ["/", USERS.apartment, "Produtos · ConectAgro"],
    ["/", USERS.farmer, "Início · ConectAgro"],
    ["/perfil", USERS.farmer, "Meu perfil · ConectAgro"],
    ["/login", null, "Entrar · ConectAgro"],
    ["/cadastro", null, "Criar conta · ConectAgro"],
    ["/nao-existe", USERS.farmer, "Página não encontrada · ConectAgro"],
    ["/vendas", USERS.buyer, "Sem acesso · ConectAgro"],
  ])("names %s for the user", (url, user, title) => {
    openApp(url, user);

    expect(document.title).toBe(title);
  });

  it("names the product page after the product", async () => {
    stubFetch(...pageLoad());
    renderDetail();

    expect(document.title).toBe("Produto · ConectAgro");
    await waitFor(() => expect(document.title).toBe("Mandioca Natural · ConectAgro"));
  });

  it("goes back to the site name when the page leaves", () => {
    function Page() {
      useDocumentTitle("Minhas vendas");
      return null;
    }
    const { unmount } = render(<Page />);
    expect(document.title).toBe("Minhas vendas · ConectAgro");

    unmount();

    expect(document.title).toBe("ConectAgro");
  });
});
