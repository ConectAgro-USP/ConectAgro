import type { PurchaseStatus } from "../api/history";
import {
  listBuildingPurchases,
  type BuildingPurchase,
  type PurchasePart,
} from "../api/purchases";
import type { Reviewable } from "../api/reviews";
import { formatDay, formatMoney } from "../format";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryLayout } from "../components/history/HistoryLayout";
import { HistoryMonths } from "../components/history/HistoryMonths";
import { ItemLines } from "../components/history/ItemLines";
import { RateLinks } from "../components/reviews/RateLinks";
import { useHistory } from "../hooks/useHistory";
import { useReviewables } from "../hooks/useReviewables";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "A caminho",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

// quem entrou sem o nome do Google fica sem nome curto na API
function farmerName(item: { farmer_short_name: string }): string {
  return item.farmer_short_name || "Agricultor";
}

function partStatus(part: PurchasePart): string {
  const label = STATUS_LABELS[part.status];
  if (part.closed_at === null) {
    return label;
  }
  return `${label} em ${formatDay(part.closed_at)}`;
}

function RateParts({ purchase, reviewables }: Readonly<PurchaseCardProps>) {
  const toRate = reviewables.filter((item) => item.purchase_public_id === purchase.public_id);
  if (toRate.length === 0) {
    return null;
  }

  const several = purchase.purchase_parts.length > 1;
  return (
    <div className="mt-4 space-y-1">
      {toRate.map((reviewable) => (
        <RateLinks
          key={reviewable.farmer_public_id}
          reviewable={reviewable}
          label={several ? `Avalie a compra de ${farmerName(reviewable)}` : "Avalie a compra"}
        />
      ))}
    </div>
  );
}

interface PurchaseCardProps {
  purchase: BuildingPurchase;
  reviewables: Reviewable[];
}

function PurchaseCard({ purchase, reviewables }: Readonly<PurchaseCardProps>) {
  return (
    <HistoryCard
      actions={<RateParts purchase={purchase} reviewables={reviewables} />}
      names={purchase.purchase_parts.map(farmerName)}
      items={purchase.purchase_parts.flatMap((part) => part.purchase_products)}
      status={purchase.status}
      statusLabel={STATUS_LABELS[purchase.status]}
      orderedAt={purchase.created_at}
      expectedOn={purchase.expected_delivery_date}
      closedAt={purchase.closed_at}
      total={purchase.total}
    >
      <div className="space-y-6">
        {purchase.purchase_parts.map((part) => (
          <section key={part.public_id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6">
              <h4 className="text-xl font-bold">{farmerName(part)}</h4>
              <p className="text-stone-600">{partStatus(part)}</p>
            </div>
            <ItemLines items={part.purchase_products} />
            {/* com um produto só, o subtotal repetiria a linha de cima */}
            {part.purchase_products.length > 1 && (
              <p className="flex justify-between gap-6 border-t border-stone-400 pt-2 font-bold">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(part.total)}</span>
              </p>
            )}
          </section>
        ))}
      </div>
    </HistoryCard>
  );
}

export function BuildingPurchases() {
  const history = useHistory(listBuildingPurchases);
  const reviewables = useReviewables();

  return (
    <HistoryLayout
      title="Compras do prédio"
      history={history}
      statusLabels={STATUS_LABELS}
      counterpartLabel="Agricultor"
      emptyMessage={
        "Você ainda não fez compras, confira a página inicial e faça a sua primeira compra hoje"
      }
    >
      <HistoryMonths items={history.items} dateOf={(purchase) => purchase.created_at}>
        {(purchase) => (
          <PurchaseCard key={purchase.public_id} purchase={purchase} reviewables={reviewables} />
        )}
      </HistoryMonths>
    </HistoryLayout>
  );
}
