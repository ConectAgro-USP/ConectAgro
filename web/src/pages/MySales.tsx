import type { PurchaseStatus } from "../api/history";
import { listSales, type Sale } from "../api/sales";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryLayout } from "../components/history/HistoryLayout";
import { HistoryMonths } from "../components/history/HistoryMonths";
import { ItemLines } from "../components/history/ItemLines";
import { useHistory } from "../hooks/useHistory";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "Pendente",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

function buildingsOf(sales: Sale[]): [id: string, name: string][] {
  return sales.map((sale) => [sale.apartment_public_id, sale.building_name]);
}

function SaleCard({ sale }: Readonly<{ sale: Sale }>) {
  return (
    <HistoryCard
      names={[sale.building_name]}
      items={sale.purchase_products}
      status={sale.status}
      statusLabel={STATUS_LABELS[sale.status]}
      orderedAt={sale.purchased_at}
      closedAt={sale.closed_at}
      total={sale.total}
    >
      <ItemLines items={sale.purchase_products} />
    </HistoryCard>
  );
}

export function MySales() {
  const history = useHistory(listSales, buildingsOf);

  return (
    <HistoryLayout
      title="Minhas vendas"
      history={history}
      statusLabels={STATUS_LABELS}
      counterpartLabel="Prédio"
      emptyMessage="Você ainda não fez nenhuma venda"
    >
      <HistoryMonths items={history.items} dateOf={(sale) => sale.purchased_at}>
        {(sale) => <SaleCard key={sale.purchase_public_id} sale={sale} />}
      </HistoryMonths>
    </HistoryLayout>
  );
}
