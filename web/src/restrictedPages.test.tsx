import { screen } from "@testing-library/react";
import App from "./App";
import type { ProfileRead, ProfileType } from "./api/profiles";
import { AppHeader } from "./components/AppHeader";
import { HOME_DESTINATION, navigationOf, pagesOf, RESTRICTED_PAGES } from "./restrictedPages";
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
const NO_ACCESS = "Você não tem acesso a esta página";

function linkTargets(): (string | null)[] {
  return screen.queryAllByRole("link").map((link) => link.getAttribute("href"));
}

describe.each(RESTRICTED_PAGES)("restricted page $path", (page) => {
  const outsiders = PROFILES.filter((profile) => !page.profiles.includes(profile));

  it.each(page.profiles)("shows its link in the header to the %s profile", (profile) => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

    expect(linkTargets()).toContain(page.path);
  });

  it.each(outsiders)("hides its link in the header from the %s profile", (profile) => {
    renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

    expect(linkTargets()).not.toContain(page.path);
  });

  it.each(page.profiles)("opens for the %s profile", (profile) => {
    stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: USERS[profile] }), page.path);

    expect(screen.getByRole("heading", { level: 1, name: page.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Voltar/ })).not.toBeInTheDocument();
  });

  it.each(outsiders)("tells the %s profile it has no access, without the API", (profile) => {
    const fetchMock = stubSilentApi();
    renderWithAuth(<App />, fakeAuth({ user: USERS[profile] }), page.path);

    expect(screen.getByRole("heading", { name: NO_ACCESS })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
    expect(linkTargets()).not.toContain(page.path);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("header links", () => {
  it("shows each profile only the links of its own pages", () => {
    for (const profile of PROFILES) {
      const allowed = RESTRICTED_PAGES.filter((page) => page.profiles.includes(profile));
      const { unmount } = renderWithAuth(<AppHeader />, fakeAuth({ profileType: profile }));

      const pages = allowed.map((page) => page.path);
      expect(linkTargets().sort()).toEqual(["/", "/", "/perfil", ...pages].sort());
      unmount();
    }
  });
});

describe("navigationOf", () => {
  it.each(PROFILES)("puts every page of the %s profile in the bar or in Mais", (profile) => {
    const { tabs, more } = navigationOf(profile);

    const paths = [...tabs, ...more].map((page) => page.path).sort();
    expect(paths).toEqual([HOME_DESTINATION.path, ...pagesOf(profile).map((p) => p.path)].sort());
    expect(tabs.length).toBeLessThanOrEqual(4);
  });

  it("gives a visitor without profile only the home", () => {
    expect(navigationOf(null)).toEqual({ tabs: [HOME_DESTINATION], more: [] });
  });
});
