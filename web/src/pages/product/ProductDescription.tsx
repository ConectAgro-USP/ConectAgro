import { useState } from "react";
import { CARD_SURFACE } from "../../components/surface";

const MAX_LENGTH = 250;

interface ProductDescriptionProps {
  description: string | null;
}

export function ProductDescription({ description }: Readonly<ProductDescriptionProps>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`p-6 ${CARD_SURFACE}`}>
      <h2 className="text-2xl font-bold text-stone-900">Descrição</h2>
      {description ? (
        <div className="mt-4">
          <p className="leading-relaxed whitespace-pre-line text-stone-700">
            {expanded || description.length <= MAX_LENGTH
              ? description
              : `${description.slice(0, MAX_LENGTH)}...`}
          </p>
          {description.length > MAX_LENGTH && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-sm font-bold text-lime-800 underline hover:text-lime-900"
            >
              {expanded ? "Ler menos" : "Ler mais"}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 italic text-stone-500">
          Nenhuma descrição informada para este produto.
        </p>
      )}
    </section>
  );
}
