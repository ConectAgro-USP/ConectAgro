import { screen } from "@testing-library/react";
import App from "./App";
import type { ProfileRead, ProfileType } from "./api/profiles";
import { AppHeader } from "./components/AppHeader";
import { RESTRICTED_PAGES } from "./restrictedPages";
import {
  anaAsBuyer,
  anaAsFarmer,
  anaAsManager,
  fakeAuth,
  renderWithAuth,
  stubSilentApi,
} from "./test/helpers";

const USERS: Record<ProfileType, ProfileRead> = {
  farmer: anaAsFarmer,
  apartment: anaAsManager,
  buyer: anaAsBuyer("APROVADO"),
};
const PROFILES = Object.keys(USERS) as ProfileType[];
const CATALOG_HOME = { heading: "Produtos em destaque", calls: ["/api/products?page=1"] };
const HOMES: Record<ProfileType, { heading: string; calls: string[] }> = {
  farmer: { heading: "Olá, Ana Souza", calls: [] },
  apartment: CATALOG_HOME,
  buyer: CATALOG_HOME,
};

describe.each(RESTRICTED_PAGES)("restricted page $path", (page) => {
  const outsiders = PROFILES.filter((profile) => !page.profiles.includes(profile));

  it.each(page.profiles)("shows its link in the header to the %s profile", (profile) => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

    expect(screen.getByRole("link", { name: page.label })).toHaveAttribute("href", page.path);
  });

  it.each(outsiders)("hides its link in the header from the %s profile", (profile) => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

    expect(screen.queryByRole("link", { name: page.label })).not.toBeInTheDocument();
  });

  it.each(page.profiles)("opens for the %s profile", (profile) => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: USERS[profile] }), page.path);

    expect(screen.getByRole("heading", { level: 1, name: page.label })).toBeInTheDocument();
  });

  it.each(outsiders)("sends the %s profile back to the home without the page's API", (profile) => {
    const fetchMock = stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: USERS[profile] }), page.path);

    expect(screen.getByRole("heading", { name: HOMES[profile].heading })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: page.label })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(HOMES[profile].calls);
  });
});

describe("header links", () => {
  it("shows each profile only the links of its own pages", () => {
    for (const profile of PROFILES) {
      const allowed = RESTRICTED_PAGES.filter((page) => page.profiles.includes(profile));
      const { unmount } = renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

      const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
      expect(links).toEqual(["/", "/", ...allowed.map((page) => page.path), "/perfil"]);
      unmount();
    }
  });
});
