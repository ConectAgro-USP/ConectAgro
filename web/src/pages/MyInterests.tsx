import { SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { TitleBar } from "../components/TitleBar";
import { useMyInterests } from "../hooks/useMyInterests";
import { InterestCard } from "./interests/InterestCard";

export function MyInterests() {
  const list = useMyInterests();
  const empty = !list.loading && list.error === "" && list.data.length === 0;

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
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">{list.loading ? "Carregando..." : ""}</output>
          <FormError message={list.error} />
          {list.error && <SecondaryButton onClick={list.retry}>Tentar de novo</SecondaryButton>}
        </div>
      </div>
    </main>
  );
}
