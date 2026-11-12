import { screen } from "@testing-library/react";
import App from "./App";
import type { ProfileRead, ProfileType } from "./api/profiles";
import { AppHeader } from "./components/AppHeader";
import { RESTRICTED_PAGES } from "./restrictedPages";
import { anaAsBuyer, anaAsFarmer, anaAsManager, fakeAuth, renderWithAuth } from "./test/helpers";

const USERS: Record<ProfileType, ProfileRead> = {
  farmer: anaAsFarmer,
  apartment: anaAsManager,
  buyer: anaAsBuyer("APROVADO"),
};
const PROFILES = Object.keys(USERS) as ProfileType[];

// a página fica esperando a API, os testes só olham quem chega nela
function stubSilentApi() {
  const fetchMock = vi.fn<typeof fetch>(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe.each(RESTRICTED_PAGES)("restricted page $path", (page) => {
  const outsiders = PROFILES.filter((profile) => profile !== page.profile);

  it("shows its link in the header to the profile that can open it", () => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: page.profile }));

    expect(screen.getByRole("link", { name: page.label })).toHaveAttribute("href", page.path);
  });

  it.each(outsiders)("hides its link in the header from the %s profile", (profile) => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

    expect(screen.queryByRole("link", { name: page.label })).not.toBeInTheDocument();
  });

  it("opens for the profile that can use it", () => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: USERS[page.profile] }), page.path);

    expect(screen.getByRole("heading", { level: 1, name: page.label })).toBeInTheDocument();
  });

  it.each(outsiders)("sends the %s profile back to the home without asking the API", (profile) => {
    const fetchMock = stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: USERS[profile] }), page.path);

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: page.label })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("header links", () => {
  it("shows each profile only the links of its own pages", () => {
    for (const profile of PROFILES) {
      const allowed = RESTRICTED_PAGES.filter((page) => page.profile === profile);
      const { unmount } = renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

      const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
      expect(links).toEqual(["/", "/", ...allowed.map((page) => page.path), "/perfil"]);
      unmount();
    }
  });
});
