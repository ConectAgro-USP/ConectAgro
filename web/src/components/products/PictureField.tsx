import { CameraIcon } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";
import { isUploadedPicture } from "../../api/products";
import type { PictureChoice } from "../../hooks/usePictureChoice";
import { FormError } from "../FormError";
import { ProductPicture } from "../ProductPicture";
import { TextField } from "../TextField";

const CHOOSE_CLASSES =
  "inline-flex h-14 cursor-pointer items-center gap-3 rounded-full border border-stone-400 " +
  "bg-white px-6 font-bold hover:bg-stone-50 peer-focus-visible:outline-2 " +
  "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-800 " +
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-60";
const SUMMARY_CLASSES =
  "w-fit cursor-pointer rounded-sm py-2 font-bold text-lime-800 underline " +
  "underline-offset-4 focus-visible:outline-2 focus-visible:outline-lime-800";

interface PictureFieldProps {
  current: string | null;
  choice: PictureChoice;
}

export function PictureField({ current, choice }: Readonly<PictureFieldProps>) {
  const inputId = useId();
  const uploaded = isUploadedPicture(current) ? current : null;
  const external = uploaded ? "" : (current ?? "");
  const [link, setLink] = useState(external);
  const preview = choice.chosen?.preview ?? (link.trim() || uploaded);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // limpar deixa escolher de novo a mesma foto
    event.target.value = "";
    if (file) choice.choose(file);
  }

  return (
    <div className="flex flex-col gap-6 py-8 sm:flex-row sm:items-start">
      <ProductPicture key={preview} url={preview} className="w-48 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-4">
        <p className="font-bold">
          Foto do produto <span className="font-normal">(opcional)</span>
        </p>
        <div>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="peer sr-only"
          />
          <label htmlFor={inputId} className={CHOOSE_CLASSES}>
            <CameraIcon aria-hidden="true" className="size-6 shrink-0" />
            {preview ? "Trocar foto" : "Tirar ou escolher foto"}
          </label>
        </div>
        <output className="block text-stone-600">
          {choice.preparing ? "Preparando a foto..." : ""}
        </output>
        <FormError message={choice.error} />
        <details open={external !== ""}>
          <summary className={SUMMARY_CLASSES}>Ou cole um link</summary>
          <div className="pt-4">
            <TextField
              label="Link para a imagem"
              name="picture_url"
              type="url"
              maxLength={2048}
              optional
              defaultValue={external}
              onBlur={(event) => setLink(event.target.value)}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
