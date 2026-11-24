import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ShowMore } from "../components/ShowMore";
import { TitleBar } from "../components/TitleBar";
import { formatMoney } from "../format";
import { useMyInterests } from "../hooks/useMyInterests";
import { InterestCard } from "./interests/InterestCard";

const TOTAL_CLASSES =
  "mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t " +
  "border-stone-300 pt-5";

export function MyInterests() {
  const list = useMyInterests();
  const empty = !list.loading && list.error === "" && list.items.length === 0;

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
        {list.items.length > 0 && (
          <ul className="space-y-4 pt-8">
            {list.items.map((interest) => (
              <InterestCard
                key={interest.public_id}
                interest={interest}
                onSave={(quantity) => list.update(interest, quantity)}
                onRemove={() => list.remove(interest)}
              />
            ))}
          </ul>
        )}
        <div className="flex justify-center pt-6 empty:hidden">
          <ShowMore list={list} label="Mostrar mais interesses" />
        </div>
        {/* a API soma os interesses de todas as páginas */}
        {list.totalInCents > 0 && (
          <div className={TOTAL_CLASSES}>
            <div>
              <p className="text-xl font-bold">Total estimado</p>
              <p className="text-stone-700">
                Soma dos interesses abertos em produtos à venda. O valor final sai na compra do
                prédio.
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(list.totalInCents / 100)}
            </p>
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
