import type { Sale } from "../../api/sales";
import { formatFullDay, formatZipCode } from "../../format";
import { WhatsAppContact } from "../WhatsAppContact";

const DELIVERY_CLASSES =
  "mb-4 flex flex-col gap-6 border-b border-stone-300 pb-6 md:flex-row md:items-end " +
  "md:justify-between";

function messageFor(sale: Sale): string {
  const greeting = sale.manager_name ? `Olá, ${sale.manager_name}!` : "Olá!";
  const order = `pedido de ${formatFullDay(sale.purchased_at)} do ${sale.building_name}`;
  return `${greeting} Falo sobre a entrega do ${order}, feito pelo ConectAgro.`;
}

export function SaleDelivery({ sale }: Readonly<{ sale: Sale }>) {
  return (
    <div className={DELIVERY_CLASSES}>
      <dl className="space-y-3 text-lg">
        <div>
          <dt className="font-bold">Local de entrega</dt>
          <dd className="break-words">
            {sale.delivery_address ?? `CEP ${formatZipCode(sale.delivery_zip_code)}`}
          </dd>
        </div>
        {sale.manager_name && (
          <div>
            <dt className="font-bold">Síndico</dt>
            <dd className="break-words">{sale.manager_name}</dd>
          </div>
        )}
      </dl>
      <div className="space-y-2 md:shrink-0">
        <WhatsAppContact
          recipient="síndico"
          cellphone={sale.manager_cellphone}
          message={messageFor(sale)}
          className="md:w-auto"
        />
      </div>
    </div>
  );
}
