import indexHtml from "../index.html?raw";

// os ícones chegam ao teste em base64, como o Vite os embute
const ICONS = import.meta.glob<string>("../public/*.{png,ico}", {
  query: "?inline",
  import: "default",
  eager: true,
});

function head(): Document {
  return new DOMParser().parseFromString(indexHtml, "text/html");
}

function attribute(selector: string, name: string): string | null | undefined {
  return head().querySelector(selector)?.getAttribute(name);
}

function iconBytes(path: string): DataView {
  const key = `../public${path}`;
  expect(Object.keys(ICONS)).toContain(key);
  const base64 = ICONS[key].split(",")[1];
  return new DataView(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer);
}

function pngSize(path: string): string {
  const png = iconBytes(path);
  return `${png.getUint32(16)}x${png.getUint32(20)}`;
}

// cada imagem do arquivo ico ocupa 16 bytes do índice, a partir do byte 6
function icoSizes(path: string): string[] {
  const ico = iconBytes(path);
  return Array.from({ length: ico.getUint16(4, true) }, (_, index) => {
    const side = ico.getUint8(6 + index * 16) || 256;
    return `${side}x${side}`;
  }).sort();
}

describe("index.html", () => {
  it("gives the tab the icon in every size the file has", () => {
    const sizes = attribute('link[rel="icon"]', "sizes")?.split(" ").sort();

    expect(attribute('link[rel="icon"]', "href")).toBe("/favicon.ico");
    expect(icoSizes("/favicon.ico")).toEqual(sizes);
  });

  it("gives the phone home screen the icon in the size the page announces", () => {
    expect(attribute('link[rel="apple-touch-icon"]', "href")).toBe("/apple-touch-icon.png");
    expect(attribute('link[rel="apple-touch-icon"]', "sizes")).toBe("180x180");
    expect(pngSize("/apple-touch-icon.png")).toBe("180x180");
  });

  it("has no manifest, so phones keep opening and installing the site as before", () => {
    expect(head().querySelector('link[rel="manifest"]')).toBeNull();
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
