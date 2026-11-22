import { useId } from "react";
import type { PurchaseStatus } from "../api/history";
import { changeMyPartStatus } from "../api/purchases";
import { listSales, type Sale } from "../api/sales";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryLayout } from "../components/history/HistoryLayout";
import { HistoryMonths } from "../components/history/HistoryMonths";
import { ItemLines } from "../components/history/ItemLines";
import { StatusActions } from "../components/history/StatusActions";
import { useHistory } from "../hooks/useHistory";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "Pendente",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};
const CANCEL_SALE = {
  label: "Cancelar venda",
  question: "Cancelar esta venda?",
  hint: "Os produtos voltam para o seu estoque e o cancelamento não pode ser desfeito.",
};

interface SaleCardProps {
  sale: Sale;
  busy: boolean;
  reload: () => void;
}

function SaleCard({ sale, busy, reload }: Readonly<SaleCardProps>) {
  const titleId = useId();
  const purchaseId = sale.purchase_public_id;

  return (
    <HistoryCard
      titleId={titleId}
      actions={
        <StatusActions
          open={sale.status === "EM PROGRESSO"}
          describedBy={titleId}
          disabled={busy}
          cancel={CANCEL_SALE}
          onCancel={() => changeMyPartStatus(purchaseId, "CANCELADA")}
          onDeliver={() => changeMyPartStatus(purchaseId, "ENTREGUE")}
          reload={reload}
        />
      }
      names={[sale.building_name]}
      items={sale.purchase_products}
      status={sale.status}
      statusLabel={STATUS_LABELS[sale.status]}
      orderedAt={sale.purchased_at}
      expectedOn={sale.expected_delivery_date}
      closedAt={sale.closed_at}
      total={sale.total}
    >
      <ItemLines items={sale.purchase_products} />
    </HistoryCard>
  );
}

export function MySales() {
  const history = useHistory(listSales);

  return (
    <HistoryLayout
      title="Minhas vendas"
      history={history}
      statusLabels={STATUS_LABELS}
      counterpartLabel="Prédio"
      emptyMessage={
        "Você ainda não fez vendas, confira a página inicial e ofereça os seus produtos hoje"
      }
    >
      <HistoryMonths items={history.items} dateOf={(sale) => sale.purchased_at}>
        {(sale) => (
          <SaleCard
            key={sale.purchase_public_id}
            sale={sale}
            busy={history.loading}
            reload={history.reload}
          />
        )}
      </HistoryMonths>
    </HistoryLayout>
  );
}
