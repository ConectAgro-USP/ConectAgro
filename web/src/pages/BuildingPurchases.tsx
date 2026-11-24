import { useId } from "react";
import type { PurchaseStatus } from "../api/history";
import {
  cancelPurchase,
  listBuildingPurchases,
  type BuildingPurchase,
  type PurchasePart,
} from "../api/purchases";
import type { Reviewable } from "../api/reviews";
import { farmerName, formatDay, formatMoney } from "../format";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryLayout } from "../components/history/HistoryLayout";
import { HistoryMonths } from "../components/history/HistoryMonths";
import { ItemLines } from "../components/history/ItemLines";
import { StatusActions } from "../components/history/StatusActions";
import { RateLinks } from "../components/reviews/RateLinks";
import { useHistory } from "../hooks/useHistory";
import { useReviewables } from "../hooks/useReviewables";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "A caminho",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};
const CANCEL_PURCHASE = {
  label: "Cancelar compra",
  question: "Cancelar esta compra?",
  hint: "Os agricultores não fazem mais a entrega e o cancelamento não pode ser desfeito.",
  done: "Compra cancelada",
};
const NEEDS_LINK = { to: "/necessidades", label: "Ver as necessidades do prédio" };

function partStatus(part: PurchasePart): string {
  const label = STATUS_LABELS[part.status];
  if (part.closed_at === null) {
    return label;
  }
  return `${label} em ${formatDay(part.closed_at)}`;
}

function cancellable(purchase: BuildingPurchase): boolean {
  return (
    purchase.status === "EM PROGRESSO" &&
    !purchase.purchase_parts.some((part) => part.status === "ENTREGUE")
  );
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

interface ReloadablePurchaseCardProps extends PurchaseCardProps {
  busy: boolean;
  reload: () => void;
}

function PurchaseCard({
  purchase,
  reviewables,
  busy,
  reload,
}: Readonly<ReloadablePurchaseCardProps>) {
  const titleId = useId();

  return (
    <HistoryCard
      titleId={titleId}
      actions={
        <>
          <StatusActions
            open={cancellable(purchase)}
            describedBy={titleId}
            disabled={busy}
            cancel={CANCEL_PURCHASE}
            onCancel={() => cancelPurchase(purchase.public_id)}
            reload={reload}
          />
          <RateParts purchase={purchase} reviewables={reviewables} />
        </>
      }
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
        "Você ainda não fez compras, veja as necessidades do prédio e feche a sua primeira compra"
      }
      emptyLink={NEEDS_LINK}
    >
      <HistoryMonths items={history.items} dateOf={(purchase) => purchase.created_at}>
        {(purchase) => (
          <PurchaseCard
            key={purchase.public_id}
            purchase={purchase}
            reviewables={reviewables}
            busy={history.loading}
            reload={history.reload}
          />
        )}
      </HistoryMonths>
    </HistoryLayout>
  );
}
