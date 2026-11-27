import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { ProductDetail } from "../api/products";
import { createPurchase } from "../api/purchases";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { buttonClasses } from "../components/buttonClasses";
import { FormError } from "../components/FormError";
import { CARD_SURFACE } from "../components/surface";
import { TextField } from "../components/TextField";
import { TitleBar } from "../components/TitleBar";
import { formatCount, formatMoney, sellerName } from "../format";
import { useAction } from "../hooks/useAction";
import { CART_FULL, useCart, type CartItem } from "../hooks/useCart";
import { useWriteGuard } from "../hooks/useWriteGuard";
import { BlockedLine, QuantityLine, RemovedLine } from "./cart/CartLines";
import { problemOf, useCartCheck } from "./cart/useCartCheck";

const LINK_CLASSES = "flex items-center justify-center";
const CATALOG_LINK_CLASSES = `${LINK_CLASSES} ${buttonClasses("primary")}`;
const MORE_LINK_CLASSES = `${LINK_CLASSES} ${buttonClasses("secondary")}`;
const CHANGED =
  "Os produtos mudaram desde que você abriu o carrinho. Confira e confirme de novo.";

interface Line {
  id: string;
  product: ProductDetail;
  item: CartItem | undefined;
}

function groupByFarmer(lines: Line[]): Line[][] {
  const farmers = new Map<string, Line[]>();
  for (const line of lines) {
    const sameFarmer = farmers.get(line.product.farmer.public_id) ?? [];
    sameFarmer.push(line);
    farmers.set(line.product.farmer.public_id, sameFarmer);
  }
  return [...farmers.values()];
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12 text-center">
      <h2 className="text-2xl font-bold">Seu carrinho está vazio</h2>
      <p className="text-xl text-balance">Escolha produtos no catálogo e eles aparecem aqui.</p>
      <Link to="/" className={CATALOG_LINK_CLASSES}>
        Ver os produtos
      </Link>
    </div>
  );
}

export function Cart() {
  const cart = useCart();
  const checked = useCartCheck(cart);
  const { error, setError, pending, run } = useAction();
  const guard = useWriteGuard();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});
  // a linha removida fica no lugar, com o desfazer, até sair da página
  const [removed, setRemoved] = useState<Partial<Record<string, CartItem>>>({});
  const [order, setOrder] = useState<string[]>([]);
  const busy = pending || sent;
  const items = new Map(cart.items.map((item) => [item.productPublicId, item]));
  const ids = [...order, ...cart.items.map((item) => item.productPublicId)];
  const lines = [...new Set(ids)].flatMap((id) => {
    const product = checked.products[id];
    const item = items.get(id);
    return product && (item || removed[id]) ? [{ id, product, item }] : [];
  });
  const buyable = lines.filter(({ item, product }) => item && !problemOf(product));
  const quantityOf = (item: CartItem) => drafts[item.productPublicId] ?? String(item.quantity);
  const costOf = (group: Line[]) =>
    group.reduce(
      (sum, { item, product }) =>
        item && !problemOf(product)
          ? sum + (Number(quantityOf(item)) || 0) * Number(product.price)
          : sum,
      0,
    );

  function changeQuantity(item: CartItem, text: string) {
    // lê o texto como o total lê, para a compra levar o que a linha mostra
    const quantity = Number(text);
    const valid = Number.isInteger(quantity) && quantity > 0;
    if (valid) cart.change(item.productPublicId, { quantity });
    setDrafts((current) => ({ ...current, [item.productPublicId]: valid ? undefined : text }));
  }

  function remove(item: CartItem) {
    setOrder(ids);
    setRemoved((current) => ({ ...current, [item.productPublicId]: item }));
    cart.remove(item.productPublicId);
  }

  function undo(id: string) {
    const item = removed[id];
    if (!item) return;
    if (cart.put([item]) > 0) {
      setError(CART_FULL);
      return;
    }
    setRemoved((current) => ({ ...current, [id]: undefined }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new FormData(event.currentTarget).get("expected_delivery_date");
    if (typeof date !== "string") return;
    run(async () => {
      // o preço, a unidade e o estoque podem ter mudado com o carrinho aberto
      const { changed, products } = await checked.check();
      if (changed) {
        setError(CHANGED);
        return;
      }
      const purchased = cart.current().flatMap((item) => {
        const product = products[item.productPublicId];
        if (!product || problemOf(product)) return [];
        return {
          product_public_id: item.productPublicId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          unit: item.unit ?? product.unit,
        };
      });
      try {
        await guard(createPurchase({ expected_delivery_date: date, items: purchased }));
      } catch (purchaseError) {
        // a recusa fica na tela, e a conferência mostra o que mudou
        await checked.check().catch(() => null);
        throw purchaseError;
      }
      // a página só troca depois, e o carrinho vazio não pode aparecer antes
      setSent(true);
      cart.clear();
      void navigate("/compras");
    });
  }

  let content;
  if (sent) {
    content = <p className="pt-12 text-center text-xl">Compra confirmada. Abrindo as compras...</p>;
  } else if (lines.length === 0 && cart.items.length === 0) {
    content = <EmptyCart />;
  } else if (lines.length === 0) {
    content = null;
  } else {
    content = (
      <form onSubmit={handleSubmit} className={`mt-8 px-6 sm:px-10 ${CARD_SURFACE}`}>
        <fieldset disabled={busy} className="divide-y divide-stone-300">
          {groupByFarmer(lines).map((group) => {
            const farmer = group[0].product.farmer;
            const buyableHere = group.filter(({ item, product }) => item && !problemOf(product));
            return (
              <section key={farmer.public_id} className="py-6">
                <h2 className="text-xl font-bold break-words">{sellerName(farmer)}</h2>
                <ul className="divide-y divide-dashed divide-stone-400">
                  {group.map(({ id, product, item }) => {
                    if (!item) {
                      return <RemovedLine key={id} product={product} onUndo={() => undo(id)} />;
                    }
                    const problem = problemOf(product);
                    if (problem) {
                      return (
                        <BlockedLine
                          key={id}
                          product={product}
                          problem={problem}
                          onRemove={() => remove(item)}
                        />
                      );
                    }
                    return (
                      <QuantityLine
                        key={id}
                        product={product}
                        quantity={quantityOf(item)}
                        oldPrice={checked.notes.oldPrices[id]}
                        oldUnit={checked.notes.oldUnits[id]}
                        clampedFrom={checked.notes.clamped[id]}
                        onChange={(text) => changeQuantity(item, text)}
                        onRemove={() => remove(item)}
                      />
                    );
                  })}
                </ul>
                {/* com um produto só, o subtotal repetiria a linha de cima */}
                {buyableHere.length > 1 && (
                  <p className="flex justify-between gap-6 border-t border-stone-400 pt-2 font-bold">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMoney(costOf(group))}</span>
                  </p>
                )}
              </section>
            );
          })}
          <p className="flex items-baseline justify-between gap-6 py-6 text-2xl font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(costOf(lines))}</span>
          </p>
          <div className="py-6 sm:max-w-xs">
            <TextField label="Entrega prevista" name="expected_delivery_date" type="date" />
          </div>
        </fieldset>
        <div className="space-y-4 border-t border-stone-300 py-6">
          <FormError message={error} />
          {buyable.length === 0 && (
            <p className="font-bold">Nenhum produto do carrinho pode ser comprado agora.</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link to="/" className={MORE_LINK_CLASSES}>
              Continuar comprando
            </Link>
            <PrimaryButton disabled={busy || checked.checking || buyable.length === 0}>
              {busy ? "Confirmando..." : "Confirmar compra"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Carrinho" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {checked.notes.gone.length > 0 && (
          <output className="block pt-8 text-lg font-bold text-amber-800">
            {formatCount(
              checked.notes.gone.length,
              "produto saiu do catálogo e foi tirado do carrinho",
              "produtos saíram do catálogo e foram tirados do carrinho",
            )}
          </output>
        )}
        {content}
        <div className="flex flex-col items-center gap-4 pt-10">
          <output className="text-lg text-stone-600">
            {checked.checking && !busy ? "Conferindo os produtos..." : ""}
          </output>
          <FormError message={checked.error} />
          {checked.error && (
            <SecondaryButton onClick={checked.retry}>Tentar de novo</SecondaryButton>
          )}
        </div>
      </div>
    </main>
  );
}
