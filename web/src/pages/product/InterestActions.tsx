import { CheckCircleIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { ProductDetail } from "../../api/products";
import { SecondaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { useAction } from "../../hooks/useAction";
import { useProductInterest } from "../../hooks/useProductInterest";
import { chosenText, interestState, purchaseText } from "../../interestState";
import { InterestForm } from "./InterestForm";
import { NOTE_CLASSES, TEXT_LINK_CLASSES } from "./buyBox";

const NOTICE_CLASSES =
  "flex items-center gap-2 rounded-xl bg-lime-100 p-4 font-semibold text-lime-900";

interface InterestActionsProps {
  product: ProductDetail;
  isAvailable: boolean;
  stock: string;
}

export function InterestActions({ product, isAvailable, stock }: Readonly<InterestActionsProps>) {
  const interests = useProductInterest(product.public_id);
  const action = useAction();
  const [notice, setNotice] = useState("");
  const interest = interests.interest ?? undefined;
  const state = interest ? interestState(interest) : "none";
  const purchase = interest?.purchase;

  function run(request: () => Promise<void>, done: string) {
    setNotice("");
    action.run(async () => {
      await request();
      setNotice(done);
    });
  }

  function submit(quantity: number) {
    if (!interest) {
      run(() => interests.register(quantity), "Interesse registrado");
    } else {
      const done = state === "delivered" ? "Interesse registrado de novo" : "Interesse atualizado";
      run(() => interests.update(interest.public_id, quantity), done);
    }
  }

  function remove() {
    if (interest) run(() => interests.remove(interest.public_id), "Interesse removido");
  }

  function clearMessages() {
    setNotice("");
    action.setError("");
  }

  let body;
  if (interests.loading) {
    body = (
      <div className="mt-4 space-y-1">
        <p className="text-right font-medium text-stone-700">{stock}</p>
        <p className="text-stone-700">Carregando o seu interesse...</p>
      </div>
    );
  } else if (interests.error) {
    body = (
      <div className="mt-4 space-y-3">
        <FormError message={interests.error} />
        <SecondaryButton onClick={interests.retry}>Tentar de novo</SecondaryButton>
      </div>
    );
  } else if (interest && purchase && state === "purchase") {
    body = (
      <div className="mt-4 space-y-3">
        <p className="text-right font-medium text-stone-700">{stock}</p>
        <div className={NOTE_CLASSES}>
          <p className="font-bold text-stone-900">{chosenText(interest.quantity)}</p>
          <p>{purchaseText(purchase)}</p>
        </div>
        <Link to="/interesses" className={TEXT_LINK_CLASSES}>
          Ver meus interesses
        </Link>
      </div>
    );
  } else {
    body = (
      <InterestForm
        // cada estado começa o campo com a quantidade dele
        key={`${interest?.public_id ?? "novo"}-${state}`}
        product={product}
        interest={interest}
        isAvailable={isAvailable}
        stock={stock}
        pending={action.pending}
        onSubmit={submit}
        onRemove={remove}
        onEdit={clearMessages}
      />
    );
  }

  return (
    <>
      {body}
      {/* fica sempre no HTML para o leitor de tela anunciar a mudança */}
      <div role="status" className="mt-3 empty:hidden">
        {notice && (
          <p className={NOTICE_CLASSES}>
            <CheckCircleIcon aria-hidden="true" className="size-5 shrink-0 text-lime-800" />
            {notice}
          </p>
        )}
      </div>
      <div className="mt-3 empty:hidden">
        <FormError message={action.error} />
      </div>
    </>
  );
}
