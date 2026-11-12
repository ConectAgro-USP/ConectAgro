import type { PurchaseStatus } from "../api/history";
import {
  listBuildingPurchases,
  type BuildingPurchase,
  type PurchasePart,
} from "../api/purchases";
import { formatDay, formatMoney } from "../components/history/format";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryLayout } from "../components/history/HistoryLayout";
import { HistoryMonths } from "../components/history/HistoryMonths";
import { ItemLines } from "../components/history/ItemLines";
import { useHistory } from "../hooks/useHistory";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "A caminho",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

// quem entrou sem o nome do Google fica sem nome curto na API
function farmerName(part: PurchasePart): string {
  return part.farmer_short_name || "Agricultor";
}

function farmersOf(purchases: BuildingPurchase[]): [id: string, name: string][] {
  const parts = purchases.flatMap((purchase) => purchase.purchase_parts);
  return parts.map((part) => [part.farmer_public_id, farmerName(part)]);
}

function partStatus(part: PurchasePart): string {
  const label = STATUS_LABELS[part.status];
  if (part.closed_at === null) {
    return label;
  }
  return `${label} em ${formatDay(part.closed_at)}`;
}

function PurchaseCard({ purchase }: Readonly<{ purchase: BuildingPurchase }>) {
  return (
    <HistoryCard
      names={purchase.purchase_parts.map(farmerName)}
      items={purchase.purchase_parts.flatMap((part) => part.purchase_products)}
      status={purchase.status}
      statusLabel={STATUS_LABELS[purchase.status]}
      orderedAt={purchase.created_at}
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
                Subtotal
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
  const history = useHistory(listBuildingPurchases, farmersOf);

  return (
    <HistoryLayout
      title="Compras do prédio"
      history={history}
      statusLabels={STATUS_LABELS}
      counterpartLabel="Agricultor"
      emptyMessage="O prédio ainda não fez nenhuma compra"
    >
      <HistoryMonths items={history.items} dateOf={(purchase) => purchase.created_at}>
        {(purchase) => <PurchaseCard key={purchase.public_id} purchase={purchase} />}
      </HistoryMonths>
    </HistoryLayout>
  );
}
