import { useSyncExternalStore } from "react";
import type { ProductUnit } from "../api/products";
import { useAuth } from "../auth/AuthContext";
import { isProductUnit } from "../format";

export interface CartItem {
  productPublicId: string;
  quantity: number;
  // o preço visto quando o item entrou no carrinho
  unitPrice: string;
  // a unidade vista junto com o preço, os carrinhos antigos não têm
  unit?: ProductUnit;
}

// o mesmo limite de itens que a API aceita numa compra
export const CART_LIMIT = 100;
export const CART_FULL = `O carrinho já tem ${CART_LIMIT} produtos, o limite de uma compra`;

const KEY_PREFIX = "conectagro:carrinho:";
const EMPTY: CartItem[] = [];
const PRICE = /^\d+(\.\d{1,2})?$/;
// a mesma lista volta enquanto o texto guardado não muda
const parsed = new Map<string, { raw: string | null; items: CartItem[] }>();
// sem o armazenamento o carrinho vale só enquanto a aba fica aberta
const unsaved = new Map<string, CartItem[]>();
const listeners = new Set<() => void>();

function isItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productPublicId === "string" &&
    item.productPublicId !== "" &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    typeof item.unitPrice === "string" &&
    PRICE.test(item.unitPrice) &&
    (item.unit === undefined || isProductUnit(item.unit))
  );
}

function parse(raw: string | null): CartItem[] {
  if (raw === null) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(isItem)) return EMPTY;
    const ids = new Set(value.map((item) => item.productPublicId));
    return ids.size === value.length ? value.slice(0, CART_LIMIT) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function snapshot(key: string): CartItem[] {
  const inMemory = unsaved.get(key);
  if (inMemory) return inMemory;
  const raw = readRaw(key);
  const cached = parsed.get(key);
  if (cached?.raw === raw) return cached.items;
  const items = parse(raw);
  parsed.set(key, { raw, items });
  return items;
}

function notify() {
  for (const listener of listeners) listener();
}

function save(key: string, items: CartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(items));
    unsaved.delete(key);
  } catch {
    unsaved.set(key, items);
  }
  notify();
}

// outra aba mudou o carrinho, e a próxima leitura já vem do armazenamento
function onStorage(event: StorageEvent) {
  if (event.key === null || event.key.startsWith(KEY_PREFIX)) notify();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

// junta os itens novos aos que já estão no carrinho, até o limite
function merge(
  current: CartItem[],
  added: CartItem[],
  quantityOf: (old: CartItem | undefined, item: CartItem) => number,
): { items: CartItem[]; left: number } {
  const items = [...current];
  let left = 0;
  for (const item of added) {
    const index = items.findIndex((old) => old.productPublicId === item.productPublicId);
    const quantity = quantityOf(items[index], item);
    if (index >= 0) items[index] = { ...item, quantity };
    else if (items.length < CART_LIMIT) items.push({ ...item, quantity });
    else left += 1;
  }
  return { items, left };
}

export function cartKeyOf(ownerId: string): string {
  return `${KEY_PREFIX}${ownerId}`;
}

export function useCart() {
  const { user, profileType } = useAuth();
  // o prédio identifica o síndico, que é o único dono de carrinho
  const ownerId = profileType === "apartment" ? (user?.apartment?.public_id ?? null) : null;
  const key = ownerId === null ? null : cartKeyOf(ownerId);
  const items = useSyncExternalStore(subscribe, () => (key ? snapshot(key) : EMPTY));

  function write(change: (current: CartItem[]) => CartItem[]) {
    if (key) save(key, change(snapshot(key)));
  }

  // soma ao que já estava, sem passar do estoque, e diz se coube
  function add(item: CartItem, stock: number): boolean {
    if (!key) return false;
    const { items: next, left } = merge(snapshot(key), [item], (old, added) =>
      Math.min((old?.quantity ?? 0) + added.quantity, stock),
    );
    if (left === 0) save(key, next);
    return left === 0;
  }

  // troca a quantidade dos que já estavam e devolve quantos não couberam
  function put(added: CartItem[]): number {
    if (!key) return added.length;
    const { items: next, left } = merge(snapshot(key), added, (_old, item) => item.quantity);
    save(key, next);
    return left;
  }

  function change(productPublicId: string, changes: Partial<Omit<CartItem, "productPublicId">>) {
    write((current) =>
      current.map((item) =>
        item.productPublicId === productPublicId ? { ...item, ...changes } : item,
      ),
    );
  }

  function remove(productPublicId: string) {
    write((current) => current.filter((item) => item.productPublicId !== productPublicId));
  }

  return {
    enabled: key !== null,
    items,
    quantityOf: (productPublicId: string) =>
      items.find((item) => item.productPublicId === productPublicId)?.quantity ?? 0,
    // a leitura mais nova, para quem espera a API antes de usar o carrinho
    current: () => (key ? snapshot(key) : EMPTY),
    add,
    put,
    change,
    remove,
    clear: () => write(() => []),
  };
}
