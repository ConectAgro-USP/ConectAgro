import indexHtml from "../index.html?raw";

function head(): Document {
  return new DOMParser().parseFromString(indexHtml, "text/html");
}

function attribute(selector: string, name: string): string | null | undefined {
  return head().querySelector(selector)?.getAttribute(name);
}

describe("index.html", () => {
  it("points to the favicon served from the public folder", () => {
    expect(attribute('link[rel="icon"]', "href")).toBe("/favicon.svg");
    expect(attribute('link[rel="icon"]', "type")).toBe("image/svg+xml");
  });

  it("describes the site in Portuguese and sets the theme color", () => {
    expect(attribute("html", "lang")).toBe("pt-BR");
    expect(attribute('meta[name="description"]', "content")).toMatch(/agricultores/);
    expect(attribute('meta[name="theme-color"]', "content")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("lets the page reach the screen edge so the bar respects the safe area", () => {
    expect(attribute('meta[name="viewport"]', "content")).toContain("viewport-fit=cover");
  });
});
