import { Link } from "react-router";
import type { HistoryPage } from "../../api/history";
import type { MyProduct } from "../../api/products";
import type { ReceivedReviews } from "../../api/reviews";
import type { Sale } from "../../api/sales";
import { stateOf } from "../../components/products/productState";
import { RatingStars } from "../../components/reviews/StarRating";
import { daysUntil, formatCount, formatDate, formatMoney, formatRating } from "../../format";

const SHOWN_SALES = 3;
const SALE_LINK_CLASSES =
  "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl px-3 py-3 " +
  "hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-lime-800";

// a entrega mais próxima vem primeiro
function nextDeliveries(sales: Sale[]): Sale[] {
  return [...sales]
    .sort((a, b) => a.expected_delivery_date.localeCompare(b.expected_delivery_date))
    .slice(0, SHOWN_SALES);
}

export function SalesSummary({ page }: Readonly<{ page: HistoryPage<Sale> }>) {
  if (page.total === 0) {
    return <p className="text-lg text-stone-700">Nenhuma venda para entregar agora.</p>;
  }
  return (
    <>
      <p className="text-xl">
        <span className="font-bold">{formatCount(page.total, "venda", "vendas")}</span> para
        entregar, <span className="font-bold tabular-nums">{formatMoney(page.expected_total)}</span>{" "}
        a receber.
      </p>
      <ul className="-mx-3 divide-y divide-stone-200">
        {nextDeliveries(page.items).map((sale) => (
          <li key={sale.purchase_public_id}>
            <Link to="/vendas" className={SALE_LINK_CLASSES}>
              <span>
                <span className="block text-lg font-bold break-words">{sale.building_name}</span>
                <span className="text-stone-700">
                  Entrega prevista{" "}
                  <span className="tabular-nums">{formatDate(sale.expected_delivery_date)}</span>
                </span>
              </span>
              <span className="text-lg font-bold tabular-nums">{formatMoney(sale.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function countProducts(products: MyProduct[]) {
  const available = products.filter((product) => stateOf(product) === "available");
  return [
    { label: "Disponíveis", count: available.length, dot: "bg-lime-700" },
    {
      label: "Esgotados",
      count: products.filter((product) => stateOf(product) === "soldOut").length,
      dot: "bg-amber-700",
    },
    {
      label: "Vencem em até 7 dias",
      count: available.filter((product) => daysUntil(product.expiration_date) <= 7).length,
      dot: "bg-red-700",
    },
  ];
}

export function ProductsSummary({ products }: Readonly<{ products: MyProduct[] }>) {
  return (
    <dl className="divide-y divide-stone-200 text-lg">
      {countProducts(products).map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-4 py-2">
          <dt className="flex items-center gap-3">
            <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${line.dot}`} />
            {line.label}
          </dt>
          <dd className="text-2xl font-bold tabular-nums">{line.count}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RatingSummary({ reviews }: Readonly<{ reviews: ReceivedReviews }>) {
  const { average_rating: average, reviews_count: count } = reviews;
  if (average === null || count === 0) {
    return (
      <p className="text-lg text-stone-700">
        Você ainda não recebeu avaliações. Elas chegam depois das entregas.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="sr-only">Nota média</span>
        <span className="text-4xl font-bold tabular-nums">{formatRating(average)}</span>
        <span className="sr-only">de 5</span>
        <RatingStars rating={average} starClassName="size-7" />
      </p>
      <p className="text-lg text-stone-700">{formatCount(count, "avaliação", "avaliações")}</p>
    </div>
  );
}
