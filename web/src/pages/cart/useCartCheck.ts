import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, errorMessage, lostAccess } from "../../api/client";
import { getProduct, type ProductDetail, type ProductUnit } from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { stateOf, type ProductState } from "../../components/products/productState";
import type { useCart } from "../../hooks/useCart";

export type Problem = Exclude<ProductState, "available">;

export interface CheckNotes {
  // o preço guardado antes da conferência, por produto
  oldPrices: Partial<Record<string, string>>;
  // a unidade guardada antes da conferência, por produto
  oldUnits: Partial<Record<string, ProductUnit>>;
  // a quantidade pedida antes de caber no estoque, por produto
  clamped: Partial<Record<string, number>>;
  // os produtos que saíram do catálogo e do carrinho
  gone: string[];
}

// poucos pedidos de cada vez, para não encher a API
const BATCH = 10;
type Checked = Partial<Record<string, ProductDetail>>;
const NO_NOTES: CheckNotes = { oldPrices: {}, oldUnits: {}, clamped: {}, gone: [] };

export function problemOf(product: ProductDetail): Problem | null {
  const state = stateOf(product);
  return state === "available" ? null : state;
}

// o produto apagado volta como null, como o id guardado que a API recusa
const GONE_STATUSES = [404, 422];

async function fetchProducts(ids: string[]): Promise<Map<string, ProductDetail | null>> {
  const found = new Map<string, ProductDetail | null>();
  for (let start = 0; start < ids.length; start += BATCH) {
    const batch = ids.slice(start, start + BATCH);
    const products = await Promise.all(
      batch.map((id) =>
        getProduct(id).catch((error: unknown) => {
          if (error instanceof ApiError && GONE_STATUSES.includes(error.status)) return null;
          throw error;
        }),
      ),
    );
    batch.forEach((id, index) => found.set(id, products[index]));
  }
  return found;
}

export function useCartCheck(cart: ReturnType<typeof useCart>) {
  const { refreshUser } = useAuth();
  const [products, setProducts] = useState<Checked>({});
  const [notes, setNotes] = useState<CheckNotes>(NO_NOTES);
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState<{ attempt: number; error: string } | null>(null);
  const seen = useRef(products);

  // confere cada produto e diz se o carrinho mudou por causa disso
  async function check(): Promise<{ changed: boolean; products: Checked }> {
    const items = cart.current();
    const found = await fetchProducts(items.map((item) => item.productPublicId));
    const next: CheckNotes = { oldPrices: {}, oldUnits: {}, clamped: {}, gone: [] };
    let changed = false;
    for (const { productPublicId: id, quantity, unitPrice, unit } of items) {
      const product = found.get(id);
      const before = seen.current[id];
      if (!product) {
        cart.remove(id);
        next.gone.push(id);
        changed = true;
        continue;
      }
      if (problemOf(product)) {
        changed ||= before === undefined || problemOf(before) === null;
        continue;
      }
      // o produto que a página não mostrou ou que estava fora entra no total
      if (before === undefined || problemOf(before) !== null) changed = true;
      if (Number(product.price) !== Number(unitPrice)) {
        cart.change(id, { unitPrice: product.price });
        next.oldPrices[id] = unitPrice;
        changed = true;
      }
      if (unit !== product.unit) {
        cart.change(id, { unit: product.unit });
        // o carrinho antigo não tinha a unidade, que passa a ser a de agora
        if (unit !== undefined) {
          next.oldUnits[id] = unit;
          changed = true;
        }
      }
      if (quantity > product.quantity) {
        cart.change(id, { quantity: product.quantity });
        next.clamped[id] = quantity;
        changed = true;
      }
    }
    const kept = [...found].filter((entry): entry is [string, ProductDetail] => entry[1] !== null);
    seen.current = { ...seen.current, ...Object.fromEntries(kept) };
    setProducts(seen.current);
    setNotes((current) => ({
      oldPrices: { ...current.oldPrices, ...next.oldPrices },
      oldUnits: { ...current.oldUnits, ...next.oldUnits },
      clamped: { ...current.clamped, ...next.clamped },
      gone: [...new Set([...current.gone, ...next.gone])],
    }));
    return { changed, products: seen.current };
  }

  // o efeito usa sempre a conferência com o carrinho mais novo
  const latestCheck = useRef(check);
  useLayoutEffect(() => {
    latestCheck.current = check;
  });

  useEffect(() => {
    let message = "";
    latestCheck
      .current()
      .catch(async (loadError: unknown) => {
        message = errorMessage(loadError);
        if (lostAccess(loadError)) await refreshUser();
      })
      .finally(() => setFinished({ attempt, error: message }))
      .catch((refreshError: unknown) => console.error(refreshError));
  }, [attempt, refreshUser]);

  const checking = finished?.attempt !== attempt;
  const error = checking ? "" : finished.error;
  // um item que chegou depois, de outra aba por exemplo, também é conferido
  const unchecked = cart.items.some((item) => !(item.productPublicId in products));
  if (unchecked && !checking && error === "") setAttempt(attempt + 1);

  return {
    products,
    notes,
    checking,
    error,
    check,
    retry: () => setAttempt((current) => current + 1),
  };
}
