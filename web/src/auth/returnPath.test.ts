import { loginPathFrom, rememberReturn, safeReturnPath, takeReturn, withReturn } from "./returnPath";

describe("safeReturnPath", () => {
  it.each(["/", "/produtos/prod-123", "/?q=couve&sort=lowest_price", "/perfil#dados"])(
    "keeps the internal path %s",
    (path) => {
      expect(safeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    "",
    "produtos",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
    "/\t/evil.example",
    "/\n/evil.example",
  ])("sends %j to the start", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});

describe("return links", () => {
  it("adds the encoded path to the login", () => {
    const place = { pathname: "/produtos/prod-123", search: "?de=busca" };

    expect(loginPathFrom(place)).toBe("/login?proximo=%2Fprodutos%2Fprod-123%3Fde%3Dbusca");
  });

  it("leaves the start out of the link", () => {
    expect(loginPathFrom({ pathname: "/", search: "" })).toBe("/login");
    expect(withReturn("/cadastro", "/")).toBe("/cadastro");
  });

  it("keeps the search of the catalog", () => {
    expect(loginPathFrom({ pathname: "/", search: "?q=couve" })).toBe("/login?proximo=%2F%3Fq%3Dcouve");
  });
});

describe("return kept for the Google login", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("gives the path back once", () => {
    rememberReturn("/produtos/prod-123");

    expect(takeReturn()).toBe("/produtos/prod-123");
    expect(takeReturn()).toBeNull();
  });

  it("forgets the old path when the start is the return", () => {
    rememberReturn("/produtos/prod-123");
    rememberReturn("/");

    expect(takeReturn()).toBeNull();
  });

  it("refuses a stored path from outside the site", () => {
    sessionStorage.setItem("conectagro:proximo", "//evil.example");

    expect(takeReturn()).toBeNull();
    expect(sessionStorage.getItem("conectagro:proximo")).toBeNull();
  });

  it("goes on without the storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado");
    });

    expect(() => rememberReturn("/produtos/prod-123")).not.toThrow();
    expect(takeReturn()).toBeNull();
  });
});
