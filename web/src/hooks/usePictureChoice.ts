import { useEffect, useRef, useState } from "react";
import { shrinkPicture } from "../components/products/shrinkPicture";

const UNREADABLE = "Não foi possível abrir esta foto. Escolha outra, em JPEG ou PNG";

interface Chosen {
  blob: Blob;
  preview: string;
}

export function usePictureChoice() {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  useEffect(() => {
    return () => {
      if (chosen) URL.revokeObjectURL(chosen.preview);
    };
  }, [chosen]);

  function choose(file: File) {
    latest.current += 1;
    const attempt = latest.current;
    setPreparing(true);
    setError("");
    shrinkPicture(file)
      .then((blob) => {
        if (attempt === latest.current) setChosen({ blob, preview: URL.createObjectURL(blob) });
      })
      .catch(() => {
        if (attempt === latest.current) setError(UNREADABLE);
      })
      .finally(() => {
        if (attempt === latest.current) setPreparing(false);
      });
  }

  return { chosen, preparing, error, choose };
}

export type PictureChoice = ReturnType<typeof usePictureChoice>;
