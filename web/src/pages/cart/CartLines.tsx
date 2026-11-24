import { useId } from "react";
import { Link } from "react-router";
import type { ProductDetail } from "../../api/products";
import { SecondaryButton } from "../../components/Button";
import { formatCount, formatMoney } from "../../format";
import type { Problem } from "./useCartCheck";

const QUANTITY_CLASSES =
  "h-12 w-24 rounded-lg border border-stone-400 bg-white px-3 tabular-nums " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800";
const NAME_CLASSES =
  "min-w-0 rounded font-bold break-words text-lime-800 underline " +
  "focus-visible:outline-2 focus-visible:outline-lime-800";
const NOTE_CLASSES = "mt-1 font-bold text-amber-800";
const PROBLEM_LABELS: Record<Problem, string> = {
  paused: "O agricultor pausou a venda",
  expired: "Venceu",
  soldOut: "Sem estoque",
};

function ProductName({ product }: Readonly<{ product: ProductDetail }>) {
  return (
    <Link to={`/produtos/${product.public_id}`} className={NAME_CLASSES}>
      {product.name}
    </Link>
  );
}

interface RemoveProps {
  product: ProductDetail;
  onRemove: () => void;
}

// fica sempre à direita, longe do desfazer que aparece no lugar da linha
function RemoveButton({ product, onRemove }: Readonly<RemoveProps>) {
  return (
    <SecondaryButton
      size="compact"
      aria-label={`Remover ${product.name}`}
      onClick={onRemove}
      className="ml-auto"
    >
      Remover
    </SecondaryButton>
  );
}

interface QuantityLineProps extends RemoveProps {
  quantity: string;
  oldPrice?: string;
  clampedFrom?: number;
  onChange: (quantity: string) => void;
}

export function QuantityLine({
  product,
  quantity,
  oldPrice,
  clampedFrom,
  onChange,
  onRemove,
}: Readonly<QuantityLineProps>) {
  const id = useId();
  const notes = [`${id}-estoque`];
  if (oldPrice) notes.push(`${id}-preco`);
  if (clampedFrom !== undefined) notes.push(`${id}-ajuste`);

  return (
    <li className="py-4">
      <p className="flex items-baseline justify-between gap-6">
        <ProductName product={product} />
        <span className="font-bold tabular-nums">
          {formatMoney((Number(quantity) || 0) * Number(product.price))}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          type="number"
          min={1}
          max={product.quantity}
          step={1}
          required
          value={quantity}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Quantidade de ${product.name} em kg`}
          aria-describedby={notes.join(" ")}
          className={QUANTITY_CLASSES}
        />
        <div className="text-stone-700">
          <p>kg × {formatMoney(product.price)}</p>
          <p id={`${id}-estoque`}>
            {formatCount(product.quantity, "kg disponível", "kg disponíveis")}
          </p>
        </div>
        <RemoveButton product={product} onRemove={onRemove} />
      </div>
      {oldPrice && (
        <p id={`${id}-preco`} className={NOTE_CLASSES}>
          O preço mudou de {formatMoney(oldPrice)} para {formatMoney(product.price)}
        </p>
      )}
      {clampedFrom !== undefined && (
        <p id={`${id}-ajuste`} className={NOTE_CLASSES}>
          Você tinha pedido {clampedFrom} kg, a quantidade foi ajustada ao estoque
        </p>
      )}
    </li>
  );
}

interface BlockedLineProps extends RemoveProps {
  problem: Problem;
}

export function BlockedLine({ product, problem, onRemove }: Readonly<BlockedLineProps>) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
      <div className="min-w-0">
        <ProductName product={product} />
        <p className="font-bold text-amber-800">
          {PROBLEM_LABELS[problem]}, fica fora da compra
        </p>
      </div>
      <RemoveButton product={product} onRemove={onRemove} />
    </li>
  );
}

interface RemovedLineProps {
  product: ProductDetail;
  onUndo: () => void;
}

export function RemovedLine({ product, onUndo }: Readonly<RemovedLineProps>) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <SecondaryButton
        size="compact"
        aria-label={`Desfazer, devolver ${product.name}`}
        onClick={onUndo}
      >
        Desfazer
      </SecondaryButton>
      <p className="min-w-0 break-words text-stone-700">{product.name} saiu do carrinho</p>
    </li>
  );
}
