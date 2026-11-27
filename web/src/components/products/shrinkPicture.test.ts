import { fitWithin, MAX_BYTES, shrinkPicture, type PictureTools } from "./shrinkPicture";

const KB = 1024;

// cada chamada devolve o próximo tamanho da lista, como faria o canvas
function fakeTools(width: number, height: number, sizes: number[]) {
  const close = vi.fn();
  const encode = vi.fn<PictureTools["encode"]>(async () => {
    const size = sizes.shift() ?? 10 * KB;
    return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
  });
  const decode = vi.fn<PictureTools["decode"]>(async () => ({
    image: {} as CanvasImageSource,
    width,
    height,
    close,
  }));
  return { tools: { decode, encode }, encode, close };
}

function encodedSizes(encode: ReturnType<typeof fakeTools>["encode"]) {
  return encode.mock.calls.map(([, width, height, quality]) => [width, height, quality]);
}

describe("fitWithin", () => {
  it("keeps the proportion with the long edge at the limit", () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it("never enlarges a small picture", () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
});

describe("shrinkPicture", () => {
  it("reduces a big photo to 1280 px on the long edge", async () => {
    const { tools, encode } = fakeTools(4032, 3024, [120 * KB]);

    const blob = await shrinkPicture(new Blob(["foto"]), tools);

    expect(blob.size).toBe(120 * KB);
    expect(encodedSizes(encode)).toEqual([[1280, 960, 0.85]]);
  });

  it("lowers the quality until the photo is under 300 KB", async () => {
    const { tools, encode } = fakeTools(1280, 960, [500 * KB, 350 * KB, 200 * KB]);

    const blob = await shrinkPicture(new Blob(["foto"]), tools);

    expect(blob.size).toBeLessThan(MAX_BYTES);
    expect(encodedSizes(encode).map(([, , quality]) => quality)).toEqual([0.85, 0.7, 0.55]);
  });

  it("makes the photo smaller when the lowest quality is not enough", async () => {
    const { tools, encode } = fakeTools(4000, 3000, [400, 400, 400, 400, 250].map((k) => k * KB));

    await shrinkPicture(new Blob(["foto"]), tools);

    const [width, height, quality] = encodedSizes(encode).at(-1)!;
    expect([width, height, quality]).toEqual([960, 720, 0.85]);
  });

  it("does not encode the same size twice for a small photo", async () => {
    const { tools, encode } = fakeTools(600, 400, Array(16).fill(400 * KB));

    await shrinkPicture(new Blob(["foto"]), tools);

    const widths = new Set(encodedSizes(encode).map(([width]) => width));
    expect(widths).toEqual(new Set([600, 480]));
  });

  it("releases the decoded image when it is done", async () => {
    const { tools, close } = fakeTools(1280, 960, [100 * KB]);

    await shrinkPicture(new Blob(["foto"]), tools);

    expect(close).toHaveBeenCalledOnce();
  });

  it("fails when the browser cannot open the file", async () => {
    const tools: PictureTools = {
      decode: () => Promise.reject(new Error("formato desconhecido")),
      encode: vi.fn(),
    };

    await expect(shrinkPicture(new Blob(["texto"]), tools)).rejects.toThrow();
  });
});
