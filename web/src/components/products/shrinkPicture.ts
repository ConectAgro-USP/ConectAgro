export const MAX_BYTES = 300 * 1024;
// do maior para o menor, até a foto ficar abaixo do limite
const EDGES = [1280, 960, 720, 480];
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

export interface PictureTools {
  decode: (file: Blob) => Promise<Decoded>;
  encode: (image: CanvasImageSource, width: number, height: number, quality: number) => Promise<Blob>;
}

export function fitWithin(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const canvasTools: PictureTools = {
  async decode(file) {
    const bitmap = await createImageBitmap(file);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  },
  encode(image, width, height, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return Promise.reject(new Error("Canvas indisponível"));
    // o JPEG não tem transparência, e o fundo do PNG ficaria preto
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Foto não gerada"))),
        "image/jpeg",
        quality,
      );
    });
  },
};

// sempre gera um JPEG novo, que também deixa para trás a localização da foto
export async function shrinkPicture(file: Blob, tools: PictureTools = canvasTools): Promise<Blob> {
  const decoded = await tools.decode(file);
  try {
    let smallest: Blob | null = null;
    let lastWidth = 0;
    for (const edge of EDGES) {
      const size = fitWithin(decoded.width, decoded.height, edge);
      if (size.width === lastWidth) continue;
      lastWidth = size.width;
      for (const quality of QUALITIES) {
        smallest = await tools.encode(decoded.image, size.width, size.height, quality);
        if (smallest.size < MAX_BYTES) return smallest;
      }
    }
    return smallest!;
  } finally {
    decoded.close();
  }
}
