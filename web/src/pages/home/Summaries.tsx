import { Link } from "react-router";
import type { HistoryPage } from "../../api/history";
import type { MyProductCounts } from "../../api/products";
import type { ReceivedReviews } from "../../api/reviews";
import type { Sale } from "../../api/sales";
import { EXPIRING_SOON_DAYS } from "../../components/products/productState";
import { AverageRating } from "../../components/reviews/AverageRating";
import { averageOf } from "../../components/reviews/average";
import { formatCount, formatDate, formatMoney } from "../../format";

const SHOWN_SALES = 3;
const SALE_LINK_CLASSES =
  "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl px-3 py-3 " +
  "hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-lime-800";

// a API manda a entrega mais próxima primeiro
function nextDeliveries(sales: Sale[]): Sale[] {
  return sales.slice(0, SHOWN_SALES);
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

// a API conta todos os produtos, não só os da primeira página
function countLines(counts: MyProductCounts) {
  return [
    { label: "Disponíveis", count: counts.available, dot: "bg-lime-700" },
    { label: "Esgotados", count: counts.sold_out, dot: "bg-amber-700" },
    {
      label: `Vencem em até ${EXPIRING_SOON_DAYS} dias`,
      count: counts.expiring_soon,
      dot: "bg-red-700",
    },
  ];
}

export function ProductsSummary({ counts }: Readonly<{ counts: MyProductCounts }>) {
  return (
    <dl className="divide-y divide-stone-200 text-lg">
      {countLines(counts).map((line) => (
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
  const average = averageOf(reviews);
  if (average === null) {
    return (
      <p className="text-lg text-stone-700">
        Você ainda não recebeu avaliações. Elas chegam depois das entregas.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <AverageRating average={average} starClassName="size-7" />
      </p>
      <p className="text-lg text-stone-700">
        {formatCount(reviews.reviews_count, "avaliação", "avaliações")}
      </p>
    </div>
  );
}
