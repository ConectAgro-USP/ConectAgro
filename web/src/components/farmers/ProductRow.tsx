import { HeartIcon, ShoppingCartIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Link } from "react-router";
import type { FarmerProduct } from "../../api/farmers";
import type { Interest } from "../../api/interests";
import { formatFullDate, formatMoney, formatQuantity, formatStock, pricePer } from "../../format";
import { CART_LIMIT, useCart } from "../../hooks/useCart";
import { chosenText, deliveredText } from "../../interestState";
import { PrimaryButton } from "../Button";
import { ProductPicture } from "../ProductPicture";
import { CARD_SURFACE } from "../surface";
import { FarmerRating } from "./FarmerRating";

const PICTURE_CLASSES = "m-3 w-24 shrink-0 rounded-2xl sm:m-4 sm:w-40";
const NAME_LINK_CLASSES =
  "rounded text-lime-800 underline focus-visible:outline-2 focus-visible:outline-lime-800";
const MARK_CLASSES =
  "mt-2 inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1 font-bold " +
  "text-lime-900";
const PRICE_CLASSES =
  "flex flex-wrap items-center gap-x-2 gap-y-2 px-4 pt-1 pb-3 sm:w-44 sm:shrink-0 " +
  "sm:flex-col sm:flex-nowrap sm:justify-center sm:gap-0 sm:bg-stone-500 sm:p-4 sm:text-white";

// botão compacto do síndico, que soma um de cada vez
function AddToCart({ product }: Readonly<{ product: FarmerProduct }>) {
  const cart = useCart();
  const [full, setFull] = useState(false);
  if (!cart.enabled) return null;
  const inCart = cart.quantityOf(product.public_id);
  const item = { productPublicId: product.public_id, quantity: 1, unitPrice: product.price };

  return (
    <div className="ml-auto flex flex-col items-end gap-1 sm:mt-3 sm:ml-0 sm:items-center">
      <PrimaryButton
        type="button"
        size="compact"
        aria-label={`Adicionar ${product.name} ao carrinho`}
        disabled={inCart >= product.quantity}
        onClick={() => setFull(!cart.add(item, product.quantity))}
        className="flex items-center gap-2 px-4"
      >
        <ShoppingCartIcon aria-hidden="true" className="size-5 shrink-0" />
        Adicionar
      </PrimaryButton>
      <p role="status" className="font-bold empty:hidden">
        {inCart > 0 ? `No carrinho: ${formatQuantity(inCart, product.unit)}` : ""}
      </p>
      {full && (
        <p role="alert" className="font-bold text-red-700 sm:text-white">
          O carrinho já tem {CART_LIMIT} produtos
        </p>
      )}
    </div>
  );
}

function markText({ quantity, purchase }: Interest, unit: string): string {
  if (!purchase) return chosenText(quantity, unit);
  return purchase.status === "ENTREGUE" ? deliveredText(purchase) : "Na compra do prédio";
}

// marca para o morador o que ele já escolheu
function InterestMark({ interest, unit }: Readonly<{ interest: Interest; unit: string }>) {
  return (
    <p className={MARK_CLASSES}>
      <HeartIcon aria-hidden="true" className="size-4 shrink-0" />
      {markText(interest, unit)}
    </p>
  );
}

interface ProductRowProps {
  product: FarmerProduct;
  seller?: string;
  rating?: ComponentProps<typeof FarmerRating>;
  interest?: Interest;
}

export function ProductRow({ product, seller, rating, interest }: Readonly<ProductRowProps>) {
  return (
    <li className={`flex overflow-hidden text-left ${CARD_SURFACE}`}>
      <ProductPicture url={product.picture_url} className={PICTURE_CLASSES} />
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row">
        <div className="min-w-0 flex-1 px-4 pt-3 sm:px-6 sm:py-5">
          <h3 className="text-xl font-bold break-words">
            <Link to={`/produtos/${product.public_id}`} className={NAME_LINK_CLASSES}>
              {product.name}
            </Link>
          </h3>
          {seller && (
            <p className="break-words text-stone-700">
              <span className="sr-only">Vendido por </span>
              {seller}
            </p>
          )}
          {rating && <FarmerRating {...rating} />}
          {product.description && (
            <p className="line-clamp-2 break-words text-stone-600">{product.description}</p>
          )}
          <p className="text-stone-600">
            {formatStock(product.quantity, product.unit)} · Vence{" "}
            <span className="tabular-nums">{formatFullDate(product.expiration_date)}</span>
          </p>
          {interest && <InterestMark interest={interest} unit={product.unit} />}
        </div>
        <div className={PRICE_CLASSES}>
          <p className="flex items-baseline gap-2 sm:flex-col sm:items-center sm:gap-0">
            <span className="text-2xl font-bold tabular-nums">{formatMoney(product.price)}</span>{" "}
            <span className="text-sm">{pricePer(product.unit)}</span>
          </p>
          <AddToCart product={product} />
        </div>
      </div>
    </li>
  );
}
