import { SproutIcon } from "lucide-react";
import { useState } from "react";

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
        className={`${className} flex items-center justify-center bg-stone-300`}
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
      className={`${className} object-cover`}
    />
  );
}
