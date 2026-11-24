import { ShoppingCartIcon } from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { BuildingNeed } from "../api/interests";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { FormError } from "../components/FormError";
import { ProductPicture } from "../components/ProductPicture";
import { CARD_SURFACE } from "../components/surface";
import { TitleBar } from "../components/TitleBar";
import { formatCount, formatMoney, sellerName } from "../format";
import { useBuildingNeeds } from "../hooks/useBuildingNeeds";
import { CART_LIMIT, useCart } from "../hooks/useCart";

const ORDER_BUTTON_CLASSES =
  "h-11 flex-1 rounded-full border border-stone-400 bg-white px-2 font-bold sm:flex-none " +
  "sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 aria-pressed:border-lime-800 aria-pressed:bg-lime-100 " +
  "aria-pressed:text-lime-800";
const ROW_CLASSES =
  `overflow-hidden ${CARD_SURFACE} has-checked:border-lime-800 has-checked:bg-lime-50 ` +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 " +
  "has-focus-visible:outline-lime-800";
const LABEL_CLASSES =
  "flex cursor-pointer items-start gap-4 p-4 has-disabled:cursor-not-allowed sm:p-5";
const LINK_CLASSES =
  "rounded font-bold text-lime-800 underline focus-visible:outline-2 " +
  "focus-visible:outline-lime-800";
// no celular a barra fica presa em cima da barra de navegação, depois fica no fim da lista
const BAR_CLASSES =
  "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t " +
  "border-stone-300 bg-white px-4 py-3 md:sticky md:bottom-4 md:mt-6 md:rounded-3xl " +
  "md:border md:px-6 md:py-4 md:shadow-sm";
const MAIN_CLASSES = "min-h-screen bg-stone-50 text-stone-900 md:pb-16";
const BAR_ROW_CLASSES =
  "mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4";
const ORDERS = [
  { descending: true, label: "Maior primeiro" },
  { descending: false, label: "Menor primeiro" },
];

function totalOf(need: BuildingNeed): string {
  const residents = formatCount(
    need.interested_buyers_count,
    "morador interessado",
    "moradores interessados",
  );
  return `${need.total_quantity} kg no total, de ${residents}`;
}

function inStock(need: BuildingNeed): boolean {
  return need.product.quantity > 0;
}

interface NeedRowProps {
  need: BuildingNeed;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}

function NeedRow({ need, selected, onSelect }: Readonly<NeedRowProps>) {
  const { product } = need;
  const seller = sellerName(product.farmer);
  const soldOut = !inStock(need);
  const noteId = useId();

  return (
    <li className={ROW_CLASSES}>
      {/* o rótulo envolve a caixa, então a linha inteira seleciona */}
      <label className={LABEL_CLASSES}>
        <input
          type="checkbox"
          aria-label={`Selecionar ${product.name} de ${seller}`}
          aria-describedby={soldOut ? noteId : undefined}
          checked={selected}
          disabled={soldOut}
          onChange={(event) => onSelect(event.target.checked)}
          className="mt-1 size-6 shrink-0 accent-lime-800 focus-visible:outline-none"
        />
        <ProductPicture url={product.picture_url} className="w-16 shrink-0 rounded-xl sm:w-28" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold break-words">{product.name}</h2>
          <p className="break-words text-stone-700">{seller}</p>
          <p className="text-stone-700">{totalOf(need)}</p>
          <p className="text-stone-700">
            <span className="tabular-nums">{formatMoney(product.price)}</span> por kg,{" "}
            {formatCount(product.quantity, "kg disponível", "kg disponíveis")}
          </p>
          <p className="font-bold">
            Custo estimado{" "}
            <span className="tabular-nums">
              {formatMoney(need.total_quantity * Number(product.price))}
            </span>
          </p>
          {soldOut && (
            <p id={noteId} className="font-bold text-amber-700">
              Sem estoque
            </p>
          )}
        </div>
      </label>
      <p className="border-t border-stone-200 px-4 py-3 sm:px-5">
        <Link
          to={`/produtos/${product.public_id}`}
          aria-label={`Ver o produto ${product.name}`}
          className={LINK_CLASSES}
        >
          Ver o produto
        </Link>
      </p>
    </li>
  );
}

export function BuildingNeeds() {
  const list = useBuildingNeeds();
  const cart = useCart();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cartError, setCartError] = useState("");
  const orderLabelId = useId();
  const needs = list.needs ?? [];
  // sem estoque o produto sai da seleção, mesmo se já estava marcado
  const isSelected = (need: BuildingNeed) =>
    selectedIds.includes(need.product.public_id) && inStock(need);
  const selected = needs.filter(isSelected);
  const farmers = new Set(selected.map((need) => need.product.farmer.public_id)).size;

  function select(publicId: string, checked: boolean) {
    setCartError("");
    setSelectedIds((current) =>
      checked ? [...current, publicId] : current.filter((id) => id !== publicId),
    );
  }

  // começa com o total pedido, sem passar do estoque
  function addToCart() {
    const left = cart.put(
      selected.map(({ product, total_quantity }) => ({
        productPublicId: product.public_id,
        quantity: Math.min(total_quantity, product.quantity),
        unitPrice: product.price,
      })),
    );
    if (left > 0) {
      setCartError(
        `O carrinho chegou ao limite de ${CART_LIMIT} produtos, ` +
          `${formatCount(left, "produto ficou", "produtos ficaram")} de fora`,
      );
      return;
    }
    void navigate("/carrinho");
  }

  return (
    // a barra presa no celular não pode cobrir o fim da lista
    <main className={`${MAIN_CLASSES} ${selected.length > 0 ? "pb-40" : "pb-16"}`}>
      <TitleBar title="Necessidades do prédio" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div
          role="group"
          aria-labelledby={orderLabelId}
          className="flex flex-wrap items-center gap-2 border-b border-stone-300 py-8"
        >
          <span id={orderLabelId} className="w-full text-lg font-bold sm:mr-2 sm:w-auto">
            Ordenar por quantidade total
          </span>
          {ORDERS.map(({ descending, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={descending === list.descending}
              onClick={() => list.sort(descending)}
              className={ORDER_BUTTON_CLASSES}
            >
              {label}
            </button>
          ))}
        </div>
        {list.needs?.length === 0 && (
          <p className="pt-12 text-center text-xl text-balance">
            Ainda não há interesses dos moradores. Quando um morador registrar interesse em um
            produto, ele aparece aqui.
          </p>
        )}
        {needs.length > 0 && (
          <ul className="space-y-4 pt-8">
            {needs.map((need) => (
              <NeedRow
                key={need.product.public_id}
                need={need}
                selected={isSelected(need)}
                onSelect={(checked) => select(need.product.public_id, checked)}
              />
            ))}
          </ul>
        )}
        {selected.length > 0 && (
          <section aria-label="Seleção" className={BAR_CLASSES}>
            <div className={BAR_ROW_CLASSES}>
              <p className="text-lg font-bold">
                {formatCount(selected.length, "produto selecionado", "produtos selecionados")},
                de {formatCount(farmers, "agricultor", "agricultores")}
              </p>
              <FormError message={cartError} />
              <PrimaryButton
                type="button"
                onClick={addToCart}
                className="flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                <ShoppingCartIcon aria-hidden="true" className="size-5 shrink-0" />
                Adicionar ao carrinho
              </PrimaryButton>
            </div>
          </section>
        )}
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">{list.loading ? "Carregando..." : ""}</output>
          <FormError message={list.error} />
          {list.error && <SecondaryButton onClick={list.reload}>Tentar de novo</SecondaryButton>}
        </div>
      </div>
    </main>
  );
}
