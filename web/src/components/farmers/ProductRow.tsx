import { SproutIcon } from "lucide-react";
import { useState } from "react";
import type { FarmerProduct } from "../../api/farmers";
import { formatCount, formatFullDate, formatMoney } from "../../format";

const PICTURE_CLASSES = "min-h-24 w-24 shrink-0 self-stretch sm:w-40";
const NO_PICTURE_CLASSES = `${PICTURE_CLASSES} flex items-center justify-center bg-stone-300`;
const PRICE_CLASSES =
  "flex items-baseline gap-2 px-4 pt-1 pb-3 sm:w-44 sm:shrink-0 sm:flex-col sm:items-center " +
  "sm:justify-center sm:gap-0 sm:bg-stone-500 sm:p-4 sm:text-white";

function ProductPicture({ url }: Readonly<{ url: string | null }>) {
  const [failed, setFailed] = useState(false);

  if (url === null || failed) {
    return (
      <div aria-hidden="true" className={NO_PICTURE_CLASSES}>
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
      className={`${PICTURE_CLASSES} object-cover`}
    />
  );
}

export function ProductRow({ product }: Readonly<{ product: FarmerProduct }>) {
  return (
    <li className="flex overflow-hidden rounded-3xl bg-stone-50 text-left">
      <ProductPicture url={product.picture_url} />
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row">
        <div className="min-w-0 flex-1 px-4 pt-3 sm:px-6 sm:py-5">
          <h3 className="text-xl font-bold break-words">{product.name}</h3>
          {product.description && (
            <p className="line-clamp-2 break-words text-stone-600">{product.description}</p>
          )}
          <p className="text-stone-600">
            {formatCount(product.quantity, "kg disponível", "kg disponíveis")} · Vence{" "}
            <span className="tabular-nums">{formatFullDate(product.expiration_date)}</span>
          </p>
        </div>
        <p className={PRICE_CLASSES}>
          <span className="text-2xl font-bold tabular-nums">{formatMoney(product.price)}</span>{" "}
          <span className="text-sm">por quilo</span>
        </p>
      </div>
    </li>
  );
}
