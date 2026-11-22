import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router";
import type { BuildingNeed } from "../../api/interests";
import type { ProductDetail } from "../../api/products";
import { createPurchase } from "../../api/purchases";
import { PrimaryButton, SecondaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { TextField } from "../../components/TextField";
import { formatCount, formatMoney, sellerName } from "../../format";
import { useAction } from "../../hooks/useAction";

const QUANTITY_CLASSES =
  "h-12 w-24 rounded-lg border border-stone-400 bg-white px-3 tabular-nums " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800";

function groupByFarmer(needs: BuildingNeed[]): BuildingNeed[][] {
  const farmers = new Map<string, BuildingNeed[]>();
  for (const need of needs) {
    const farmerId = need.product.farmer.public_id;
    const sameFarmer = farmers.get(farmerId) ?? [];
    sameFarmer.push(need);
    farmers.set(farmerId, sameFarmer);
  }
  return [...farmers.values()];
}

interface QuantityLineProps {
  product: ProductDetail;
  quantity: string;
  cost: number;
  onChange: (quantity: string) => void;
}

function QuantityLine({ product, quantity, cost, onChange }: Readonly<QuantityLineProps>) {
  const hintId = useId();

  return (
    <li className="py-4">
      <p className="flex items-baseline justify-between gap-6 font-bold">
        <span className="min-w-0 break-words">{product.name}</span>
        <span className="tabular-nums">{formatMoney(cost)}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <input
          type="number"
          min={1}
          max={2147483647}
          step={1}
          required
          value={quantity}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Quantidade de ${product.name} em kg`}
          aria-describedby={hintId}
          className={QUANTITY_CLASSES}
        />
        <span className="text-stone-600">kg × {formatMoney(product.price)}</span>
      </div>
      <p id={hintId} className="mt-1 text-stone-600">
        {formatCount(product.quantity, "kg disponível", "kg disponíveis")}
      </p>
    </li>
  );
}

interface PurchaseFormProps {
  needs: BuildingNeed[];
  onBack: () => void;
}

export function PurchaseForm({ needs, onBack }: Readonly<PurchaseFormProps>) {
  const { error, pending, run } = useAction();
  const navigate = useNavigate();
  const title = useRef<HTMLHeadingElement>(null);
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(
      needs.map(({ product, total_quantity }) => [
        product.public_id,
        String(Math.min(total_quantity, product.quantity)),
      ]),
    ),
  );

  // a lista sai da tela e o foco no título leva ao começo do formulário
  useEffect(() => {
    title.current?.focus();
  }, []);

  function costOf(product: ProductDetail): number {
    return Number(quantities[product.public_id]) * Number(product.price);
  }

  function sumOf(group: BuildingNeed[]): number {
    return group.reduce((sum, { product }) => sum + costOf(product), 0);
  }

  function changeQuantity(publicId: string, quantity: string) {
    setQuantities((current) => ({ ...current, [publicId]: quantity }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new FormData(event.currentTarget).get("expected_delivery_date");
    const items = needs.map(({ product }) => ({
      product_public_id: product.public_id,
      quantity: Number(quantities[product.public_id]),
    }));
    run(async () => {
      await createPurchase({ expected_delivery_date: String(date), items });
      void navigate("/compras");
    });
  }

  return (
    <>
      <h2 ref={title} tabIndex={-1} className="pt-8 text-3xl font-extrabold outline-none">
        Fechar compra
      </h2>
      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-4xl border border-stone-200 bg-stone-100 px-6 sm:px-10"
      >
        <fieldset disabled={pending} className="divide-y divide-stone-300">
          {groupByFarmer(needs).map((group) => (
            <section key={group[0].product.farmer.public_id} className="py-8">
              <h3 className="text-xl font-bold break-words">
                {sellerName(group[0].product.farmer)}
              </h3>
              <ul className="divide-y divide-dashed divide-stone-400">
                {group.map(({ product }) => (
                  <QuantityLine
                    key={product.public_id}
                    product={product}
                    quantity={quantities[product.public_id]}
                    cost={costOf(product)}
                    onChange={(quantity) => changeQuantity(product.public_id, quantity)}
                  />
                ))}
              </ul>
              {/* com um produto só, o subtotal repetiria a linha de cima */}
              {group.length > 1 && (
                <p className="flex justify-between gap-6 border-t border-stone-400 pt-2 font-bold">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(sumOf(group))}</span>
                </p>
              )}
            </section>
          ))}
          <p className="flex items-baseline justify-between gap-6 py-6 text-2xl font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(sumOf(needs))}</span>
          </p>
          <div className="py-8">
            <div className="sm:max-w-xs">
              <TextField label="Entrega prevista" name="expected_delivery_date" type="date" />
            </div>
          </div>
        </fieldset>
        <div className="space-y-4 border-t border-stone-300 py-6">
          <FormError message={error} />
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <SecondaryButton disabled={pending} onClick={onBack}>
              Voltar
            </SecondaryButton>
            <PrimaryButton disabled={pending}>
              {pending ? "Confirmando..." : "Confirmar compra"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </>
  );
}
