import { Link } from "react-router";
import type { Interest } from "../../api/interests";
import { ProductPicture } from "../../components/ProductPicture";
import { formatMoney, pricePer, sellerName } from "../../format";
import {
  AVAILABLE,
  DELIVERED,
  IN_PURCHASE,
  costInCents,
  interestState,
} from "../../interestState";

const NAME_LINK_CLASSES =
  "rounded text-lime-800 underline focus-visible:outline-2 focus-visible:outline-lime-800";
const STATUS_CLASSES = "shrink-0 rounded-full px-3 py-1 text-sm font-bold";
const ACTIVE_COLORS = "bg-lime-100 text-lime-800";
const IDLE_COLORS = "bg-stone-200 text-stone-700";

// em compra ou entregue, o estado do pedido vale mais que o do produto
function statusOf(interest: Interest): { label: string; active: boolean } {
  const state = interestState(interest);
  if (state === "purchase") return { label: IN_PURCHASE, active: true };
  if (state === "delivered") return { label: DELIVERED, active: false };
  return { label: interest.product_status, active: interest.product_status === AVAILABLE };
}

interface InterestSummaryProps {
  interest: Interest;
  name: string;
  nameId: string;
}

export function InterestSummary({ interest, name, nameId }: Readonly<InterestSummaryProps>) {
  const { product } = interest;
  const status = statusOf(interest);

  return (
    <div className="flex gap-4">
      <ProductPicture
        url={product?.picture_url ?? null}
        className="w-20 shrink-0 rounded-xl sm:w-28"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h2 id={nameId} className="min-w-0 text-xl font-bold break-words">
            {interest.product_public_id ? (
              <Link to={`/produtos/${interest.product_public_id}`} className={NAME_LINK_CLASSES}>
                {name}
              </Link>
            ) : (
              name
            )}
          </h2>
          <span className={`${STATUS_CLASSES} ${status.active ? ACTIVE_COLORS : IDLE_COLORS}`}>
            {status.label}
          </span>
        </div>
        {product && (
          <>
            <p className="break-words text-stone-700">
              <span className="sr-only">Vendido por </span>
              {sellerName(product.farmer)}
            </p>
            <p className="text-stone-700">
              <span className="font-bold text-stone-900 tabular-nums">
                {formatMoney(product.price)}
              </span>{" "}
              {pricePer(product.unit)}, custo estimado{" "}
              <span className="font-bold text-stone-900 tabular-nums">
                {formatMoney(costInCents(interest.quantity, product.price) / 100)}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
