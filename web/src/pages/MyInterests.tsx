import type { Interest } from "../api/interests";
import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { TitleBar } from "../components/TitleBar";
import { formatMoney } from "../format";
import { useMyInterests } from "../hooks/useMyInterests";
import { AVAILABLE, costInCents, interestState } from "../interestState";
import { InterestCard } from "./interests/InterestCard";

const TOTAL_CLASSES =
  "mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t " +
  "border-stone-300 pt-5";

// só o que ainda pode entrar na próxima compra do prédio
function openCosts(interests: Interest[]): number[] {
  return interests.flatMap((interest) => {
    const { product } = interest;
    const open = interestState(interest) === "open";
    const counts = product !== null && open && interest.product_status === AVAILABLE;
    return counts ? [costInCents(interest.quantity, product.price)] : [];
  });
}

export function MyInterests() {
  const list = useMyInterests();
  const empty = !list.loading && list.error === "" && list.data.length === 0;
  const costs = openCosts(list.data);
  const total = costs.reduce((sum, cost) => sum + cost, 0);

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Meus interesses" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {empty && (
          <p className="pt-12 text-center text-xl text-balance">
            Você ainda não registrou interesses. Abra um produto no catálogo e informe a
            quantidade que quer.
          </p>
        )}
        {list.data.length > 0 && (
          <ul className="space-y-4 pt-8">
            {list.data.map((interest) => (
              <InterestCard
                key={interest.public_id}
                interest={interest}
                onSave={(quantity) => list.update(interest.public_id, quantity)}
                onRemove={() => list.remove(interest.public_id)}
              />
            ))}
          </ul>
        )}
        {costs.length > 0 && (
          <div className={TOTAL_CLASSES}>
            <div>
              <p className="text-xl font-bold">Total estimado</p>
              <p className="text-stone-700">
                Soma dos interesses abertos em produtos à venda. O valor final sai na compra do
                prédio.
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatMoney(total / 100)}</p>
          </div>
        )}
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">{list.loading ? "Carregando..." : ""}</output>
          <FormError message={list.error} />
          {list.error && <SecondaryButton onClick={list.retry}>Tentar de novo</SecondaryButton>}
        </div>
      </div>
    </main>
  );
}
