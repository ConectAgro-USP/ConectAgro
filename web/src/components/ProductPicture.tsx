import { SproutIcon } from "lucide-react";
import { useState } from "react";

// recorte fixo de quatro por três, com fundo neutro enquanto a foto carrega
const PICTURE_CLASSES = "aspect-4/3 self-start bg-stone-200";

interface ProductPictureProps {
  url: string | null;
  className: string;
}

export function ProductPicture({ url, className }: Readonly<ProductPictureProps>) {
  const [failed, setFailed] = useState(false);

  if (url === null || failed) {
    return (
      <div
        aria-hidden="true"
        className={`${PICTURE_CLASSES} ${className} flex items-center justify-center`}
      >
        <SproutIcon className="size-10 text-stone-500" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${PICTURE_CLASSES} ${className} object-cover`}
    />
  );
}
