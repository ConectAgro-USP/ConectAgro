import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, errorMessage, lostAccess } from "../../api/client";
import { getProduct, type ProductDetail } from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { daysUntil } from "../../format";
import type { useCart } from "../../hooks/useCart";

export type Problem = "paused" | "expired" | "soldOut";

export interface CheckNotes {
  // o preço guardado antes da conferência, por produto
  oldPrices: Partial<Record<string, string>>;
  // a quantidade pedida antes de caber no estoque, por produto
  clamped: Partial<Record<string, number>>;
  // os produtos que saíram do catálogo e do carrinho
  gone: string[];
}

// poucos pedidos de cada vez, para não encher a API
const BATCH = 10;
type Checked = Partial<Record<string, ProductDetail>>;
const NO_NOTES: CheckNotes = { oldPrices: {}, clamped: {}, gone: [] };

export function problemOf(product: ProductDetail): Problem | null {
  if (!product.is_available) return "paused";
  if (daysUntil(product.expiration_date) < 0) return "expired";
  if (product.quantity <= 0) return "soldOut";
  return null;
}

// o produto apagado volta como null
async function fetchProducts(ids: string[]): Promise<Map<string, ProductDetail | null>> {
  const found = new Map<string, ProductDetail | null>();
  for (let start = 0; start < ids.length; start += BATCH) {
    const batch = ids.slice(start, start + BATCH);
    const products = await Promise.all(
      batch.map((id) =>
        getProduct(id).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
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
    const next: CheckNotes = { oldPrices: {}, clamped: {}, gone: [] };
    let changed = false;
    for (const { productPublicId: id, quantity, unitPrice } of items) {
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
      if (Number(product.price) !== Number(unitPrice)) {
        cart.change(id, { unitPrice: product.price });
        next.oldPrices[id] = unitPrice;
        changed = true;
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
